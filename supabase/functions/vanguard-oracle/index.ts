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
import { deepseekChat, deepseekStream, parseJsonFromContent, type DeepSeekTool, type DeepSeekMessage } from "../_shared/deepseek.ts";
import { runOracleReadonlyQuery } from "../_shared/oracleSql.ts";
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { sanitizeStateVector, sanitizeUserConf, sanitizeUserQuery } from "../_shared/promptSanitize.ts";
import { getStreamCutoffs, getWarsawDateString } from "../_shared/time.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { compressHistoryIfNeeded } from "../_shared/contextCompression.ts";
import { mintRecordFactId } from "../_shared/mintRecordFactId.ts";

import { z } from "npm:zod";
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

const OracleResponseSchema = z.object({
  answer: z.string().optional(),
  text: z.string().optional(),
  odpowiedz: z.string().optional(),
  odpowiedź: z.string().optional(),
  response: z.string().optional(),
  content: z.string().optional(),
  message: z.string().optional(),
  confidence: z.string().optional(),
  intent_confirmed: z.string().optional(),
  claims: z.array(z.any()).optional(),
  clarification_request: z.any().optional(),
  schedule_mutation: z.any().optional(),
  insight_cards_mutation: z.any().optional(),
  mint_fact_id: z.boolean().optional()
}).catchall(z.any());

function extractAnswer(structuredResponse: any, rawOutput: string): string {
  const answer = 
    structuredResponse.answer || 
    structuredResponse.text || 
    structuredResponse.odpowiedz || 
    structuredResponse.odpowiedź || 
    structuredResponse.response || 
    structuredResponse.content ||
    structuredResponse.message;

  if (typeof answer === 'string' && answer.trim()) {
    return answer.trim();
  }
  
  if (answer !== undefined && answer !== null) {
    if (typeof answer === 'object') {
      return JSON.stringify(answer);
    }
    return String(answer).trim();
  }

  const trimmedRaw = rawOutput?.trim();
  if (trimmedRaw) {
    if (trimmedRaw.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmedRaw);
        for (const val of Object.values(parsed)) {
          if (typeof val === 'string' && val.trim().length > 10) {
            return val.trim();
          }
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
    return trimmedRaw;
  }

  return "Błąd generowania odpowiedzi.";
}

const MAX_SQL_TOOL_ITERATIONS = 3;

const SQL_TOOL_SCHEMA_HINT = `
To jednoużytkownikowa baza (wszystkie wiersze należą do Jakuba) — nie musisz filtrować po user_id.
Klucz główny każdej tabeli to "id" (uuid), chyba że zaznaczono inaczej. "→" pokazuje po czym łączyć (JOIN).

DIETA:
- daily_nutrition(date, calories, protein, carbs, fat, fiber, sugar, avg_food_quality) — dzienne podsumowanie
- daily_food_entries(date, name, calories, protein, carbs, fat, meal_type, logged_at, food_quality_score) — pojedyncze posiłki
- food_library(name, brand, calories, protein, carbs, fat) — katalog produktów (referencja, nie log spożycia)
- nutrition_targets(date, target_kcal, protein_floor_g, deficit_kcal, est_maintenance_kcal)
- nutrition_profile(goal_body_fat, current_body_fat_est, event_date, event_name, protein_g_per_kg) — 1 wiersz, PK=user_id
- fasting_logs(date, note)

TRENING:
- workout_sessions(date, workout_day, duration_minutes, session_notes, session_rpe, hr_avg_bpm, hr_kcal_est, msp_passed)
- exercise_logs(session_id → workout_sessions.id, exercise_name, set_number, reps, weight, rpe, rir, muscle_tags)
- strava_activities(name, sport_type, start_date, distance, moving_time, average_heartrate, calories, suffer_score, gc_vo2max, trimp) — PK=strava_id

SEN / BIOMETRIA:
- oura_daily_summary(date, readiness_score, total_sleep_hours, hrv_avg, rhr_avg, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, sleep_score, steps, stress_score)
- daily_strain(date, strain_score, recovery_score, daily_status, main_limiter, illness_score, illness_level, cardio_load, strength_load, leg_load, cns_load)
- body_metrics(date, weight, waist, body_fat, chest, thigh, calf, muscle_mass)
- body_composition_measurements(measured_at, weight_kg, body_fat_pct, muscle_mass_kg, bmr_kcal, visceral_fat_rating) — precyzyjniejszy pomiar (skala)

ZADANIA / PRODUKTYWNOŚĆ:
- projects(name, goal, status, deadline, dream_id, goal_id)
- todo_sections(name, project_id → projects.id)
- todo_items(project_id → projects.id, section_id → todo_sections.id, title, notes, status, priority, due_date, completed_at, category)
- daily_wins(date, week_start, task_1..task_5, done_1..done_5, mood_score, daily_rpe, journal_entry)
- habits(name, is_positive), habit_logs(habit_id → habits.id, date, completed, context_note)
- weekly_reviews(week_start, proud_of, sabotage, do_differently, week_sentiment, bottleneck, pillar_scores)
- monthly_reviews(month_start, pattern_note, leverage_note, month_theme)
- daily_reconciliations(date, status, day_score, plan_quality, plan_failure_reason) — wieczorna refleksja/rekoncyliacja dnia
- life_goals(goal_cialo, goal_duch, goal_konto, date_cialo, date_duch, date_konto) — 1 wiersz, cele życiowe (3 filary)
- goal_kpis(pillar, name, unit, target, project_id → projects.id), kpi_entries(kpi_id → goal_kpis.id, week_start, value)
- sprint_goals(sprint_number, goal_text, focus_project_ids)
- learning_skills(key, label), learning_week_focus(skill_id → learning_skills.id, week_start, rep_target, rep_done)

ZDROWIE:
- medical_lab_results(result_date, marker_key, marker_name, category, value, unit, ref_low, ref_high, flag) — wyniki badań krwi itp.
- medical_documents(document_date, document_type, summary)
- supplements(name, active), supplement_logs(supplement_id → supplements.id, date, quantity)
- endmyopia_measurements(measured_at, eye_measured, blur_distance_cm, diopters), endmyopia_prescriptions(type, sphere_l, sphere_r, started_at)

NAWYKI CYFROWE / KONTEKST:
- phone_usage_daily(date, total_minutes, late_night_minutes, social_minutes, unlocks)
- vanguard_calendar(summary, start_time, end_time, category)
- location_history(created_at, latitude, longitude, place_name)
- vanguard_stream(source, content, category, timestamp) — surowy log rozmów/notatek, dobre do wyszukiwania kontekstu
- vanguard_notes(title, content, tags, is_pinned)
- friction_events(occurred_at, friction_type, declared_intention, actual_behavior, deviation) — rozjazd deklaracja vs zachowanie
`.trim();

function buildSqlTool(): DeepSeekTool {
  return {
    type: "function",
    function: {
      name: "query_database",
      description: `Wykonuje zapytanie SQL SELECT tylko do odczytu na bazie Vanguard, żeby odpowiedzieć na pytania o dietę, trening, sen, nastrój, zadania itd. Zwraca maks. 200 wierszy. Zawsze jedno zapytanie SELECT/WITH, bez średników.\n\n${SQL_TOOL_SCHEMA_HINT}`,
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Pojedyncze zapytanie SELECT/WITH w Postgres SQL." },
        },
        required: ["sql"],
      },
    },
  };
}

// handleSearch, handleGoalCreate, handleTaskBreakdown moved to ./handlers/ (Faza 7 moloch split)

Deno.serve(async (req) => {
  const t0 = Date.now();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}));
    const db = createServiceClient();
    
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || body.action;

    if (action) {
      if (action === "search") {
        return await handleSearch(req, body, db);
      }
      if (action === "goal-create") {
        return await handleGoalCreate(req, body);
      }
      if (action === "task-breakdown") {
        return await handleTaskBreakdown(req, body);
      }
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { state_vector, history, current_query, user_id: requestedUserId, mode = 'chat', thinking = false, agent_run_mode = 'auto', user_conf, override_date, stream, resolved_claims } = body;
    const { userId } = await resolveUserScope(req, requestedUserId ?? null);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user_id = userId;
    const supabase = createServiceClient();

    const now = override_date ? new Date(`${override_date}T12:00:00Z`) : new Date();
    const localTimeString = override_date ? `${override_date} 12:00:00 (BACKTEST)` : now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    const { cut72h: cutoff72h } = getStreamCutoffs(now);
    const fourteenDaysAgoDate = getWarsawDateString(new Date(now.getTime() - (13 * 24 * 60 * 60 * 1000)));
    const todayDate = getWarsawDateString(now);

    const actualStateVector = await fetchWorldState(supabase, user_id, todayDate, now.getTime());
    const safeStateVector = sanitizeStateVector(actualStateVector);
    const safeUserConf = sanitizeUserConf(user_conf);
    console.log(`[oracle] start | user: ${user_id} | query: "${current_query?.substring(0, 50)}..."`);

    const rag = await retrieveRagContext(
      supabase,
      user_id,
      current_query,
      todayDate,
      fourteenDaysAgoDate,
      mode,
      cutoff72h,
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
      graphContext: resolved_claims ? `${resolved_claims}\n\n${rag.graphContext}` : rag.graphContext,
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

    if (stream) {
      console.log(`[oracle] deepseek stream start`, Date.now() - t0);
      const dsResponse = await deepseekStream({
        apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
        model: thinking ? 'deepseek-reasoner' : 'deepseek-v4-flash',
        messages: messages,
        temperature: thinking ? null : 0.7,
        maxTokens: null,
      });

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Background consumer that keeps edge function alive while streaming
      (async () => {
        let accumulatedText = "";
        try {
          if (!dsResponse.body) throw new Error("No body from DeepSeek");
          const reader = dsResponse.body.getReader();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const data = JSON.parse(line.slice(6));
                  const delta = data.choices?.[0]?.delta;
                  if (delta) {
                    if (delta.reasoning_content) {
                      accumulatedText += delta.reasoning_content;
                      writer.write(encoder.encode(`data: ${JSON.stringify({ r: delta.reasoning_content })}\n\n`));
                    }
                    if (delta.content) {
                      accumulatedText += delta.content;
                      writer.write(encoder.encode(`data: ${JSON.stringify({ t: delta.content })}\n\n`));
                    }
                  }
                } catch (e) {
                  // ignore parse error on partial chunks
                }
              }
            }
          }
          
          console.log(`[oracle] deepseek stream done`, Date.now() - t0);
          
          // Stream complete, now parse full JSON and log to DB
          let parsedObj = parseJsonFromContent(accumulatedText) || {};
          let structuredResponse: any = OracleResponseSchema.safeParse(parsedObj).success ? parsedObj : { answer: accumulatedText.trim() };

          if (!structuredResponse.answer && !structuredResponse.text && accumulatedText.trim() && Object.keys(parsedObj).length === 0) {
            structuredResponse.answer = accumulatedText.trim();
          }

          const text = extractAnswer(structuredResponse, accumulatedText);

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
            delete structuredResponse.insight_cards_mutation;
            delete structuredResponse.schedule_mutation;
          }

          if (structuredResponse.insight_cards_mutation) {
            await applyInsightCardsMutation(supabase, user_id, structuredResponse.insight_cards_mutation);
          }

          const finalData = {
            ...structuredResponse,
            text,
            sources: rag.retrievedSources,
            intent_confirmed: structuredResponse.intent_confirmed || rag.intent,
            compressed_history: wasCompressed ? compressedHistory : undefined,
            pending_action: pendingAction || undefined
          };
          
          writer.write(encoder.encode(`data: ${JSON.stringify({ _final: finalData })}\n\n`));
          
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
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
        const deepseekArgs = {
          apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
          model: thinking ? 'deepseek-reasoner' : 'deepseek-v4-flash',
          messages: toolMessages,
          temperature: thinking ? null : 0.7,
          maxTokens: null,
          responseFormat: (!thinking && !offerTools) ? { type: "json_object" as const } : undefined,
          tools: offerTools ? [buildSqlTool()] : undefined,
          timeoutMs: 25000,
        };
        chatRes = await deepseekChat(deepseekArgs);

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
            toolMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result.ok ? result.rows : { error: result.error }),
            });
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
        structuredResponse = {
          answer: rawOutput.trim() || 'Nie udało się poprawnie zinterpretować odpowiedzi.',
          confidence: 'low',
          intent_confirmed: rag.intent,
          claims: []
        };
      } else {
        structuredResponse = validation.data;
        if (!structuredResponse.answer && !structuredResponse.text && rawOutput.trim() && Object.keys(parsedObj).length === 0) {
           structuredResponse.answer = rawOutput.trim();
        }
      }
      
      if (reasoning_content) {
         console.log('[oracle] Extracted reasoning_content length:', reasoning_content.length);
      }
    } catch (e) {
      console.error("DeepSeek response failed:", e);
      throw e;
    }
    const text = extractAnswer(structuredResponse, rawOutput);

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
