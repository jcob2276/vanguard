/**
 * @function vanguard-oracle
 * @trigger HTTP POST / Wywoływane z Telegrama lub frontendowego czatu Wyroczni
 * @role Silnik Wyroczni: obsługuje czat z RAG, generuje odpowiedzi, wnioskuje fakty i decyduje o akcjach.
 * @reads vanguard_oracle_runs, vanguard_stream, entities, claims, daily_strain, medical_lab_results, system_proposals, todo_items, projects, vanguard_notes, oracle_recommendations, oracle_clarification_requests, oracle_pending_actions, knowledge_insight_cards, daily_reconciliations, user_fundament, vanguard_preferences, oura_daily_summary, daily_nutrition, daily_food_entries, daily_wins, friction_events, vanguard_wiki_pages, vanguard_iron_rules
 * @writes vanguard_oracle_runs, audit_events, knowledge_insight_cards, oracle_clarification_requests, oracle_pending_actions, oracle_recommendations
 * @calls deepseek-v4-flash (default), deepseek-reasoner (deep mode `!!`), text-embedding-3-small (RAG)
 * @consumer Czat Wyroczni w Telegramie oraz w aplikacji webowej
 * @status active
 */
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";
import type { DeepSeekMessage } from "../_shared/deepseek.ts";
import { z } from "npm:zod";
import { runOracleReadonlyQuery } from "../_shared/oracleSql.ts";
import { resolveUserScope } from "../_shared/supabase.ts";
import { serveJson } from "../_shared/http.ts";
import { sanitizeStateVector, sanitizeUserConf, sanitizeUserQuery } from "../_shared/promptSanitize.ts";
import { getStreamCutoffs, getWarsawDateString } from "../_shared/time.ts";
import { compressHistoryIfNeeded } from "../_shared/contextCompression.ts";
import { mintRecordFactId } from "../_shared/mintRecordFactId.ts";

import { retrieveRagContext } from "./oracle/rag.ts";
import { buildSystemPrompt } from "./oracle/systemPrompt.ts";
import { fetchWorldState } from "../_shared/worldState.ts";
import {
  logOracleRun,
  saveClarificationRequest,
  createPendingAction,
  applyInsightCardsMutation,
} from "./oracle/mutations.ts";
import { handleSearch } from "./handlers/search.ts";
import { handleGoalCreate } from "./handlers/goalCreate.ts";
import { handleTaskBreakdown } from "./handlers/taskBreakdown.ts";
import { buildSqlTool } from "./oracle/sqlTool.ts";
import { OracleResponseSchema, extractAnswer } from "./oracle/responseExtract.ts";
import { handleStreamingResponse } from "./oracle/streamHandler.ts";

const MAX_SQL_TOOL_ITERATIONS = 3;

Deno.serve(serveJson(async (req, ctx) => {
  const t0 = Date.now();
  try {
    const body = await req.clone().json().catch(() => ({}));
    const db = ctx.supabase;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    if (action) {
      if (action === "search") return await handleSearch(req, body, db);
      if (action === "goal-create") return await handleGoalCreate(req, body);
      if (action === "task-breakdown") return await handleTaskBreakdown(req, body);
      throw new Error(`Unknown action: ${action}`);
    }

    const { state_vector, history, current_query, user_id: requestedUserId, mode = 'chat', thinking = false, agent_run_mode = 'auto', user_conf, override_date, stream, resolved_claims } = body;
    const { userId } = await resolveUserScope(req, requestedUserId ?? null);
    if (!userId) {
      throw new Error("Missing user_id");
    }
    const user_id = userId;
    const supabase = db;

    const now = override_date ? new Date(`${override_date}T12:00:00Z`) : new Date();
    const localTimeString = override_date ? `${override_date} 12:00:00 (BACKTEST)` : now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const { cut72h: cutoff72h } = getStreamCutoffs(now);
    const fourteenDaysAgoDate = getWarsawDateString(new Date(now.getTime() - (13 * 24 * 60 * 60 * 1000)));
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
    const wasCompressed = compressedHistory.length > 0 &&
      compressedHistory[0].role === 'system' &&
      compressedHistory[0].content.startsWith('[SKOMPRESOWANA HISTORIA]');
    const messages: DeepSeekMessage[] = [
      { role: "system", content: systemPrompt },
      ...compressedHistory.map(m => ({ role: m.role as "system" | "user" | "assistant", content: m.content })),
    ];

    if (current_query) {
      messages.push({ role: "user", content: sanitizeUserQuery(current_query) });
    }

    if (stream) {
      return await handleStreamingResponse(messages, {
        supabase, user_id, current_query, rag, thinking, agent_run_mode,
        wasCompressed, compressedHistory, t0,
      });
    }

    // --- NON-STREAMING FALLBACK ---
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
          apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
          model: thinking ? 'deepseek-reasoner' : 'deepseek-v4-flash',
          messages: toolMessages,
          temperature: thinking ? null : 0.7,
          maxTokens: null,
          responseFormat: (!thinking && !offerTools) ? { type: "json_object" as const } : undefined,
          tools: offerTools ? [buildSqlTool()] : undefined,
          timeoutMs: 25000,
        });

        if (offerTools && chatRes.tool_calls && chatRes.tool_calls.length > 0) {
          iterations++;
          toolMessages.push({ role: 'assistant', content: chatRes.content || '', tool_calls: chatRes.tool_calls });
          for (const tc of chatRes.tool_calls) {
            let sql = '';
            try { sql = JSON.parse(tc.function.arguments)?.sql || ''; } catch { /* handled below */ }
            const result = sql
              ? await runOracleReadonlyQuery(supabase, user_id, sql)
              : { ok: false as const, error: 'Missing or invalid "sql" argument' };
            console.log(`[oracle] sql tool call #${iterations}:`, sql.slice(0, 200), '->', result.ok ? `${result.rows.length} rows` : `error: ${result.error}`);
            toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result.ok ? result.rows : { error: result.error }) });
          }
          continue;
        }
        break;
      }

      if (!chatRes.content?.trim() && !chatRes.reasoning_content?.trim()) {
        console.warn('[oracle] DeepSeek returned empty content, retrying once');
        chatRes = await deepseekChat({
          apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
          model: thinking ? 'deepseek-reasoner' : 'deepseek-v4-flash',
          messages: toolMessages,
          temperature: thinking ? null : 0.7,
          maxTokens: null,
          responseFormat: !thinking ? { type: "json_object" as const } : undefined,
          timeoutMs: 25000,
        });
      }
      rawOutput = chatRes.content?.trim() || chatRes.reasoning_content?.trim() || "";
      const reasoning_content = chatRes.reasoning_content;
      console.log(`[oracle] deepseek done`, Date.now() - t0);

      const parsedObj = parseJsonFromContent(rawOutput) || {};
      const validation = OracleResponseSchema.safeParse(parsedObj);

      if (!validation.success) {
        console.warn('[oracle] Zod validation failed, using raw output as fallback. Error:', validation.error.message);
        structuredResponse = { answer: rawOutput.trim() || 'Nie udało się poprawnie zinterpretować odpowiedzi.', confidence: 'low', intent_confirmed: rag.intent, claims: [] };
      } else {
        structuredResponse = validation.data;
        if (!structuredResponse.answer && !structuredResponse.text && rawOutput.trim() && Object.keys(parsedObj).length === 0) {
           structuredResponse.answer = rawOutput.trim();
        }
      }
      
      if (reasoning_content) console.log('[oracle] Extracted reasoning_content length:', reasoning_content.length);
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

    if (structuredResponse.clarification_request) await saveClarificationRequest(supabase, user_id, structuredResponse.clarification_request);
    if (structuredResponse.schedule_mutation) console.log('[oracle] schedule_mutation emitted:', (structuredResponse.schedule_mutation as Record<string, unknown>)?.action);

    if (structuredResponse.mint_fact_id) {
      try {
        const factId = await mintRecordFactId(user_id);
        console.log('[oracle] minted fact_id:', factId);
        structuredResponse._minted_fact_id = factId;
      } catch (e: any) { console.warn('[oracle] mintRecordFactId failed (non-fatal):', e.message); }
    }

    let pendingAction = null;
    if (agent_run_mode === 'confirm') {
      if (structuredResponse.insight_cards_mutation || structuredResponse.schedule_mutation) {
        pendingAction = await createPendingAction(supabase, user_id,
          structuredResponse.insight_cards_mutation ? 'insight_cards_mutation' : 'schedule_mutation',
          { insight_cards_mutation: structuredResponse.insight_cards_mutation || null, schedule_mutation: structuredResponse.schedule_mutation || null }
        );
        delete structuredResponse.insight_cards_mutation;
        delete structuredResponse.schedule_mutation;
      }
    } else if (agent_run_mode === 'readOnly') {
      if (structuredResponse.insight_cards_mutation || structuredResponse.schedule_mutation) {
        console.log('[oracle] readOnly mode: ignoring mutations');
        delete structuredResponse.insight_cards_mutation;
        delete structuredResponse.schedule_mutation;
      }
    }

    if (structuredResponse.insight_cards_mutation) await applyInsightCardsMutation(supabase, user_id, structuredResponse.insight_cards_mutation);

    console.log(`[oracle] response returned`, Date.now() - t0);
    return {
      ...structuredResponse, text, sources: rag.retrievedSources,
      intent_confirmed: structuredResponse.intent_confirmed || rag.intent,
      compressed_history: wasCompressed ? compressedHistory : undefined,
      pending_action: pendingAction || undefined
    };

  } catch (error: any) {
    console.error('[oracle] fatal:', error);
    throw error;
  }
}, { auth: 'none' }));
