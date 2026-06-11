/**
 * reconciliation.ts — Evening reconciliation response handler.
 * Obsługuje: zapis odpowiedzi wieczornej, evening extraction (AI parse),
 *            zapis first_90_protected do kolumny DB,
 *            uruchomienie planning session po zakończeniu reconciliation.
 */

import { runRealityAdversary } from '../_utils/adversary.ts';
import { safeSendTelegram } from '../_utils/helpers.ts';
import { logCriticalError } from '../../_shared/errorLogging.ts';
import { parseReconciliationResponse, type P2ParsedResponse } from '../../_shared/reconciliationParser.ts';
import { detectRecurringBlockers, detectPlanAdherenceGaps, detectMorningProtocolImpact, detectSleepFrictionLink, detectEarlyWarningSignals, detectNarrativeBiometricMismatch, shouldSurfaceInsight, recordBehavioralPattern, markPatternAsShown } from '../../_shared/vanguardPatterns.ts';
import { deepseekChat } from '../../_shared/deepseek.ts';


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
    const { content: rawExtract } = await deepseekChat({
      apiKey: deepseekApiKey,
      model: 'deepseek-v4-flash',
      temperature: 0.1,
      maxTokens: 400,
      messages: [{
        role: 'user',
        content: `Z odpowiedzi użytkownika wyodrębnij dane wg nowej doktryny. Odpowiedz TYLKO poprawnym JSON bez markdown:\n{"production_artifact_done":true,"artifact":"nazwa artefaktu który powstał lub null","first_90_protected":true,"phone_first":false,"tension_action_result":"done|skipped|partial|null","analysis_substitution":[],"tomorrow_first_artifact":"nazwa pierwszego artefaktu jutra lub null","micro_friction":[]}\n\nLegenda:\n- production_artifact_done: czy jakiś artefakt fizycznie powstał (plik, mail, kod, nagranie)\n- artifact: jak się nazywa ten artefakt\n- first_90_protected: czy pierwsze 90 min było bez scrolla/YT/AI\n- phone_first: czy telefon był pierwszym działaniem po wstaniu\n- tension_action_result: czy ruch napięciowy się odbył\n- analysis_substitution: lista momentów kiedy analiza zastąpiła działanie\n- tomorrow_first_artifact: co ma istnieć jutro po pierwszym bloku\n- micro_friction: drobne tarcia behawioralne\n\nODPOWIEDŹ UŻYTKOWNIKA:\n${cleanText.substring(0, 800)}`
      }]
    });
    const jsonMatch = rawExtract.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      eveningExtraction = JSON.parse(jsonMatch[0]);
      const updates: any = {
        evening_extraction: eveningExtraction,
        evening_extraction_version: 'telegram_edge_v1'
      };
      if (typeof eveningExtraction.first_90_protected === 'boolean') {
        updates.first_90_protected = eveningExtraction.first_90_protected;
      }
      await supabase.from('daily_reconciliations')
        .update(updates)
        .eq('id', reconciliationId);
    }
  } catch (extractErr) {
    console.warn('[reconciliation] evening extraction failed:', extractErr);
  }


  // --- Reality Adversary + P2 Parser (parallel) ---
  let adversaryOutput: import('../_utils/adversary.ts').AdversaryResult | null = null;
  let p2Parsed: P2ParsedResponse | null = null;

  const yesterdayStr = (() => {
    const d = new Date(reconciliationDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  const [adversaryResult, p2Result] = await Promise.allSettled([
    // Adversary — needs yesterday's plan + 72h stream
    (async () => {
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
      return runRealityAdversary(yesterdayPlan, stream72h, deepseekApiKey);
    })(),

    // P2 parser — extract structured fields from raw voice response
    parseReconciliationResponse(cleanText, deepseekApiKey),
  ]);

  if (adversaryResult.status === 'fulfilled') {
    adversaryOutput = adversaryResult.value;
  } else {
    console.warn('[reconciliation] adversary failed (non-fatal):', adversaryResult.reason);
  }

  if (p2Result.status === 'fulfilled') {
    p2Parsed = p2Result.value;
    // Persist P2 results (non-blocking — best effort)
    supabase.from('daily_reconciliations')
      .update({
        p2_parsed: p2Parsed,
        p2_parser_version: p2Parsed?.parser_version || null
      })
      .eq('id', reconciliationId)
      .then(({ error }: { error: any }) => {
        if (error) console.warn('[reconciliation] p2_parsed save failed:', error.message);
        else console.log(`[reconciliation] p2_parsed saved: score=${p2Parsed!.day_score} confidence=${p2Parsed!.parse_confidence} review=${p2Parsed!.needs_manual_review}`);
      });
  } else {
    console.warn('[reconciliation] p2 parser failed (non-fatal):', p2Result.reason);
  }

  // === Etap 1: Detekcja powtarzalnych wzorców (S1 + S4) ===
  let recurringBlockerInsights: Awaited<ReturnType<typeof detectRecurringBlockers>> = [];
  let planAdherenceInsights: Awaited<ReturnType<typeof detectPlanAdherenceGaps>> = [];

  if (p2Parsed?.blocker_candidates?.length) {
    try {
      recurringBlockerInsights = await detectRecurringBlockers(supabase, userId, {
        lookbackDays: 21,
        correlationWindowDays: 5,
        minOccurrences: 3,
      });
    } catch (e) {
      console.warn('[reconciliation] detectRecurringBlockers failed (non-fatal):', e);
    }
  }

  // S4 — rozjazd planu z wczoraj vs dzisiejsza rzeczywistość
  try {
    planAdherenceInsights = await detectPlanAdherenceGaps(supabase, userId, yesterdayStr);
  } catch (e) {
    console.warn('[reconciliation] detectPlanAdherenceGaps failed (non-fatal):', e);
  }

  // S2 — wpływ porannego protokołu (first 90 / phone first) na następny dzień
  let morningProtocolInsights: Awaited<ReturnType<typeof detectMorningProtocolImpact>> = [];
  try {
    morningProtocolInsights = await detectMorningProtocolImpact(supabase, userId, { lookbackDays: 25 });
  } catch (e) {
    console.warn('[reconciliation] detectMorningProtocolImpact failed (non-fatal):', e);
  }

  // S3 — sen → następnego dnia dominujący typ tarcia
  let sleepFrictionInsights: Awaited<ReturnType<typeof detectSleepFrictionLink>> = [];
  try {
    sleepFrictionInsights = await detectSleepFrictionLink(supabase, userId, { lookbackDays: 30 });
  } catch (e) {
    console.warn('[reconciliation] detectSleepFrictionLink failed (non-fatal):', e);
  }

  // Pierwszy Early Warning (prosty reżim)
  let earlyWarningInsights: Awaited<ReturnType<typeof detectEarlyWarningSignals>> = [];
  try {
    earlyWarningInsights = await detectEarlyWarningSignals(supabase, userId);
  } catch (e) {
    console.warn('[reconciliation] detectEarlyWarningSignals failed (non-fatal):', e);
  }

  // Rozbieżność narracji vs biometrii (Anty-Self-Deception)
  let narrativeBiometricMismatchInsights: Awaited<ReturnType<typeof detectNarrativeBiometricMismatch>> = [];
  try {
    narrativeBiometricMismatchInsights = await detectNarrativeBiometricMismatch(supabase, userId);
  } catch (e) {
    console.warn('[reconciliation] detectNarrativeBiometricMismatch failed (non-fatal):', e);
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
- Drift: ${driftType}.`;

    // Enrich with P2 reflective signals (user's own evening synthesis)
    if (p2Parsed && (p2Parsed.biggest_cost || p2Parsed.best_move || p2Parsed.blocker_candidates?.length)) {
      bridgeText += `\n\nTwoja refleksja:`;
      if (p2Parsed.biggest_cost) {
        bridgeText += `\n• Największy koszt: ${p2Parsed.biggest_cost}`;
      }
      if (p2Parsed.best_move) {
        bridgeText += `\n• Najlepszy ruch: ${p2Parsed.best_move}`;
      }
      if (p2Parsed.blocker_candidates?.length) {
        const blockers = p2Parsed.blocker_candidates.slice(0, 3).join('; ');
        bridgeText += `\n• Blokery, które sam nazwałeś: ${blockers}`;
      }
      if (p2Parsed.needs_manual_review || p2Parsed.parse_confidence < 0.5) {
        bridgeText += `\n_(refleksja dość chaotyczna — parser ma niską pewność)_`;
      }
    }

    // === Etap 1: Iniekcja powtarzalnych wzorców (S1 recurring blockers + S4 plan adherence) ===
    const strongBlockerInsights = recurringBlockerInsights.filter(i => shouldSurfaceInsight(i));
    const strongAdherenceInsights = planAdherenceInsights.filter(i => shouldSurfaceInsight(i));
    const strongMorningInsights = morningProtocolInsights.filter(i => shouldSurfaceInsight(i));
    const strongSleepInsights = sleepFrictionInsights.filter(i => shouldSurfaceInsight(i));
    const strongMismatchInsights = narrativeBiometricMismatchInsights.filter(i => shouldSurfaceInsight(i));

    const surfacedPatterns: Array<{ id: string; type: string }> = [];

    if (strongBlockerInsights.length > 0 || strongAdherenceInsights.length > 0 || strongMorningInsights.length > 0 || strongSleepInsights.length > 0 || strongMismatchInsights.length > 0) {
      bridgeText += `\n\nW Twoich danych:`;

      for (const insight of strongBlockerInsights) {
        bridgeText += `\n• ${insight.evidenceText}`;
        const id = await recordBehavioralPattern(supabase, userId, insight);
        if (id) surfacedPatterns.push({ id, type: 'recurring_blocker' });
      }
      for (const insight of strongAdherenceInsights) {
        bridgeText += `\n• ${insight.evidenceText}`;
        const id = await recordBehavioralPattern(supabase, userId, insight);
        if (id) surfacedPatterns.push({ id, type: 'plan_adherence_gap' });
      }
      for (const insight of strongMorningInsights) {
        bridgeText += `\n• ${insight.evidenceText}`;
        const id = await recordBehavioralPattern(supabase, userId, insight);
        if (id) surfacedPatterns.push({ id, type: 'morning_protocol_impact' });
      }
      for (const insight of strongSleepInsights) {
        bridgeText += `\n• ${insight.evidenceText}`;
        const id = await recordBehavioralPattern(supabase, userId, insight);
        if (id) surfacedPatterns.push({ id, type: 'sleep_friction_link' });
      }
      for (const insight of strongMismatchInsights) {
        bridgeText += `\n• ${insight.evidenceText}`;
        const id = await recordBehavioralPattern(supabase, userId, insight);
        if (id) surfacedPatterns.push({ id, type: 'narrative_biometric_mismatch' });
      }

      bridgeText += `\n_(to nie interpretacja — tylko powtarzalna obserwacja z Twoich danych. N = liczba Twoich wieczornych odpowiedzi)`;
    }


    // Early Warning (jeśli sygnały się nakładają)
    const strongWarning = earlyWarningInsights[0];
    if (strongWarning) {
      bridgeText += `\n\n⚠️ Wczesny sygnał:\n${strongWarning.evidenceText}`;
      bridgeText += `\nTo nie straszenie — po prostu widzimy ten schemat u Ciebie wystarczająco często.`;

      // Zapisujemy ostrzeżenie jako pełnoprawny wzorzec (żeby było w historii i w komendzie "wzorce")
      const warningId = await recordBehavioralPattern(supabase, userId, strongWarning);
      if (warningId) {
        surfacedPatterns.push({ id: warningId, type: 'early_warning' });

        // Podstawowe logowanie/audyt: zaznaczamy, że ostrzeżenie zostało faktycznie pokazane
        await markPatternAsShown(supabase, warningId);
      }
    }


    bridgeText += `

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
      reconciliation_notes: `Dzisiejszy dryf: ${driftType}. Artefakt: ${artifactStr}.${p2Parsed?.biggest_cost ? ` Największy koszt (użytkownik): ${p2Parsed.biggest_cost}.` : ''}${p2Parsed?.best_move ? ` Najlepszy ruch (użytkownik): ${p2Parsed.best_move}.` : ''}${p2Parsed?.blocker_candidates?.length ? ` Użytkownik nazwał jako blokery: ${p2Parsed.blocker_candidates.slice(0,4).join('; ')}.` : ''}`,
      user_named_blockers: p2Parsed?.blocker_candidates?.length ? p2Parsed.blocker_candidates : [],
      // === DUALISM MODEL (Operational vs Reflective layer) ===
      // operational_facts  = what actually happened (from evening_extraction)
      // user_reflection    = what the user thinks about it (from p2_parsed)
      // This separation is intentional and should be maintained.
      operational_facts: {
        artifact: artifactStr,
        first_90_protected: eveningExtraction?.first_90_protected ?? null,
        tension_action_result: eveningExtraction?.tension_action_result ?? null,
        phone_first: eveningExtraction?.phone_first ?? null,
        analysis_substitution: eveningExtraction?.analysis_substitution ?? [],
        tomorrow_first_artifact: tomorrowArtifact,
      },
      user_reflection: p2Parsed ? {
        day_score: p2Parsed.day_score,
        biggest_cost: p2Parsed.biggest_cost,
        best_move: p2Parsed.best_move,
        blocker_candidates: p2Parsed.blocker_candidates,
        correction: p2Parsed.correction,
        resource: p2Parsed.resource,
        parse_confidence: p2Parsed.parse_confidence,
        needs_manual_review: p2Parsed.needs_manual_review,
      } : null,
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
    let replyMarkup: any = undefined;

    if (!promptMissingArtifact) {
      const keyboard: any[][] = [
        [
          { text: '✅ Tak', callback_data: 'planning_confirm_tak' },
          { text: '🔧 Zmień', callback_data: 'planning_change_request' },
          { text: '📉 Minimum', callback_data: 'planning_show_minimum' }
        ]
      ];

      // Etap 1: Pattern feedback buttons (dla pierwszego mocnego insightu)
      if (surfacedPatterns.length > 0) {
        const firstPat = surfacedPatterns[0];
        if (firstPat.type === 'plan_adherence_gap') {
          keyboard.push([
            { text: '🛠 Wyjątek / Świadomy', callback_data: `pat_exception_${firstPat.id}` },
            { text: '🧠 Samooszukiwanie', callback_data: `pat_deception_${firstPat.id}` },
            { text: '⏸ Ciszej', callback_data: `pat_snooze_${firstPat.id}` }
          ]);
        } else {
          keyboard.push([
            { text: '👍 Ma sens', callback_data: `pat_confirm_${firstPat.id}` },
            { text: '👎 Nie mój', callback_data: `pat_reject_${firstPat.id}` },
            { text: '⏸ Ciszej', callback_data: `pat_snooze_${firstPat.id}` }
          ]);
        }
      }

      replyMarkup = { inline_keyboard: keyboard };
    }

    await safeSendTelegram(chatId, bridgeText, telegramToken, {
      reply_markup: replyMarkup,
      disable_notification: false
    });

    console.log('[reconciliation] planning session started (bridge message sent) for:', reconciliationId);
  } catch (planErr) {
    await logCriticalError({
      area: 'reconciliation-handler',
      error: planErr,
      message: 'Planning session trigger error from reconciliation',
    });
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
