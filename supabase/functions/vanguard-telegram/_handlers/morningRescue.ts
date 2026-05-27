/**
 * morningRescue.ts — Obsługuje poranne nagranie planu gdy użytkownik nie zaplanował dnia wcześniej.
 *
 * Przepływ:
 * 1. morning-brief wykrywa brak planning_summary → wysyła rescue brief z pytaniem o artefakt
 * 2. Użytkownik nagrywa głosówkę
 * 3. messages.ts przekierowuje do handleMorningRescue
 * 4. Handler ekstraktuje artefakt + ruch napięciowy → zapisuje planning_summary → potwierdza
 */

import { safeSendTelegram } from '../_utils/helpers.ts';
import { createMinimumViablePlan, validatePlanJson } from './planning.ts';
import { logAuditEvent } from '../../_shared/audit.ts';
import { logCriticalError } from '../../_shared/errorLogging.ts';

export async function handleMorningRescue(
  rescueId: string,
  cleanText: string,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
): Promise<void> {
  const now = new Date().toISOString();
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

  // Zaznacz, że użytkownik odpowiedział (zapobiega podwójnemu przetwarzaniu)
  await supabase
    .from('daily_reconciliations')
    .update({
      morning_clicked_at: now,
      status: 'answered',
      answered_at: now,
    })
    .eq('id', rescueId);

  // Ekstrakcja przez LLM — bogatszy prompt ratunkowy (A2)
  let extracted: {
    production_artifact?: { artifact?: string; minimum_version?: string };
    tension_action?: { action?: string; minimum_version?: string };
    one_clear_move?: string;
    energy_state?: string;
  } | null = null;

  try {
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${deepseekApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        temperature: 0.1,
        max_tokens: 280,
        messages: [{
          role: 'user',
          content: `Jesteś w trybie RATUNKOWYM. Użytkownik nagrywa szybki plan na DZISIAJ (nie na jutro).

Twoim zadaniem jest wyciągnąć z wypowiedzi:
- Co konkretnie chce stworzyć/zrobić dziś (production_artifact)
- Jaki jest najważniejszy niewygodny ruch, który odkłada (tension_action)
- Jaki jest pierwszy konkretny krok rano (one_clear_move)

Zwróć TYLKO poprawny JSON:

{
  "production_artifact": {
    "artifact": "konkretna rzecz, którą chce dziś zrobić/wytworzyć",
    "minimum_version": "najmniejsza wersja, która i tak będzie sukcesem"
  },
  "tension_action": {
    "action": "ruch napięciowy — coś niewygodnego, ale ważnego",
    "minimum_version": "co wystarczy, żeby uznać to za zrobione"
  },
  "one_clear_move": "pierwsza konkretna rzecz, którą powinien zrobić rano",
  "energy_state": "wysoka | średnia | niska"
}

Jeśli nie ma jasnego artefaktu lub ruchu napięciowego — daj null w tych polach.

WYPOWIEDŹ UŻYTKOWNIKA:
${cleanText.substring(0, 700)}`
        }]
      })
    });

    if (dsRes.ok) {
      const raw = (await dsRes.json())?.choices?.[0]?.message?.content || '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    await logCriticalError({
      area: 'morning-rescue',
      error: err,
      message: 'DeepSeek extraction failed in morning rescue',
      metadata: { nonFatal: true },
    });
  }

  // Mapowanie wyciągniętych danych na strukturę planu
  const artifactName = extracted?.production_artifact?.artifact ?? cleanText.substring(0, 80).trim();
  const artifactMinVersion = extracted?.production_artifact?.minimum_version ?? artifactName;

  const tensionAction = extracted?.tension_action?.action ?? null;
  const tensionMinVersion = extracted?.tension_action?.minimum_version ?? null;

  const oneClearMove = extracted?.one_clear_move ?? artifactName;

  // Budujemy kandydata planu (bogatsza wersja)
  const base = createMinimumViablePlan(todayStr);
  const candidatePlan = {
    ...base,
    mode: 'rescue',
    one_clear_move: oneClearMove,
    production_artifact: {
      artifact: artifactName,
      minimum_version: artifactMinVersion,
      status: 'planned',
    },
    tension_action: tensionAction
      ? {
          action: tensionAction,
          minimum_version: tensionMinVersion,
          status: 'planned',
        }
      : base.tension_action,
    top3: [artifactName, tensionAction].filter(Boolean),
    energy_state: extracted?.energy_state ?? null,
    plan_prompt_version: '2026-05-28',
    plan_quality: 'rescue',
  };

  // === Walidacja — używamy tej samej co w normalnym planowaniu ===
  const validation = validatePlanJson(candidatePlan);

  if (!validation.valid) {
    // Plan z ratowania jest za słaby — nie zapisujemy byle czego
    await logAuditEvent({
      eventType: 'rescue_plan_validation_failed',
      severity: 'warning',
      message: 'Rescue plan nie przeszedł walidacji',
      relatedTable: 'daily_reconciliations',
      relatedId: rescueId,
      metadata: { missing_fields: validation.missing, raw_text: cleanText.substring(0, 300) }
    });

    await safeSendTelegram(
      chatId,
      `Plan z ratowania jest niekompletny.\n\nBrakuje: ${validation.missing.join(', ')}.\n\nPodaj proszę konkretny artefakt lub ruch napięciowy, który chcesz zrobić.`,
      telegramToken
    );
    return;
  }

  // Zapisujemy plan (teraz z większą pewnością)
  const { error: updateErr } = await supabase
    .from('daily_reconciliations')
    .update({ planning_summary: candidatePlan })
    .eq('id', rescueId);

  if (updateErr) {
    console.error('[morningRescue] update failed:', updateErr);
    await safeSendTelegram(chatId, '❌ Nie udało się zapisać planu. Spróbuj jeszcze raz.', telegramToken);
    return;
  }

  await logAuditEvent({
    eventType: 'rescue_plan_saved',
    severity: 'info',
    message: 'Zapisano plan ratunkowy',
    relatedTable: 'daily_reconciliations',
    relatedId: rescueId,
    metadata: { plan_quality: 'rescue' }
  });

  const taLine = tensionAction ? `\n⚡ Ruch: ${tensionAction}` : '';
  await safeSendTelegram(
    chatId,
    `✅ Plan ratunkowy zapisany.\n\n→ ${artifactName}${taLine}\n\nStart dnia — telefon nie jest pierwszy.`,
    telegramToken
  );

  console.log(`[morningRescue] saved rescueId=${rescueId} artifact="${artifactName}"`);
}
