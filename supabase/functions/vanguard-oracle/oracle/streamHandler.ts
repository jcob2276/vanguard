import { deepseekStream, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import type { DeepSeekMessage } from "../../_shared/deepseek.ts";
import { corsHeaders } from "../../_shared/supabase.ts";
import { OracleResponseSchema, extractAnswer } from "./responseExtract.ts";
import { logOracleRun, saveClarificationRequest, createPendingAction, applyInsightCardsMutation } from "./mutations.ts";
import { mintRecordFactId } from "../../_shared/mintRecordFactId.ts";

export async function handleStreamingResponse(
  messages: DeepSeekMessage[],
  opts: {
    supabase: any;
    user_id: string;
    current_query: string;
    rag: any;
    thinking: boolean;
    agent_run_mode: string;
    wasCompressed: boolean;
    compressedHistory: any[];
    t0: number;
  }
): Promise<Response> {
  const { supabase, user_id, current_query, rag, thinking, agent_run_mode, wasCompressed, compressedHistory, t0 } = opts;

  console.log(`[oracle] deepseek stream start`, Date.now() - t0);
  const dsResponse = await deepseekStream({
    apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
    ...(thinking ? LLM_TASKS.deep : LLM_TASKS.oracle),
    messages: messages,
    temperature: thinking ? null : 0.7,
    maxTokens: null,
  });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

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
        state_vector: opts.rag?.stateVector || {},
      });

      if (structuredResponse.clarification_request) {
        await saveClarificationRequest(supabase, user_id, structuredResponse.clarification_request);
      }

      if (structuredResponse.schedule_mutation) {
        console.log('[oracle] schedule_mutation emitted:', (structuredResponse.schedule_mutation as Record<string, unknown>)?.action);
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
