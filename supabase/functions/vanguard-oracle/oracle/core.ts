/**
 * Oracle core logic — no Deno.serve() side-effect, safe to import.
 *
 * This module contains all Oracle query-processing logic extracted from
 * vanguard-oracle/index.ts. The entrypoint (index.ts) is a thin Deno.serve
 * wrapper that delegates here.
 *
 * If you need to call Oracle logic from another edge function (e.g.
 * vanguard-eval-interview), import runOracleQuery from this file —
 * NOT from index.ts (which carries Deno.serve as a module-level side-effect).
 */
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import type { DeepSeekMessage } from "../../_shared/deepseek.ts";
import { z } from "npm:zod";
import { runOracleReadonlyQuery } from "../../_shared/oracleSql.ts";
import { sanitizeStateVector, sanitizeUserConf, sanitizeUserQuery } from "../../_shared/promptSanitize.ts";
import { getStreamCutoffs, getWarsawDateString } from "../../_shared/time.ts";
import { compressHistoryIfNeeded } from "../../_shared/contextCompression.ts";
import { mintRecordFactId } from "../../_shared/mintRecordFactId.ts";

import { retrieveRagContext } from "./rag.ts";
import { buildSystemPrompt } from "./systemPrompt.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";
import {
  logOracleRun,
  saveClarificationRequest,
  createPendingAction,
  applyInsightCardsMutation,
} from "./mutations.ts";
import { buildSqlTool } from "./sqlTool.ts";
import { OracleResponseSchema, extractAnswer } from "./responseExtract.ts";
import { handleStreamingResponse } from "./streamHandler.ts";
import { handleNoteSummary, handleExtractTasks } from "../handlers/noteOps.ts";

const MAX_SQL_TOOL_ITERATIONS = 3;

export interface OracleRequestBody {
  state_vector?: unknown;
  history?: Array<{ role: string; content: string }>;
  current_query?: string;
  user_id?: string;
  mode?: string;
  thinking?: boolean;
  agent_run_mode?: string;
  user_conf?: unknown;
  override_date?: string;
  stream?: boolean;
  resolved_claims?: string;
  content?: string;
  title?: string;
}

/**
 * Core Oracle query handler. Called by the HTTP entrypoint (index.ts) and
 * can be imported directly by other edge functions without pulling in
 * Deno.serve().
 */
// deno-lint-ignore no-explicit-any
export async function runOracleQuery(
  supabase: any,
  user_id: string,
  body: OracleRequestBody,
  req: Request,
): Promise<Record<string, unknown> | Response> {
  const t0 = Date.now();

  const {
    history, current_query, mode = "chat", thinking = false,
    agent_run_mode = "auto", user_conf, override_date, stream, resolved_claims,
    content: noteContent, title: noteTitle,
  } = body;

  if (mode === "note_summary") return await handleNoteSummary(user_id, noteTitle, noteContent);
  if (mode === "extract_tasks") return await handleExtractTasks(user_id, noteTitle, noteContent);

  const now = override_date ? new Date(`${override_date}T12:00:00Z`) : new Date();
  const localTimeString = override_date
    ? `${override_date} 12:00:00 (BACKTEST)`
    : now.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  const { cut72h: cutoff72h } = getStreamCutoffs(now);
  const fourteenDaysAgoDate = getWarsawDateString(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));
  const todayDate = getWarsawDateString(now);

  const actualStateVector = await fetchWorldState(supabase, user_id, todayDate, now.getTime());
  const safeStateVector = sanitizeStateVector(actualStateVector);
  const safeUserConf = sanitizeUserConf(user_conf);
  console.log(`[oracle] start | user: ${user_id} | query: "${current_query?.substring(0, 50)}..."`);

  const rag = await retrieveRagContext(supabase, user_id, current_query, todayDate, fourteenDaysAgoDate, mode, cutoff72h);

  const systemPrompt = buildSystemPrompt({
    agent_run_mode, mode, fundament: rag.fundament, responsePrefs: rag.responsePrefs,
    todayPlan: safeStateVector.today_plan as Record<string, unknown> | undefined,
    recentPlanQuality: rag.recentPlanQuality, lastEveningReflection: rag.lastEveningReflection,
    ironRulesContext: rag.ironRulesContext, behavioralPatternsContext: rag.behavioralPatternsContext,
    intent: rag.intent, clarificationsContext: rag.clarificationsContext,
    healthSummaryText: rag.healthSummaryText, strainText: rag.strainText,
    medicalContextText: rag.medicalContextText, semanticContext: rag.semanticContext,
    graphContext: resolved_claims ? `${resolved_claims}\n\n${rag.graphContext}` : rag.graphContext,
    wikiContext: rag.wikiContext, localTimeString, safeUserConf, safeStateVector,
  });

  const compressedHistory = await compressHistoryIfNeeded(history || []);
  const wasCompressed =
    compressedHistory.length > 0 &&
    compressedHistory[0].role === "system" &&
    compressedHistory[0].content.startsWith("[SKOMPRESOWANA HISTORIA]");
  const messages: DeepSeekMessage[] = [
    { role: "system", content: systemPrompt },
    ...compressedHistory.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    })),
  ];

  if (current_query) {
    messages.push({ role: "user", content: sanitizeUserQuery(current_query) });
  }

  if (stream) {
    return await handleStreamingResponse(messages, {
      supabase, user_id, current_query: current_query ?? "", rag, thinking, agent_run_mode,
      wasCompressed, compressedHistory, t0,
    });
  }

  // --- NON-STREAMING PATH ---
  console.log(`[oracle] deepseek start`, Date.now() - t0);

  let structuredResponse: z.infer<typeof OracleResponseSchema>;
  let rawOutput = "";
  try {
    const toolMessages: DeepSeekMessage[] = [...messages];
    let iterations = 0;
    let chatRes;

    while (true) {
      const offerTools = !thinking && iterations < MAX_SQL_TOOL_ITERATIONS;
      chatRes = await deepseekChat({
        apiKey: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
        ...(thinking ? LLM_TASKS.deep : LLM_TASKS.oracle),
        messages: toolMessages,
        temperature: thinking ? null : 0.7,
        maxTokens: null,
        responseFormat: undefined,
        tools: offerTools ? [buildSqlTool()] : undefined,
        timeoutMs: 25000,
      });

      if (offerTools && chatRes.tool_calls && chatRes.tool_calls.length > 0) {
        iterations++;
        toolMessages.push({ role: "assistant", content: chatRes.content || "", tool_calls: chatRes.tool_calls });
        for (const tc of chatRes.tool_calls) {
          let sql = "";
          try { sql = JSON.parse(tc.function.arguments)?.sql || ""; } catch { /* handled below */ }
          const result = sql
            ? await runOracleReadonlyQuery(supabase, user_id, sql)
            : { ok: false as const, error: 'Missing or invalid "sql" argument' };
          console.log(
            `[oracle] sql tool call #${iterations}:`, sql.slice(0, 200),
            "->", result.ok ? `${result.rows.length} rows` : `error: ${result.error}`,
          );
          toolMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result.ok ? result.rows : { error: result.error }) });
        }
        continue;
      }

      // Check for DSML XML tool call in content
      const dsmlRegex = /<\s*\|\s*\|\s*DSML\s*\|\s*\|\s*parameter\s+name\s*=\s*['"]sql['"]\s+string\s*=\s*['"]true['"]\s*>(.*?)<\s*\/\s*\|\s*\|\s*DSML\s*\|\s*\|\s*parameter\s*>/is;
      const dsmlMatch = chatRes.content?.match(dsmlRegex);
      if (offerTools && dsmlMatch) {
        iterations++;
        const sql = dsmlMatch[1].trim();
        toolMessages.push({ role: "assistant", content: chatRes.content || "" });
        
        const result = sql
          ? await runOracleReadonlyQuery(supabase, user_id, sql)
          : { ok: false as const, error: 'Missing or invalid "sql" argument' };
        
        console.log(
          `[oracle] dsml sql tool call #${iterations}:`, sql.slice(0, 200),
          "->", result.ok ? `${result.rows.length} rows` : `error: ${result.error}`,
        );
        
        const responseXml = `< | | DSML | | tool_responses>\n< | | DSML | | response name="query_database">\n${JSON.stringify(result.ok ? result.rows : { error: result.error })}\n</ | | DSML | | response>\n</ | | DSML | | tool_responses>`;
        
        toolMessages.push({ role: "user", content: responseXml });
        continue;
      }

      break;
    }

    if (!chatRes!.content?.trim() && !chatRes!.reasoning_content?.trim()) {
      console.warn("[oracle] DeepSeek returned empty content, retrying once");
      chatRes = await deepseekChat({
        apiKey: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
        ...(thinking ? LLM_TASKS.deep : LLM_TASKS.oracle),
        messages: toolMessages,
        temperature: thinking ? null : 0.7,
        maxTokens: null,
        responseFormat: undefined,
        timeoutMs: 25000,
      });
    }
    rawOutput = chatRes!.content?.trim() || chatRes!.reasoning_content?.trim() || "";
    const reasoning_content = chatRes!.reasoning_content;
    console.log(`[oracle] deepseek done`, Date.now() - t0);

    const parsedObj = parseJsonFromContent(rawOutput) || {};
    const validation = OracleResponseSchema.safeParse(parsedObj);

    if (!validation.success) {
      console.warn("[oracle] Zod validation failed, using raw output as fallback. Error:", validation.error.message);
      structuredResponse = {
        answer: rawOutput.trim() || "Nie udało się poprawnie zinterpretować odpowiedzi.",
        confidence: "low", intent_confirmed: rag.intent, claims: [],
      };
    } else {
      structuredResponse = validation.data;
      if (!structuredResponse.answer && !structuredResponse.text && rawOutput.trim() && Object.keys(parsedObj).length === 0) {
        structuredResponse.answer = rawOutput.trim();
      }
    }

    if (reasoning_content) console.log("[oracle] Extracted reasoning_content length:", reasoning_content.length);
  } catch (e) {
    console.error("DeepSeek response failed:", e);
    throw e;
  }

  const text = extractAnswer(structuredResponse, rawOutput);

  await logOracleRun(supabase, {
    user_id, query: current_query || "", intent: structuredResponse.intent_confirmed || rag.intent,
    answer: text, confidence: structuredResponse.confidence || "medium",
    claims: structuredResponse.claims || [], sources: rag.retrievedSources,
    retrieved_context: { semantic: rag.matchesRes.data || [], graph: rag.graphRes.data || [], health_14d: rag.healthSummary14d },
    state_vector: safeStateVector,
  });

  if (structuredResponse.clarification_request) {
    await saveClarificationRequest(supabase, user_id, structuredResponse.clarification_request);
  }
  if (structuredResponse.schedule_mutation) {
    console.log("[oracle] schedule_mutation emitted:", (structuredResponse.schedule_mutation as Record<string, unknown>)?.action);
  }

  if (structuredResponse.mint_fact_id) {
    try {
      const factId = await mintRecordFactId(user_id);
      console.log("[oracle] minted fact_id:", factId);
      structuredResponse._minted_fact_id = factId;
    } catch (e: unknown) {
      console.warn("[oracle] mintRecordFactId failed (non-fatal):", (e as Error).message);
    }
  }

  let pendingAction = null;
  if (agent_run_mode === "confirm") {
    if (structuredResponse.insight_cards_mutation || structuredResponse.schedule_mutation) {
      pendingAction = await createPendingAction(
        supabase, user_id,
        structuredResponse.insight_cards_mutation ? "insight_cards_mutation" : "schedule_mutation",
        {
          insight_cards_mutation: structuredResponse.insight_cards_mutation || null,
          schedule_mutation: structuredResponse.schedule_mutation || null,
        },
      );
      delete structuredResponse.insight_cards_mutation;
      delete structuredResponse.schedule_mutation;
    }
  } else if (agent_run_mode === "readOnly") {
    if (structuredResponse.insight_cards_mutation || structuredResponse.schedule_mutation) {
      console.log("[oracle] readOnly mode: ignoring mutations");
      delete structuredResponse.insight_cards_mutation;
      delete structuredResponse.schedule_mutation;
    }
  }

  if (structuredResponse.insight_cards_mutation) {
    await applyInsightCardsMutation(supabase, user_id, structuredResponse.insight_cards_mutation);
  }

  console.log(`[oracle] response returned`, Date.now() - t0);
  return {
    ...structuredResponse, text, sources: rag.retrievedSources,
    intent_confirmed: structuredResponse.intent_confirmed || rag.intent,
    compressed_history: wasCompressed ? compressedHistory : undefined,
    pending_action: pendingAction || undefined,
  };
}
