/**
 * reconciliation.ts — Evening reconciliation response handler.
 * Obsługuje: zapis odpowiedzi wieczornej, evening extraction (AI parse),
 *            zapis first_90_protected do kolumny DB,
 *            uruchomienie planning session po zakończeniu reconciliation.
 */

import { runRealityAdversary } from '../_utils/adversary.ts';
import { safeSendTelegram } from '../_utils/helpers.ts';

export async function handleReconciliation(
  reconciliationId: string,
  cleanText: string,
  streamRecordId: string | null,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
  supabaseUrl: string,
  supabaseKey: string,
  userId: string,
  reconciliationDate: string
): Promise<void> {
  const dayScore = extractDayScore(cleanText);
  const { error: reconciliationUpdateError } = await supabase
    .from('daily_reconciliations')
    .update({
      status: 'answered',
      user_response: cleanText,
      parsed_response: {
        raw_response: cleanText,
        stream_record_id: streamRecordId,
        parser_version: 'telegram_edge_v1'
      },
      day_score: dayScore,
      answered_at: new Date().toISOString()
    })
    .eq('id', reconciliationId);

  if (reconciliationUpdateError) {
    console.error('[reconciliation] update failed:', reconciliationUpdateError);
    return;
  }

  // Evening extraction
  let eveningExtraction: any = null;
  try {
    const extractRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        temperature: 0.1,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `Z odpowiedzi użytkownika wyodrębnij dane wg nowej doktryny. Odpowiedz TYLKO poprawnym JSON bez markdown:\n{"production_artifact_done":true,"artifact":"nazwa artefaktu który powstał lub null","first_90_protected":true,"phone_first":false,"tension_action_result":"done|skipped|partial|null","analysis_substitution":[],"tomorrow_first_artifact":"nazwa pierwszego artefaktu jutra lub null","micro_friction":[]}\n\nLegenda:\n- production_artifact_done: czy jakiś artefakt fizycznie powstał (plik, mail, kod, nagranie)\n- artifact: jak się nazywa ten artefakt\n- first_90_protected: czy pierwsze 90 min było bez scrolla/YT/AI\n- phone_first: czy telefon był pierwszym działaniem po wstaniu\n- tension_action_result: czy ruch napięciowy się odbył\n- analysis_substitution: lista momentów kiedy analiza zastąpiła działanie\n- tomorrow_first_artifact: co ma istnieć jutro po pierwszym bloku\n- micro_friction: drobne tarcia behawioralne\n\nODPOWIEDŹ UŻYTKOWNIKA:\n${cleanText.substring(0, 800)}`
        }]
      })
    });
    if (extractRes.ok) {
      const extractData = await extractRes.json().catch(() => null);
      const rawExtract = extractData?.choices?.[0]?.message?.content || '';
      const jsonMatch = rawExtract.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        eveningExtraction = JSON.parse(jsonMatch[0]);
        await supabase.from('daily_reconciliations')
          .update({ evening_extraction: eveningExtraction })
          .eq('id', reconciliationId);
        if (typeof eveningExtraction.first_90_protected === 'boolean') {
          await supabase.from('daily_reconciliations')
            .update({ first_90_protected: eveningExtraction.first_90_protected })
            .eq('id', reconciliationId);
        }
      }
    }
  } catch (extractErr) {
    console.warn('[reconciliation] evening extraction failed:', extractErr);
  }

  // --- Reality Adversary ---
  let adversaryOutput: import('../_utils/adversary.ts').AdversaryResult | null = null;
  try {
    const yesterdayStr = (() => {
      const d = new Date(reconciliationDate + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().split('T')[0];
    })();
    const cutoff72h = new Date(Date.now() - 72 * 3600 * 1000).toISOString();

    const [planRes, streamRes] = await Promise.all([
      supabase
        .from('daily_reconciliations')
        .select('planning_summary')
        .eq('user_id', userId)
        .eq('date', yesterdayStr)
        .not('planning_summary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('vanguard_stream')
        .select('content, created_at')
        .eq('user_id', userId)
        .gte('created_at', cutoff72h)
        .order('created_at', { ascending: false })
        .limit(30)
    ]);

    const yesterdayPlan = planRes.data?.planning_summary ?? null;
    const stream72h = streamRes.data ?? [];
    adversaryOutput = await runRealityAdversary(yesterdayPlan, stream72h, deepseekApiKey);
  } catch (adversaryErr) {
    console.warn('[reconciliation] adversary failed (non-fatal):', adversaryErr);
  }

  // --- 1. Construct unified Bridge Message ---
  try {
    const first90Str = eveningExtraction?.first_90_protected ? "chronione" : "przerwane stymulacją";
    const artifactStr = eveningExtraction?.artifact && eveningExtraction.artifact !== "null"
      ? eveningExtraction.artifact
      : "brak";
    
    const tensionStr = eveningExtraction?.tension_action_result === "done" 
      ? "zrobiony" 
      : eveningExtraction?.tension_action_result === "skipped"
        ? "pominięty"
        : "brak";

    let driftType = "brak";
    if (eveningExtraction?.analysis_substitution && eveningExtraction.analysis_substitution.length > 0) {
      driftType = "analiza zamiast działania";
    } else if (eveningExtraction?.phone_first) {
      driftType = "telefon rano";
    }

    // Determine tomorrow's artifact & tension action proposal
    let tomorrowArtifact = eveningExtraction?.tomorrow_first_artifact || null;
    let tomorrowMinimum = "zdefiniuj minimum";
    let tomorrowStart = "08:45"; // Default start time
    let tomorrowTension = "zdefiniuj ruch";
    let tomorrowTensionMin = "zdefiniuj minimum";

    if (artifactStr === "brak" && !tomorrowArtifact) {
      // If no artifact was built today, auto-propose first block based on reality adversary or templates
      tomorrowArtifact = adversaryOutput?.recommended_tension_action?.action || "Wykonanie 3 telefonów i notatka po każdym";
      tomorrowMinimum = adversaryOutput?.recommended_tension_action?.minimum_version || "1 telefon";
      tomorrowStart = "08:45";
    } else if (adversaryOutput?.recommended_tension_action?.action) {
      tomorrowTension = adversaryOutput.recommended_tension_action.action;
      tomorrowTensionMin = adversaryOutput.recommended_tension_action.minimum_version || "zdefiniuj minimum";
    }

    const promptMissingArtifact = !tomorrowArtifact || tomorrowArtifact === "null";

    // Build the message text
    let bridgeText = `✅ Reconciliation zapisane.

Fakty dnia:
- Artefakt: ${artifactStr}.
- First 90: ${first90Str}.
- Tension action: ${tensionStr}.
- Drift: ${driftType}.

Jutro nie zaczynamy od planowania.
Jutro nie definiujemy całego dnia.
Definiujemy pierwszy ruch, który stabilizuje resztę.`;

    if (promptMissingArtifact) {
      bridgeText += `\n\n⚠️ Brakuje pierwszego artefaktu na jutro. Co ma istnieć w świecie po pierwszym bloku?`;
    } else {
      bridgeText += `\n\nPierwszy artefakt:
→ ${tomorrowArtifact}

Minimum:
→ ${tomorrowMinimum}

Start:
→ ${tomorrowStart}

Po tym wracasz do reszty dnia normalnie.

Potwierdzasz?`;
    }

    // Compute tomorrow's date to put it directly in the draft plan
    const tomorrowWarsawDateStr = (() => {
      const d = new Date(reconciliationDate + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().split('T')[0];
    })();

    const planningDraft = {
      target_date: tomorrowWarsawDateStr,
      date: tomorrowWarsawDateStr,
      day_mode: "work",
      top3: [tomorrowArtifact || "Pierwszy blok roboczy", "Uporządkowanie zadań", "Ruch napięciowy"],
      one_clear_move: tomorrowArtifact || "Dokończenie pierwszego bloku",
      first_move_morning: `${tomorrowStart} - start pierwszego bloku na: ${tomorrowArtifact}`,
      morning_activation: {
        first_10_minutes: "Brak telefonu, szklanka wody, start bloku",
        phone_risk: true,
        anti_phone_instruction: "Telefon zostaje w drugim pokoju."
      },
      biggest_risk: "opóźnienie startu bloku",
      counterplan: "telefon off do 9:30",
      urgent_items: [],
      not_doing: [],
      minimum_viable_day: tomorrowMinimum,
      confidence: "high",
      open_loops: [],
      energy_state: "średnia",
      reconciliation_notes: `Dzisiejszy dryf: ${driftType}. Artefakt: ${artifactStr}.`,
      adversary_note: adversaryOutput?.biggest_inconsistency || "Brak głębszego rozjazdu.",
      tension_action: {
        action: tomorrowTension,
        why_it_matters: adversaryOutput?.recommended_tension_action?.why_it_matters || "Przełamanie oporu",
        minimum_version: tomorrowTensionMin,
        due_time: "14:00",
        verification: "self",
        status: "planned"
      },
      production_artifact: {
        artifact: tomorrowArtifact,
        definition_of_done: "Fizycznie istniejący rezultat (sent/written/called)",
        external_reality: "sent",
        minimum_version: tomorrowMinimum,
        deadline: "10:30",
        status: "planned"
      },
      morning_dopamine_state: {
        phone_first: false,
        first_90_protected: true,
        stimulation_risk: "medium",
        anti_drift_instruction: "Wstań i dotknij komputera przed telefonem."
      },
      weekly_exposure: {
        action: "Rozmowa/kontakt z rynkiem",
        status: "planned"
      }
    };

    const initialHistory = [
      { role: 'user', content: cleanText },
      { role: 'assistant', content: JSON.stringify(planningDraft) }
    ];

    await supabase.from('daily_reconciliations').update({
      planning_status: 'active',
      planning_history: initialHistory
    }).eq('id', reconciliationId);

    // Send message with options/buttons if artifact is ready, or simple keyboard prompt if missing
    const replyMarkup = promptMissingArtifact ? undefined : {
      inline_keyboard: [
        [
          { text: '✅ Tak', callback_data: 'planning_confirm_tak' },
          { text: '🔧 Zmień', callback_data: 'planning_change_request' },
          { text: '📉 Minimum', callback_data: 'planning_show_minimum' }
        ]
      ]
    };

    await safeSendTelegram(chatId, bridgeText, telegramToken, {
      reply_markup: replyMarkup,
      disable_notification: false
    });

    console.log('[reconciliation] planning session started (bridge message sent) for:', reconciliationId);
  } catch (planErr) {
    console.error('[reconciliation] planning session trigger error:', planErr);
  }
}

function extractDayScore(text: string): number | null {
  const normalized = text.toLowerCase();
  const explicit = normalized.match(/(?:ocena dnia|dzie[nń]\s+na|oceniam(?:\s+dzie[nń])?)\D*([1-5])(?:\s*\/\s*5)?/i);
  if (explicit?.[1]) return Number(explicit[1]);
  const numberedAnswer = normalized.match(/(?:^|\n|\s)4[).\:-]\s*([1-5])(?:\s*\/\s*5)?/i);
  if (numberedAnswer?.[1]) return Number(numberedAnswer[1]);
  return null;
}
