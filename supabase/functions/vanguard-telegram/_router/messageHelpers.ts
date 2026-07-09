import type { TelegramRouterContext } from "./config.ts";
import { getEmbedding } from "../../_shared/openai.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { getWarsawDateString, getWarsawDayBoundaries } from "../../_shared/time.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { logAuditEvent } from "../../_shared/audit.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import { sendChatAction } from "../../_shared/telegram.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";
import {
  handleTodoCommand,
  handleKeepCommand,
  handlePosilekCommand,
} from "./commands.ts";

/**
 * Handles ForceReply prompts based on prefix check.
 * Returns true if the message was handled (meaning execution should stop), false otherwise.
 */
export async function handleForceReplyReply(
  promptText: string,
  text: string,
  chatId: number,
  ctx: TelegramRouterContext,
): Promise<boolean> {
  const { supabase, telegramToken, deepseekApiKey, supabaseUrl, supabaseServiceRoleKey, vanguardUserId } = ctx;

  if (promptText.includes("Zapis Lenie")) {
    const { handleLenieCommand } = await import("./commands.ts");
    await handleLenieCommand(`/lenie ${text}`, chatId, telegramToken, supabase, vanguardUserId);
    return true;
  }
  if (promptText.includes("Zapis postu")) {
    const { handlePostCommand } = await import("./commands.ts");
    await handlePostCommand(`/post ${text}`, chatId, telegramToken, supabase, vanguardUserId);
    return true;
  }
  if (promptText.includes("Zadaj pytanie Wyroczni")) {
    // Falls through to normal flow with modified text (? prefix)
    return false;
  }
  if (promptText.includes("Wpisz poprawkę do wiedzy")) {
    // Falls through to normal flow with modified text (poprawka: prefix)
    return false;
  }
  if (promptText.includes("Nowe zadanie")) {
    await handleTodoCommand(text, chatId, telegramToken, supabase, vanguardUserId, deepseekApiKey);
    return true;
  }
  if (promptText.includes("Vanguard Keep")) {
    await handleKeepCommand(text, chatId, telegramToken, supabase, vanguardUserId, false);
    return true;
  }
  if (promptText.includes("Co zjadłeś?")) {
    await handlePosilekCommand(text, chatId, telegramToken, supabase, vanguardUserId, deepseekApiKey, supabaseUrl, supabaseServiceRoleKey);
    return true;
  }
  if (promptText.includes("Zapisano (")) {
    const { handleMealCorrection } = await import("../_handlers/foodCorrection.ts");
    const handled = await handleMealCorrection(promptText, text, vanguardUserId, supabase, telegramToken, chatId, deepseekApiKey);
    if (handled) return true;
  }
  if (promptText.includes("Pytanie pogłębiające")) {
    const { handleClarificationReply } = await import("../_handlers/clarification.ts");
    const handled = await handleClarificationReply(promptText, text, ctx, chatId);
    if (handled) return true;
  }
  return false;
}

/**
 * Checks idempotency for incoming messages to prevent double processing.
 */
export async function checkIdempotency(
  messageId: number,
  chatId: number,
  ctx: TelegramRouterContext,
  tryResumeReconciliation: (messageId: number, chatId: number, ctx: any) => Promise<boolean>,
): Promise<{ exists: boolean; shouldStop: boolean }> {
  const { supabase } = ctx;
  try {
    const { data: existing, error: existErr } = await supabase
      .from('vanguard_stream')
      .select('id, content, metadata')
      .eq('metadata->>telegram_message_id', messageId.toString())
      .maybeSingle();

    if (existErr) {
      console.error('[telegram] Idempotency DB check returned error:', existErr);
    }

    if (existing) {
      const reconId = (existing.metadata as { reconciliation_id?: string } | null)?.reconciliation_id;
      if (reconId && existing.content) {
        const { data: recon } = await supabase
          .from('daily_reconciliations')
          .select('id, date, status')
          .eq('id', reconId)
          .maybeSingle();
        if (recon?.status === 'sent') {
          const resumed = await tryResumeReconciliation(messageId, chatId, ctx);
          return { exists: true, shouldStop: resumed };
        }
      }
      return { exists: true, shouldStop: true };
    }
  } catch (err) {
    await logCriticalError({
      area: 'telegram-messages',
      error: err,
      message: 'Idempotency check failed',
    });
  }
  return { exists: false, shouldStop: false };
}

/**
 * Saves incoming message to vanguard_stream, computing OpenAI embedding and extracting emotions via DeepSeek.
 */
export async function insertStreamRecord(
  cleanText: string,
  mode: string,
  isVoice: boolean,
  voiceDurationSec: number,
  voiceWpm: number | null,
  pendingReconciliation: { id: string; date: string } | null,
  chatId: number,
  messageId: number,
  ctx: TelegramRouterContext,
): Promise<{ streamRecordId: string | null; streamSaveFailed: boolean }> {
  const { supabase, openAiKey, deepseekApiKey, vanguardUserId } = ctx;
  const skipStreamEnrichment = mode === 'daily_reconciliation_response' || !!pendingReconciliation;

  let streamEmbedding = null;
  let emotionData: { valence: number; arousal: number; state: string; energy_level?: number; stress_level?: number } | null = null;
  let streamSaveFailed = false;
  let streamRecordId: string | null = null;

  if (!skipStreamEnrichment && cleanText.trim()) {
    try {
      const [embedRes, emotionRes] = await Promise.all([
        getEmbedding(cleanText, openAiKey),
        deepseekChat({
          apiKey: deepseekApiKey,
          model: 'deepseek-v4-flash',
          temperature: 0.1,
          maxTokens: 100,
          responseFormat: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: `Oceń emocje w tekście. Odpowiedz TYLKO JSON: {"valence":0.0,"arousal":0.0,"energy_level":3,"stress_level":3,"state":"nazwa"}\nvalence: -1.0(negatywny)→1.0(pozytywny), arousal: 0.0(spokojny)→1.0(pobudzony), energy_level: 1(wyczerpanie)→5(wysoka energia/czujność), stress_level: 1(spokój/luz)→5(silny stres/napięcie/frustracja), state: jedno słowo po polsku (Entuzjazm/Frustracja/Spokój/Zmęczenie/Euforia/Złość/Smutek/Determinacja/Stres/Radość/Nuda).\nTEKST: "${cleanText.substring(0, 400)}"`
          }]
        }).catch((e) => {
          console.error('[telegram] Deepseek emotion fetch exception:', e);
          return null;
        })
      ]);

      if (Array.isArray(embedRes) && typeof embedRes[0] === 'number') {
        streamEmbedding = embedRes;
      } else {
        console.warn('[telegram] OpenAI embedding returned empty result');
      }

      if (emotionRes && 'content' in emotionRes) {
        emotionData = parseJsonFromContent(emotionRes.content || '{}') as any;
      }
    } catch (err) {
      await logCriticalError({
        area: 'telegram-messages',
        error: err,
        message: 'Stream embedding or emotion extraction failed',
      });
    }
  }

  const { data: streamInserted, error: streamInsertError } = await supabase.from('vanguard_stream').insert({
    user_id: vanguardUserId,
    source: 'telegram',
    content: cleanText,
    embedding: streamEmbedding,
    metadata: {
      telegram_chat_id: chatId,
      telegram_message_id: messageId,
      mode,
      ...(pendingReconciliation ? { reconciliation_id: pendingReconciliation.id, reconciliation_date: pendingReconciliation.date } : {}),
      ...(isVoice && voiceDurationSec > 0 ? { voice_duration_seconds: voiceDurationSec, voice_wpm: voiceWpm } : {}),
      ...(emotionData ? { emotion: { ...emotionData, from_voice: isVoice } } : {})
    }
  }).select('id').single();

  if (streamInsertError) {
    console.error("[telegram] stream insert failed:", streamInsertError);
    streamSaveFailed = true;
  } else if (streamInserted?.id) {
    streamRecordId = streamInserted.id;
  }

  if (emotionData) {
    console.log(`[telegram] emotion: ${emotionData.state} (v=${emotionData.valence?.toFixed(2)}, a=${emotionData.arousal?.toFixed(2)}) voice=${isVoice}`);
  }

  return { streamRecordId, streamSaveFailed };
}

/**
 * Pulls context, invokes the Vanguard Oracle edge function, logs chat messages and returns the Oracle reply.
 */
export async function queryOracle(
  cleanText: string,
  mode: string,
  chatId: number,
  ctx: TelegramRouterContext,
): Promise<string> {
  const { supabase, telegramToken, deepseekApiKey, vanguardUserId, supabaseUrl, supabaseServiceRoleKey } = ctx;

  await sendChatAction(telegramToken, chatId, "typing", { direct: true });

  const { data: historyData } = await supabase.from('ai_chat_messages')
    .select('role, content').eq('user_id', vanguardUserId)
    .order('created_at', { ascending: false }).limit(40);

  const oracleHistory = (historyData || []).reverse();

  const todayWarsawDate = getWarsawDateString();
  const worldState = await fetchWorldState(supabase, vanguardUserId, todayWarsawDate).catch((e) => {
    console.error("[telegram] fetchWorldState failed, fallback to empty:", e);
    return null;
  });

  const oura = worldState?.biometrics?.oura_history?.[0] || null;
  const stateVector = worldState ? {
    biometrics: {
      hrv_avg: worldState.biometrics.hrv_avg,
      sleep_hours: worldState.biometrics.sleep_hours,
      oura_last_night: oura ? {
        date: oura.date,
        bedtime: oura.bedtime_timestamp,
        sleep_hours: oura.total_sleep_hours,
        readiness: oura.readiness_score,
        hrv: oura.hrv_avg,
        rhr: oura.rhr_avg,
        deep_sleep_hours: oura.deep_sleep_hours,
        rem_sleep_hours: oura.rem_sleep_hours,
        sleep_efficiency: oura.sleep_efficiency,
        latency_minutes: oura.latency_minutes,
        sleep_data_status: oura.date === todayWarsawDate ? 'synced' : 'pending'
      } : { sleep_data_status: 'pending' }
    },
    nutrition: { calories_today: worldState.nutrition?.calories_today || 0 },
    physical: { last_workout: worldState.training?.last_training_date || 'Brak danych' },
    discipline: { today_wins: 'Nie ustawiono celów' }
  } : {
    biometrics: { sleep_data_status: 'pending' },
    nutrition: { calories_today: 0 },
    physical: { last_workout: 'Brak danych' },
    discipline: { today_wins: 'Nie ustawiono celów' }
  };

  // 2. Równolegle do query: rezolucja encji z cleanText (NLU extraction + Tier 1 & Tier 2)
  let resolvedClaimsContext = "";
  try {
    const nluPrompt = `Jesteś modułem NLU w Vanguard OS. Wyodrębnij z tekstu użytkownika główne nazwy encji (ludzi, celów, pojęć, projektów), które są tematem zapytania. Zwróć TYLKO JSON w formacie:
{
  "entities": [
    { "name": "Nazwa", "kind": "person" }
  ]
}
Dozwolone kind: "person" | "concept" | "place" | "education" | "role" | "event" | "other".
Jeśli brak takich encji, zwróć pustą tablicę.
Tekst: "${cleanText}"`;

    // P0.1: NLU call with 6 seconds timeout
    const nluRes = await deepseekChat({
      apiKey: deepseekApiKey,
      model: 'deepseek-v4-flash',
      messages: [{ role: 'system', content: nluPrompt }],
      temperature: 0.0,
      responseFormat: { type: 'json_object' },
      timeoutMs: 6000,
      userId: vanguardUserId,
      feature: 'entity-resolution-nlu'
    }).catch((e) => {
      console.error('[telegram] NLU extraction failed or timed out:', e);
      return null;
    });

    let extractedEntities: { name: string, kind: string }[] = [];
    if (nluRes) {
      const parsed = parseJsonFromContent(nluRes.content || '{}');
      if (parsed && Array.isArray(parsed.entities)) {
        extractedEntities = parsed.entities.slice(0, 3); // P1.2: Loop up to 3 entities
      }
    }

    const allResolvedClaims: string[] = [];

    for (const entity of extractedEntities) {
      let resolvedEntityId: string | null = null;
      let resolvedEntityName: string | null = null;

      // Tier 1: Fuzzy match na aliases i canonical names (read-only decision engine)
      const { data: decisionId, error: decisionError } = await supabase.rpc('resolve_entity_decision', {
        p_user_id: vanguardUserId,
        p_name: entity.name,
        p_kind: entity.kind
      });

      if (decisionError) {
        console.error('[telegram] resolve_entity_decision RPC failed:', decisionError);
      }

      if (decisionId) {
        resolvedEntityId = decisionId;
        const { data: entObj } = await supabase.from('entities').select('canonical_name').eq('id', resolvedEntityId).maybeSingle();
        resolvedEntityName = entObj?.canonical_name || entity.name;
        console.log(`[telegram] Tier 1 resolved entity: ${resolvedEntityName} (${resolvedEntityId})`);
      }

      // Tier 2: Vector + LLM verification (tylko gdy Tier 1 nie trafił)
      if (!resolvedEntityId) {
        const { data: candidates, error: candError } = await supabase.rpc('resolve_entity_fuzzy_candidates', {
          p_user_id: vanguardUserId,
          p_name: entity.name,
          p_kind: entity.kind
        });

        if (candError) {
          console.error('[telegram] resolve_entity_fuzzy_candidates failed:', candError);
        }

        if (candidates && candidates.length > 0) {
          // P2.1: Log kind mismatch candidate event if any candidate has a different kind than extracted
          const hasKindMismatch = candidates.some((c: any) => c.kind !== entity.kind);
          if (hasKindMismatch) {
            await logAuditEvent({
              eventType: 'entity_kind_mismatch_candidate',
              severity: 'info',
              message: `Tier 2 candidate list has kind mismatch for entity "${entity.name}" (extracted kind: ${entity.kind})`,
              userId: vanguardUserId,
              metadata: { name: entity.name, extracted_kind: entity.kind, candidates }
            });
          }

          const candidateListStr = candidates.map((c: any) => `- ID: ${c.entity_id}, Name: ${c.canonical_name}, Alias: ${c.alias}, Kind: ${c.kind}`).join('\n');
          const tier2Prompt = `Jesteś modułem weryfikacji encji w Vanguard OS.
Użytkownik wspomniał o: "${entity.name}" (kind: ${entity.kind}).
W bazie danych znaleziono następujących kandydatów:
${candidateListStr}

Czy nazwa "${entity.name}" odnosi się semantycznie do któregoś z powyższych kandydatów?
Odpowiedz TYLKO JSON:
{
  "matched_entity_id": "UUID pasującego kandydata LUB null jeśli brak dopasowania lub brak pewności"
}`;

          // P0.1: Tier 2 call with 6 seconds timeout
          const tier2Res = await deepseekChat({
            apiKey: deepseekApiKey,
            model: 'deepseek-v4-flash',
            messages: [{ role: 'system', content: tier2Prompt }],
            temperature: 0.0,
            responseFormat: { type: 'json_object' },
            timeoutMs: 6000,
            userId: vanguardUserId,
            feature: 'entity-resolution-tier2'
          }).catch(async (e) => {
            console.error('[telegram] Tier 2 LLM verification failed or timed out:', e);
            // P2.1: Log tier 2 LLM failed
            await logAuditEvent({
              eventType: 'entity_tier2_llm_failed',
              severity: 'warning',
              message: `Tier 2 LLM verification failed or timed out for entity "${entity.name}": ${e.message}`,
              userId: vanguardUserId,
              metadata: { name: entity.name, kind: entity.kind, error: e.message }
            });
            return null;
          });

          if (tier2Res) {
            const parsed = parseJsonFromContent(tier2Res.content || '{}');
            if (parsed && parsed.matched_entity_id) {
              resolvedEntityId = parsed.matched_entity_id as string;
              const matchedCand = candidates.find((c: any) => c.entity_id === resolvedEntityId);
              resolvedEntityName = matchedCand ? matchedCand.canonical_name : entity.name;
              console.log(`[telegram] Tier 2 resolved entity: ${resolvedEntityName} (${resolvedEntityId})`);
            }
          }
        }
      }

      // 3. SELECT z public.claims dla rozwiązanej encji (P0.2: limit to top 10 claims by weight)
      if (resolvedEntityId) {
        const { data: claimsData } = await supabase
          .from('claims')
          .select('fact_text, weight, evidence_count, learned_at')
          .eq('user_id', vanguardUserId)
          .eq('status', 'active')
          .or(`subject_id.eq.${resolvedEntityId},object_id.eq.${resolvedEntityId}`)
          .order('weight', { ascending: false })
          .limit(10);

        if (claimsData && claimsData.length > 0) {
          const entityClaimsStr = `[ZWIĄZANE AKTYWNE CELE I FAKTY DLA ENCI: ${resolvedEntityName}]:\n` +
            claimsData.map((c: any) => `- ${c.fact_text} (waga: ${c.weight || 1.0}, dowody: ${c.evidence_count || 1})`).join('\n');
          allResolvedClaims.push(entityClaimsStr);
        }
      }
    }

    if (allResolvedClaims.length > 0) {
      resolvedClaimsContext = allResolvedClaims.join('\n\n');
    }
  } catch (err) {
    console.error('[telegram] Entity resolution layer failed:', err);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let data: any = null;
  let error: any = null;
  try {
    const oracleRes = await fetch(`${supabaseUrl}/functions/v1/vanguard-oracle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceRoleKey}`, 'apikey': supabaseServiceRoleKey },
      body: JSON.stringify({
        current_query: cleanText, user_id: vanguardUserId, state_vector: stateVector,
        mode: mode === 'report' ? 'mirror' : 'chat',
        thinking: mode === 'deep', history: oracleHistory,
        resolved_claims: resolvedClaimsContext
      }),
      signal: controller.signal
    });
    if (!oracleRes.ok) {
      const bodyText = await oracleRes.text().catch(() => '');
      error = new Error(`(Status ${oracleRes.status}) ${bodyText.substring(0, 200)}`);
    } else { data = await oracleRes.json(); }
  } catch (invokeErr) { error = invokeErr; }
  clearTimeout(timeoutId);

  if (error) {
    console.error("Oracle Invoke Error:", error);
    let errorDetail = error.message;
    if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
      errorDetail = "Przekroczono czas oczekiwania na Wyrocznię (timeout). Model DeepSeek Reasoner może być obecnie przeciążony.";
    }
    return `⚠️ Oracle Error: ${errorDetail}`;
  }

  let raw = (data?.text || "") as string;
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!raw) {
    console.error(`[telegram] oracle returned empty text — data keys: ${data ? Object.keys(data).join(',') : 'null'}`);
    return "⚠️ Oracle: pusta odpowiedź modelu. Spróbuj jeszcze raz.";
  }

  // 4. Save proposed claims to audit_events and populate ctx.resolvedClaims
  if (data?.claims && Array.isArray(data.claims) && data.claims.length > 0) {
    const pendingClaimsList: { id: string; text: string }[] = [];
    for (const claim of data.claims) {
      if (claim && claim.text) {
        const { data: auditEvent, error: auditError } = await supabase
          .from("audit_events")
          .insert({
            event_type: "pending_claim_proposal",
            severity: "info",
            message: `Proposed claim: "${claim.text}"`,
            user_id: vanguardUserId,
            metadata: { claim, status: "pending" }
          })
          .select("id")
          .single();

        if (!auditError && auditEvent?.id) {
          pendingClaimsList.push({ id: auditEvent.id, text: claim.text });
        } else {
          console.error("[telegram] Failed to store claim proposal in audit_events:", auditError);
        }
      }
    }
    if (pendingClaimsList.length > 0) {
      (ctx as any).resolvedClaims = pendingClaimsList;
    }
  }

  const chatInsertRes = await supabase.from('ai_chat_messages').insert([
    { user_id: vanguardUserId, role: 'user', content: cleanText },
    { user_id: vanguardUserId, role: 'assistant', content: raw }
  ]);
  if (chatInsertRes.error) {
    console.error('[telegram] ai_chat_messages insert error:', chatInsertRes.error);
  } else {
    const { data: oldMsgs } = await supabase.from('ai_chat_messages').select('id').eq('user_id', vanguardUserId).order('created_at', { ascending: false }).range(200, 9999);
    if (oldMsgs && oldMsgs.length > 0) {
      await supabase.from('ai_chat_messages').delete().in('id', oldMsgs.map((m: any) => m.id))
        .then(({ error: e }: any) => { if (e) console.error('[telegram] ai_chat_messages trim error:', e); });
    }
  }

  return raw;
}
