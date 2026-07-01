import { deepseekChat } from "../_shared/deepseek.ts";
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { sanitizeStateVector, sanitizeUserConf, sanitizeUserQuery } from "../_shared/promptSanitize.ts";
import { getStreamCutoffs, getWarsawDateString } from "../_shared/time.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { compressHistoryIfNeeded } from "../_shared/contextCompression.ts";
import { mintRecordFactId } from "../_shared/mintRecordFactId.ts";

import { retrieveRagContext, stripJsonFence } from "./oracle/rag.ts";
import { buildSystemPrompt } from "./oracle/systemPrompt.ts";
import {
  logOracleRun,
  saveClarificationRequest,
  createPendingAction,
  applyInsightCardsMutation,
} from "./oracle/mutations.ts";

Deno.serve(async (req) => {
  const t0 = Date.now();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { state_vector, history, current_query, user_id: requestedUserId, mode = 'chat', thinking = false, agent_run_mode = 'auto', user_conf } = body;
    const { userId } = await resolveUserScope(req, requestedUserId ?? null);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user_id = userId;
    const safeStateVector = sanitizeStateVector(state_vector);
    const safeUserConf = sanitizeUserConf(user_conf);
    console.log(`[oracle] start | user: ${user_id} | query: "${current_query?.substring(0, 50)}..."`);
    const supabase = createServiceClient();

    const now = new Date();
    const localTimeString = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const { cut72h: cutoff72h } = getStreamCutoffs();
    const fourteenDaysAgoDate = getWarsawDateString(new Date(now.getTime() - (13 * 24 * 60 * 60 * 1000)));
    const todayDate = getWarsawDateString(now);

    const rag = await retrieveRagContext(
      supabase,
      user_id,
      current_query,
      todayDate,
      fourteenDaysAgoDate,
      mode,
      cutoff72h,
      t0
    );

    const todayPlan = safeStateVector.today_plan as Record<string, unknown> | undefined;

    const systemPrompt = buildSystemPrompt({
      agent_run_mode,
      mode,
      fundament: rag.fundament,
      responsePrefs: rag.responsePrefs,
      todayPlan,
      recentPlanQuality: rag.recentPlanQuality,
      lastEveningReflection: rag.lastEveningReflection,
      ironRulesContext: rag.ironRulesContext,
      behavioralPatternsContext: rag.behavioralPatternsContext,
      intent: rag.intent,
      clarificationsContext: rag.clarificationsContext,
      healthSummaryText: rag.healthSummaryText,
      strainText: rag.strainText,
      medicalContextText: rag.medicalContextText,
      semanticContext: rag.semanticContext,
      graphContext: rag.graphContext,
      wikiContext: rag.wikiContext,
      localTimeString,
      safeUserConf,
      safeStateVector,
    });

    const compressedHistory = await compressHistoryIfNeeded(history || []);
    const wasCompressed = compressedHistory.length > 0 &&
      compressedHistory[0].role === 'system' &&
      compressedHistory[0].content.startsWith('[SKOMPRESOWANA HISTORIA]');
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...compressedHistory.map(m => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content
      })),
    ];

    if (current_query) {
      messages.push({ role: "user" as const, content: sanitizeUserQuery(current_query) });
    }

    console.log(`[oracle] deepseek start`, Date.now() - t0);

    let structuredResponse;
    try {
      const { content: rawOutput } = await deepseekChat({
        apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
        model: thinking ? 'deepseek-reasoner' : 'deepseek-v4-flash',
        messages: messages,
        temperature: thinking ? null : 0.7,
        maxTokens: null,
        responseFormat: !thinking ? { type: "json_object" } : undefined,
        timeoutMs: 25000,
      });
      console.log(`[oracle] deepseek done`, Date.now() - t0);
      try {
        structuredResponse = JSON.parse(stripJsonFence(rawOutput));
      } catch (_parseError) {
        const thinkStripped = rawOutput.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (!thinkStripped) {
          console.warn('[oracle] model returned only <think> block — using fallback');
        } else {
          console.log('[oracle] JSON parse failed, using text as answer');
        }
        structuredResponse = {
          answer: thinkStripped || 'Nie udało się wygenerować odpowiedzi. Spróbuj ponownie.',
          confidence: thinkStripped ? 'medium' : 'low',
          intent_confirmed: rag.intent,
          claims: []
        };
      }
    } catch (e) {
      console.error("DeepSeek response failed:", e);
      throw e;
    }
    const text = structuredResponse.answer || structuredResponse.text || structuredResponse.odpowiedz || structuredResponse.response || "Błąd generowania odpowiedzi.";

    await logOracleRun(supabase, {
      user_id,
      query: current_query || "",
      intent: structuredResponse.intent_confirmed || rag.intent,
      answer: text,
      confidence: structuredResponse.confidence || "medium",
      claims: structuredResponse.claims || [],
      sources: rag.retrievedSources,
      retrieved_context: {
        semantic: rag.matchesRes.data || [],
        graph: rag.graphRes.data || [],
        health_14d: rag.healthSummary14d,
      },
      state_vector: safeStateVector,
    });

    if (structuredResponse.clarification_request) {
      await saveClarificationRequest(supabase, user_id, structuredResponse.clarification_request);
    }

    if (structuredResponse.schedule_mutation) {
      console.log('[oracle] schedule_mutation emitted:', (structuredResponse.schedule_mutation as any)?.action);
    }

    if (structuredResponse.mint_fact_id) {
      try {
        const factId = await mintRecordFactId(user_id);
        console.log('[oracle] minted fact_id:', factId);
        structuredResponse._minted_fact_id = factId;
      } catch (e: any) {
        console.warn('[oracle] mintRecordFactId failed (non-fatal):', e.message);
      }
    }

    let pendingAction = null;
    if (agent_run_mode === 'confirm') {
      if (structuredResponse.insight_cards_mutation || structuredResponse.schedule_mutation) {
        pendingAction = await createPendingAction(
          supabase,
          user_id,
          structuredResponse.insight_cards_mutation ? 'insight_cards_mutation' : 'schedule_mutation',
          {
            insight_cards_mutation: structuredResponse.insight_cards_mutation || null,
            schedule_mutation: structuredResponse.schedule_mutation || null,
          }
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

    if (structuredResponse.insight_cards_mutation) {
      await applyInsightCardsMutation(supabase, user_id, structuredResponse.insight_cards_mutation);
    }

    console.log(`[oracle] response returned`, Date.now() - t0);
    return new Response(JSON.stringify({
      ...structuredResponse,
      text,
      sources: rag.retrievedSources,
      intent_confirmed: structuredResponse.intent_confirmed || rag.intent,
      compressed_history: wasCompressed ? compressedHistory : undefined,
      pending_action: pendingAction || undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await logCriticalError({
      area: 'oracle',
      error,
      message: 'Oracle function fatal error',
    });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
