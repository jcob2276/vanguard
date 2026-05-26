/**
 * planning.ts — Planning session handler.
 * Obsługuje: routing sesji planowania, odpowiedzi w sesji,
 *            zamknięcie sesji ("koniec"), guardrail production_artifact + tension_action,
 *            generowanie JSON planu i zapis do DB.
 */

import { safeSendTelegram, getWarsawDateStr } from '../_utils/helpers.ts';
import { ackCallback } from '../_utils/callbackAck.ts';

export const PLANNING_END_PHRASES = /^(koniec|done|gotowe|wystarczy|stop|dziękuję|dziekuje|ok dzięki)\b/i;
export const PLANNING_WINDOW_MS = 120 * 60 * 1000; // 2h
export const PLANNING_MAX_ENTRIES = 20; // 10 turns × 2

export type PlanningSession = { id: string; history: any[] };

/**
 * Checks if there is an active planning session and returns it, or null.
 */
export async function getActivePlanningSession(
  supabase: any,
  userId: string
): Promise<(PlanningSession & { date: string; answered_at: string | null; created_at: string }) | null> {
  const { data: activePlanning } = await supabase
    .from('daily_reconciliations')
    .select('id, planning_history, answered_at, created_at, date')
    .eq('user_id', userId)
    .eq('planning_status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activePlanning) return null;

  const sessionStart = activePlanning.answered_at || activePlanning.created_at;
  const ageMs = Date.now() - new Date(sessionStart).getTime();
  const history = (activePlanning.planning_history as any[]) || [];

  if (ageMs <= PLANNING_WINDOW_MS && history.length < PLANNING_MAX_ENTRIES) {
    return { id: activePlanning.id, history, date: activePlanning.date, answered_at: activePlanning.answered_at, created_at: activePlanning.created_at };
  }
  return null;
}

/**
 * Handles planning session closure ("koniec") — generates plan JSON and sends result.
 * Returns the closure confirmation message (caller should set planningEnded = true).
 */
export async function closePlanningSession(
  closureHistory: any[],
  closureId: string,
  reconDate: string,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string
): Promise<void> {
  let telegramText = '✅ Sesja planowania zakończona. Dobrej nocy!';

  try {
    // Compute target date from reconciliation's Warsaw date + 1 day (BUG-01 fix)
    const tomorrowWarsawDate = (() => {
      const d = new Date(reconDate + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().split('T')[0];
    })();

    let planJson: any = null;
    let rawPlan = '';

    // Fast-path: Check if the last assistant message in history is already a valid JSON string (our draft)
    const lastAssistantMsg = [...closureHistory].reverse().find(h => h.role === 'assistant');
    if (lastAssistantMsg && lastAssistantMsg.content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(lastAssistantMsg.content);
        if (parsed?.top3 && parsed?.production_artifact) {
          planJson = parsed;
          rawPlan = lastAssistantMsg.content;
          console.log('[planning] using pre-calculated JSON draft from history');
        }
      } catch (_) {}
    }

    if (!planJson) {
      // Slow-path fallback: call DeepSeek
      const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          temperature: 0.3,
          max_tokens: 1500,
          messages: [
            {
              role: 'system',
              content: 'Jesteś asystentem planowania. Na podstawie sesji planowania wygeneruj plan jutra. Odpowiedz TYLKO poprawnym JSON-em, zero markdown, zero dodatkowego tekstu.'
            },
            ...closureHistory,
            {
              role: 'user',
              content: `Wygeneruj plan na jutro (data: ${tomorrowWarsawDate}). Format JSON:\n{"target_date":"${tomorrowWarsawDate}","date":"${tomorrowWarsawDate}","day_mode":"work|sales|recovery|chaos|weekend|social","top3":["zadanie1","zadanie2","zadanie3"],"one_clear_move":"jeden konkretny ruch który definiuje wygrany dzień — najprostsze zdanie imperatywne","first_move_morning":"kiedy i jak konkretnie — pierwsza akcja rano","morning_activation":{"first_10_minutes":"dokładnie co robisz w pierwszych 10 minutach po wstaniu","phone_risk":true,"anti_phone_instruction":"krótka instrukcja zapobiegająca scrollowaniu rano"},"biggest_risk":"największe ryzyko jutra","counterplan":"jak mu zapobiec","urgent_items":["pilna rzecz lub pusta tablica []"],"not_doing":["co świadomie odpuszczamy lub pusta tablica []"],"minimum_viable_day":"minimalna wersja wygranego dnia — jedno zdanie","confidence":"high|medium|low","open_loops":["rzeczy wiszące w powietrzu lub pusta tablica []"],"energy_state":"wysoka|średnia|niska","reconciliation_notes":"kluczowe obserwacje z dzisiejszego dnia","adversary_note":"co adversary wykrył z 72h — jedno zdanie, tylko fakty, zero psychologizowania","tension_action":{"action":"jeden konkretny ruch napięciowy ustalony w sesji — jedno zdanie imperatywne","why_it_matters":"dlaczego ten ruch — oparte na danych, jedno zdanie","minimum_version":"absolutne minimum tego ruchu — jedno zdanie","due_time":"konkretny czas np. do 14:00","verification":"self","status":"planned"},"production_artifact":{"artifact":"nazwa konkretnego artefaktu który ma powstać po pierwszym bloku — np. 'nagrany moduł', 'wysłany mail', 'opublikowany post'","definition_of_done":"jak wiadomo że jest gotowy — jedno zdanie","external_reality":"sent|deployed|published|called|written|delivered|trained|replied","minimum_version":"absolutne minimum artefaktu — jedno zdanie","deadline":"do kiedy — np. do 10:00","status":"planned"},"morning_dopamine_state":{"phone_first":false,"first_90_protected":true,"stimulation_risk":"low|medium|high","anti_drift_instruction":"jedno zdanie przypominające co robić gdy telefon jest pierwszym impulsem"},"weekly_exposure":{"action":"jaki kontakt z zewnętrzną rzeczywistością w tym tygodniu — np. rozmowa z klientem, demo, prezentacja","status":"planned|done|skipped"}}`
            }
          ]
        })
      });

      if (dsRes.ok) {
        const dsData = await dsRes.json().catch(() => null);
        rawPlan = (dsData?.choices?.[0]?.message?.content || '').trim();
        if (rawPlan) {
          try {
            const jsonMatch = rawPlan.match(/\{[\s\S]*\}/);
            if (jsonMatch) planJson = JSON.parse(jsonMatch[0]);
          } catch (_) {}
        }
      } else {
        console.error('[planning] DeepSeek plan generation failed:', dsRes.status);
      }
    }

    if (planJson) {
      if (planJson.top3) {
        // GUARDRAIL: production_artifact.artifact is required
        if (!planJson?.production_artifact?.artifact) {
          console.warn('[planning] production_artifact missing — reverting to active');
          const revertHistory = [
            ...closureHistory,
            { role: 'user', content: 'koniec' },
            { role: 'assistant', content: 'Brakuje artefaktu na jutro. Co ma istnieć w świecie po pierwszym bloku?' }
          ];
          await supabase.from('daily_reconciliations')
            .update({ planning_status: 'active', planning_history: revertHistory })
            .eq('id', closureId);
          telegramText = 'Brakuje artefaktu na jutro. Co ma istnieć w świecie po pierwszym bloku?';

        // GUARDRAIL: tension_action.action is required
        } else if (!planJson?.tension_action?.action) {
          console.warn('[planning] tension_action missing — reverting to active');
          const revertHistory = [
            ...closureHistory,
            { role: 'user', content: 'koniec' },
            { role: 'assistant', content: 'Brakuje jednego ruchu napięciowego na jutro. Co odkładasz, bo jest niewygodne?' }
          ];
          await supabase.from('daily_reconciliations')
            .update({ planning_status: 'active', planning_history: revertHistory })
            .eq('id', closureId);
          telegramText = 'Brakuje jednego ruchu napięciowego na jutro. Co odkładasz, bo jest niewygodne?';

        } else {
          // All guardrails passed — save plan
          const summaryToSave = { ...planJson, target_date: tomorrowWarsawDate, date: tomorrowWarsawDate };
          const { error: completeErr } = await supabase.from('daily_reconciliations')
            .update({ 
              planning_status: 'completed',
              planning_summary: summaryToSave,
              planning_history: closureHistory
            })
            .eq('id', closureId);
          if (completeErr) console.error('[planning] failed to save atomic plan summary:', completeErr);

          // Format summary message
          const top3 = (planJson.top3 as string[]).map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');
          const urgentSection = (planJson.urgent_items as string[] || []).filter(Boolean).length > 0
            ? `\n\nPilne:\n${(planJson.urgent_items as string[]).map((u: string) => `• ${u}`).join('\n')}` : '';
          const notDoingSection = (planJson.not_doing as string[] || []).filter(Boolean).length > 0
            ? `\n\nNie robimy:\n${(planJson.not_doing as string[]).map((u: string) => `• ${u}`).join('\n')}` : '';
          const openLoopsSection = (planJson.open_loops as string[] || []).filter(Boolean).length > 0
            ? `\n\nOtwarte petle:\n${(planJson.open_loops as string[]).map((u: string) => `• ${u}`).join('\n')}` : '';
          const ta = planJson.tension_action as any;
          const tensionSection = ta?.action
            ? `\n\n⚡ Ruch napięciowy:\n${ta.action}\nMinimum: ${ta.minimum_version || '—'}\nDo: ${ta.due_time || '—'}`
            : '';
          const adversaryNoteSection = planJson.adversary_note ? `\n\n🔍 ${planJson.adversary_note}` : '';
          const oneClearMoveSection = planJson.one_clear_move ? `\n\nDzisiaj dzień wygrywa:\n${planJson.one_clear_move}` : '';
          const dayModeSection = planJson.day_mode ? ` | Tryb: ${planJson.day_mode}` : '';

          telegramText = `Plan jutra zapisany.\n\nFirst move:\n${planJson.first_move_morning || '—'}${oneClearMoveSection}\n\nTop 3:\n${top3}\n\nMinimum viable day:\n${planJson.minimum_viable_day || '—'}\n\nRyzyko: ${planJson.biggest_risk || '—'}\nKontrplan: ${planJson.counterplan || '—'}${tensionSection}${adversaryNoteSection}${urgentSection}${notDoingSection}${openLoopsSection}\n\nEnergia: ${planJson.energy_state || '—'} | Pewnosc: ${planJson.confidence || '—'}${dayModeSection}`;
        }
      } else {
        // JSON parse failed — save raw fallback
        console.warn('[planning] plan JSON parse failed, saving raw');
        const tomorrowWarsawDate2 = (() => {
          const d = new Date(reconDate + 'T12:00:00Z');
          d.setUTCDate(d.getUTCDate() + 1);
          return d.toISOString().split('T')[0];
        })();
        const { error: rawErr } = await supabase.from('daily_reconciliations')
          .update({ 
            planning_status: 'completed',
            planning_summary: { raw: rawPlan, parse_error: true, target_date: tomorrowWarsawDate2 },
            planning_history: closureHistory
          })
          .eq('id', closureId);
        if (rawErr) console.error('[planning] failed to save atomic raw fallback:', rawErr);
        telegramText = rawPlan.length > 4000 ? rawPlan.substring(0, 4000) + '…' : rawPlan;
      }
    } else {
      console.error('[planning] DeepSeek plan generation failed:', dsRes.status);
    }
  } catch (planSummaryErr) {
    console.error('[planning] plan summary error:', planSummaryErr);
  }

  await safeSendTelegram(chatId, telegramText, telegramToken, { disable_notification: false });
}

/**
 * Handles planning callback actions (inline keyboard buttons: Tak, Zmień, Minimum)
 */
export async function handlePlanningCallback(
  callbackData: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
  userId: string
): Promise<void> {
  await ackCallback(telegramToken, callbackId, chatId, messageId);

  // Find the active planning session
  const activeSession = await getActivePlanningSession(supabase, userId);
  if (!activeSession) {
    await safeSendTelegram(chatId, '⚠️ Brak aktywnej sesji planowania.', telegramToken);
    return;
  }

  const { data: rawRecon } = await supabase
    .from('daily_reconciliations')
    .select('id, planning_status, planning_history, date')
    .eq('user_id', userId)
    .eq('id', activeSession.id)
    .maybeSingle();

  if (!rawRecon || rawRecon.planning_status !== 'active') {
    // Idempotency: already completed or processed, do nothing
    console.log('[planning] callback ignored: session already closed/not active', activeSession.id);
    return;
  }

  if (callbackData === 'planning_confirm_tak') {
    // Treat as "koniec/tak" and close the planning session
    await closePlanningSession(
      activeSession.history,
      activeSession.id,
      activeSession.date,
      chatId,
      supabase,
      telegramToken,
      deepseekApiKey
    );
  } else if (callbackData === 'planning_change_request') {
    // Prompt to write change request
    await safeSendTelegram(chatId, '📝 Napisz co chcesz zmienić w planie (np. godzinę, artefakt lub priorytety):', telegramToken);
  } else if (callbackData === 'planning_show_minimum') {
    // Modify active mockPlan in history to minimum, save it, and auto-close session!
    const lastAssistantMsg = [...activeSession.history].reverse().find(h => h.role === 'assistant');
    if (lastAssistantMsg) {
      try {
        const parsed = JSON.parse(lastAssistantMsg.content);
        
        // Mutate parsed to reflect minimum versions
        if (parsed.production_artifact) {
          parsed.production_artifact.artifact = parsed.production_artifact.minimum_version || parsed.production_artifact.artifact;
        }
        if (parsed.tension_action) {
          parsed.tension_action.action = parsed.tension_action.minimum_version || parsed.tension_action.action;
        }
        if (parsed.top3 && parsed.top3.length > 0) {
          parsed.top3[0] = parsed.production_artifact?.artifact || parsed.top3[0];
        }
        parsed.one_clear_move = parsed.production_artifact?.artifact || parsed.one_clear_move;

        // Save mutated JSON back to history
        const updatedHistory = activeSession.history.map(h => {
          if (h === lastAssistantMsg) {
            return { role: 'assistant', content: JSON.stringify(parsed) };
          }
          return h;
        });

        await closePlanningSession(
          updatedHistory,
          activeSession.id,
          activeSession.date,
          chatId,
          supabase,
          telegramToken,
          deepseekApiKey
        );
      } catch (err) {
        console.error('[planning] failed to process planning_show_minimum:', err);
        await safeSendTelegram(chatId, '⚠️ Nie udało się automatycznie zatwierdzić planu minimum.', telegramToken);
      }
    }
  }
}

