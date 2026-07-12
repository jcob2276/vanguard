import type { TelegramRouterContext } from "./config.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { sendChatAction } from "../../_shared/telegram.ts";
import { fetchWorldState } from "../../_shared/worldState.ts";
import { logAuditEvent } from "../../_shared/audit.ts";

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
    console.error("[telegram] fetchWorldState failed:", e);
    return null;
  });

  const oura = worldState?.biometrics?.oura_history?.[0] || null;
  const stateVector = worldState ? {
    biometrics: {
      hrv_avg: worldState.biometrics.hrv_avg,
      sleep_hours: worldState.biometrics.sleep_hours,
      oura_last_night: oura ? {
        date: oura.date, bedtime: oura.bedtime_timestamp, sleep_hours: oura.total_sleep_hours,
        readiness: oura.readiness_score, hrv: oura.hrv_avg, rhr: oura.rhr_avg,
        deep_sleep_hours: oura.deep_sleep_hours, rem_sleep_hours: oura.rem_sleep_hours,
        sleep_efficiency: oura.sleep_efficiency, latency_minutes: oura.latency_minutes,
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

  // Entity resolution
  let resolvedClaimsContext = "";
  try {
    const nluPrompt = `Jesteś modułem NLU w Vanguard OS. Wyodrębnij z tekstu główne nazwy encji (ludzi, celów, pojęć, projektów). Zwróć TYLKO JSON:
{"entities": [{"name": "Nazwa", "kind": "person"}]}
Dozwolone kind: "person" | "concept" | "place" | "education" | "role" | "event" | "other".
Tekst: "${cleanText}"`;

    const nluRes = await deepseekChat({
      apiKey: deepseekApiKey, model: 'deepseek-v4-flash',
      messages: [{ role: 'system', content: nluPrompt }],
      temperature: 0.0, responseFormat: { type: 'json_object' }, timeoutMs: 6000,
      userId: vanguardUserId, feature: 'entity-resolution-nlu'
    }).catch((e) => { console.error('[telegram] NLU extraction failed:', e); return null; });

    let extractedEntities: { name: string, kind: string }[] = [];
    if (nluRes) {
      const parsed = parseJsonFromContent(nluRes.content || '{}');
      if (parsed && Array.isArray(parsed.entities)) extractedEntities = parsed.entities.slice(0, 3);
    }

    const allResolvedClaims: string[] = [];
    for (const entity of extractedEntities) {
      let resolvedEntityId: string | null = null;
      let resolvedEntityName: string | null = null;

      const { data: decisionId, error: decisionError } = await supabase.rpc('resolve_entity_decision', {
        p_user_id: vanguardUserId, p_name: entity.name, p_kind: entity.kind
      });
      if (decisionError) console.error('[telegram] resolve_entity_decision failed:', decisionError);

      if (decisionId) {
        resolvedEntityId = decisionId;
        const { data: entObj } = await supabase.from('entities').select('canonical_name').eq('id', resolvedEntityId).maybeSingle();
        resolvedEntityName = entObj?.canonical_name || entity.name;
      }

      if (!resolvedEntityId) {
        const { data: candidates } = await supabase.rpc('resolve_entity_fuzzy_candidates', {
          p_user_id: vanguardUserId, p_name: entity.name, p_kind: entity.kind
        });
        if (candidates && candidates.length > 0) {
          const candidateListStr = candidates.map((c: any) => `- ID: ${c.entity_id}, Name: ${c.canonical_name}, Alias: ${c.alias}, Kind: ${c.kind}`).join('\n');
          const tier2Res = await deepseekChat({
            apiKey: deepseekApiKey, model: 'deepseek-v4-flash',
            messages: [{ role: 'system', content: `Użytkownik wspomniał o: "${entity.name}" (kind: ${entity.kind}).\nKandydaci:\n${candidateListStr}\nCzy nazwa odnosi się do któregoś? Odpowiedz JSON: {"matched_entity_id": "UUID lub null"}` }],
            temperature: 0.0, responseFormat: { type: 'json_object' }, timeoutMs: 6000,
            userId: vanguardUserId, feature: 'entity-resolution-tier2'
          }).catch(async (e) => { console.error('[telegram] Tier 2 failed:', e); return null; });

          if (tier2Res) {
            const parsed = parseJsonFromContent(tier2Res.content || '{}');
            if (parsed && parsed.matched_entity_id) {
              resolvedEntityId = parsed.matched_entity_id as string;
              const matchedCand = candidates.find((c: any) => c.entity_id === resolvedEntityId);
              resolvedEntityName = matchedCand ? matchedCand.canonical_name : entity.name;
            }
          }
        }
      }

      if (resolvedEntityId) {
        const { data: claimsData } = await supabase.from('claims')
          .select('fact_text, weight, evidence_count, learned_at')
          .eq('user_id', vanguardUserId).eq('status', 'active')
          .or(`subject_id.eq.${resolvedEntityId},object_id.eq.${resolvedEntityId}`)
          .order('weight', { ascending: false }).limit(10);
        if (claimsData && claimsData.length > 0) {
          allResolvedClaims.push(`[ZWIĄZANE AKTYWNE CELE I FAKTY DLA ENCI: ${resolvedEntityName}]:\n` + claimsData.map((c: any) => `- ${c.fact_text} (waga: ${c.weight || 1.0}, dowody: ${c.evidence_count || 1})`).join('\n'));
        }
      }
    }
    if (allResolvedClaims.length > 0) resolvedClaimsContext = allResolvedClaims.join('\n\n');
  } catch (err) { console.error('[telegram] Entity resolution failed:', err); }

  // Oracle call
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

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
      errorDetail = "Przekroczono czas oczekiwania na Wyrocznię (timeout).";
    }
    return `⚠️ Oracle Error: ${errorDetail}`;
  }

  let raw = (data?.text || "") as string;
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!raw) return "⚠️ Oracle: pusta odpowiedź modelu. Spróbuj jeszcze raz.";

  // Save proposed claims
  if (data?.claims && Array.isArray(data.claims) && data.claims.length > 0) {
    const pendingClaimsList: { id: string; text: string }[] = [];
    for (const claim of data.claims) {
      if (claim && claim.text) {
        const { data: auditEvent, error: auditError } = await supabase.from("audit_events").insert({
          event_type: "pending_claim_proposal", severity: "info",
          message: `Proposed claim: "${claim.text}"`, user_id: vanguardUserId,
          metadata: { claim, status: "pending" }
        }).select("id").single();
        if (!auditError && auditEvent?.id) pendingClaimsList.push({ id: auditEvent.id, text: claim.text });
      }
    }
    if (pendingClaimsList.length > 0) (ctx as any).resolvedClaims = pendingClaimsList;
  }

  // Save chat messages
  const chatInsertRes = await supabase.from('ai_chat_messages').insert([
    { user_id: vanguardUserId, role: 'user', content: cleanText },
    { user_id: vanguardUserId, role: 'assistant', content: raw }
  ]);
  if (chatInsertRes.error) console.error('[telegram] ai_chat_messages insert error:', chatInsertRes.error);
  else {
    const { data: oldMsgs } = await supabase.from('ai_chat_messages').select('id').eq('user_id', vanguardUserId).order('created_at', { ascending: false }).range(200, 9999);
    if (oldMsgs && oldMsgs.length > 0) {
      await supabase.from('ai_chat_messages').delete().in('id', oldMsgs.map((m: any) => m.id));
    }
  }

  return raw;
}
