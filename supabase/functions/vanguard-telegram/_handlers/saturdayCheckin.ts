/**
 * saturdayCheckin.ts — Handler for the conversational Saturday Check-In.
 */

import { sendChatAction } from "../../_shared/telegram.ts";
import { runRealityAdversary } from '../_utils/adversary.ts';
import { safeSendTelegram } from '../_utils/helpers.ts';

export async function handleSaturdayCheckin(
  reconciliationId: string,
  cleanText: string,
  streamRecordId: string | null,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
  userId: string,
  parsedResponse: any
): Promise<void> {
  const currentStep = parsedResponse?.step || 'input';
  const answers = parsedResponse?.answers || {};

  // 1. Process current step and transition
  if (currentStep === 'input') {
    answers.input = cleanText;
    const nextStep = 'integration';
    
    const { error: updateErrInput } = await supabase.from('daily_reconciliations').update({
      parsed_response: { step: nextStep, answers }
    }).eq('id', reconciliationId);
    if (updateErrInput) console.error('[saturday] failed to update step to integration:', updateErrInput);

    const messageText = 
      `🔄 *Saturday Check-In: WEEKLY INTEGRATION + REALITY REVIEW* 🔄\n\n` +
      `*Część 2: INTEGRATION*\n` +
      `1. Co faktycznie wdrożyłeś?\n` +
      `2. Co zmieniło zachowanie choć minimalnie?\n` +
      `3. Co tylko brzmiało mądrze?\n` +
      `4. Co już wiedziałeś wcześniej, ale dalej tego nie robisz?\n\n` +
      `_Nagraj głosówkę lub odpisz._`;

    await sendTelegram(chatId, messageText, telegramToken);
    return;
  }

  if (currentStep === 'integration') {
    answers.integration = cleanText;
    const nextStep = 'reality';

    const { error: updateErrIntegration } = await supabase.from('daily_reconciliations').update({
      parsed_response: { step: nextStep, answers }
    }).eq('id', reconciliationId);
    if (updateErrIntegration) console.error('[saturday] failed to update step to reality:', updateErrIntegration);

    const messageText = 
      `📍 *Saturday Check-In: WEEKLY INTEGRATION + REALITY REVIEW* 📍\n\n` +
      `*Część 3: REALITY*\n` +
      `1. Gdzie analiza zastąpiła ekspozycję?\n` +
      `2. Jaki friction wracał najczęściej?\n` +
      `3. Co próbowałeś rozwiązać myśleniem zamiast ruchem?\n` +
      `4. Gdzie był największy drift między planem a rzeczywistością?\n\n` +
      `_Nagraj głosówkę lub odpisz._`;

    await sendTelegram(chatId, messageText, telegramToken);
    return;
  }

  if (currentStep === 'reality') {
    answers.reality = cleanText;
    const nextStep = 'system';

    const { error: updateErrReality } = await supabase.from('daily_reconciliations').update({
      parsed_response: { step: nextStep, answers }
    }).eq('id', reconciliationId);
    if (updateErrReality) console.error('[saturday] failed to update step to system:', updateErrReality);

    const messageText = 
      `⚙️ *Saturday Check-In: WEEKLY INTEGRATION + REALITY REVIEW* ⚙️\n\n` +
      `*Część 4: SYSTEM*\n` +
      `1. Co najbardziej stabilizowało execution?\n` +
      `2. Co najbardziej rozwalało dzień?\n` +
      `3. Jaki mechanizm trzeba uprościć?\n` +
      `4. Co usuwamy z następnego tygodnia?\n\n` +
      `_Nagraj głosówkę lub odpisz._`;

    await sendTelegram(chatId, messageText, telegramToken);
    return;
  }

  if (currentStep === 'system') {
    answers.system = cleanText;
    
    // Save final answers and mark reconciliation answered
    const { error: updateErrSystem } = await supabase.from('daily_reconciliations').update({
      status: 'answered',
      user_response: JSON.stringify(answers),
      parsed_response: { step: 'completed', answers },
      answered_at: new Date().toISOString()
    }).eq('id', reconciliationId);
    if (updateErrSystem) console.error('[saturday] failed to save final answers:', updateErrSystem);

    await sendChatAction(telegramToken, chatId, "typing");

    // Fetch context for Saturday Synthesis
    const cut7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [frictionRes, streamRes] = await Promise.all([
      supabase.from('friction_events')
        .select('occurred_at, friction_type, actual_behavior, deviation')
        .eq('user_id', userId)
        .gte('occurred_at', cut7d.toISOString())
        .order('occurred_at', { ascending: false }),
      supabase.from('vanguard_stream')
        .select('created_at, content')
        .eq('user_id', userId)
        .gte('created_at', cut7d.toISOString())
        .not('source', 'eq', 'system')
        .order('created_at', { ascending: false })
        .limit(30)
    ]);

    const frictionLines = (frictionRes.data || [])
      .map((e: any) => `[${e.occurred_at?.split('T')[0]}] ${e.friction_type}: ${e.deviation || e.actual_behavior || ''}`)
      .join('\n');

    const streamLines = (streamRes.data || [])
      .map((s: any) => `[${s.created_at?.split('T')[0]}] ${s.content}`)
      .join('\n');

    // Run LLM Behavioral Review
    let synthesisText = '';
    try {
      const llmRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          temperature: 0.15,
          max_tokens: 800,
          messages: [
            {
              role: 'system',
              content: `Jesteś Vanguard OS (systems operator reviewing behavioral drift).
Twoim celem jest przeprowadzenie zimnej, bezpośredniej syntezy behawioralnej (WEEKLY INTEGRATION + REALITY REVIEW).

ZASADY TONU I KONTENTU:
- Cold behavioral systems review. Analizujesz rozbieżności.
- BEZWZGLĘDNY zakaz coachingu, terapii, motywacji, "świetnej roboty", "dasz radę", "brawo", tonu guru.
- Odpowiedz bezpośrednio i chłodno. Pokaż fakty i pętle.
- Kompresujesz tydzień, komentujesz wzorce, pokazujesz sprzeczności (zwłaszcza "rozumiem vs wdrażam").
- Wskaż, gdzie input (konsumowanie/czytanie/oglądanie) stał się substytutem realnego działania (execution).
- Używaj zwrotów typu:
  „W tym tygodniu ilość insightów rosła szybciej niż liczba realnych tension actions.”
  „Powtarza się wzorzec: input → inspiracja → analiza → brak pierwszego artefaktu.”

FORMAT:
Po prostu napisz chłodną analizę behawioralną w 3-4 krótkich, zwięzłych akapitach.`
            },
            {
              role: 'user',
              content: `ODPOWIEDZI UŻYTKOWNIKA Z SATURDAY CHECK-IN:
- INPUT (Co konsumował, czy input zastępował działanie):
${answers.input}

- INTEGRATION (Co wdrożył, co brzmiało tylko mądrze, co wiedział a nie robi):
${answers.integration}

- REALITY (Gdzie analiza zastąpiła ekspozycję, friction, drift plan vs rzeczywistość):
${answers.reality}

- SYSTEM (Co stabilizowało, co rozwalało, co uprościć/usunąć):
${answers.system}

DANE Z SYSTEMU (Ostatnie 7 dni):
Friction Events:
${frictionLines || 'brak'}

Strumień:
${streamLines || 'brak'}`
            }
          ]
        })
      });

      if (llmRes.ok) {
        const data = await llmRes.json();
        synthesisText = data.choices?.[0]?.message?.content || '';
      }
    } catch (e) {
      console.error('[saturday] llm synthesis error:', e);
    }

    if (!synthesisText) {
      synthesisText = '⚠️ Nie udało się wygenerować pełnej syntezy. Przechodzimy bezpośrednio do planowania.';
    }

    // Propose Sunday plan (Bridge to tomorrow)
    let tomorrowArtifact = "Wykonanie pierwszego kroku wdrożeniowego";
    let tomorrowMinimum = "15 minut bez telefonu na start działania";
    let tomorrowStart = "08:45";
    let tomorrowTension = "Zmierzenie się z najtrudniejszym zadaniem tygodnia";
    let tomorrowTensionMin = "Rozpoczęcie zadania";

    // Try running Reality Adversary to get optimized recommendation
    try {
      const adversaryOutput = await runRealityAdversary(null, streamRes.data || [], deepseekApiKey);
      if (adversaryOutput?.recommended_tension_action?.action) {
        tomorrowArtifact = adversaryOutput.recommended_tension_action.action;
        tomorrowMinimum = adversaryOutput.recommended_tension_action.minimum_version || "zdefiniuj minimum";
        tomorrowTension = adversaryOutput.recommended_tension_action.action;
        tomorrowTensionMin = adversaryOutput.recommended_tension_action.minimum_version || "zdefiniuj minimum";
      }
    } catch (advErr) {
      console.warn('[saturday] adversary run failed:', advErr);
    }

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const tomorrowWarsawDateStr = (() => {
      const d = new Date(todayStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().split('T')[0];
    })();

    const planningDraft = {
      target_date: tomorrowWarsawDateStr,
      date: tomorrowWarsawDateStr,
      day_mode: "work",
      top3: [tomorrowArtifact, "Uporządkowanie zadań", "Ruch napięciowy"],
      one_clear_move: tomorrowArtifact,
      first_move_morning: `${tomorrowStart} - start bloku na: ${tomorrowArtifact}`,
      morning_activation: {
        first_10_minutes: "Brak telefonu, szklanka wody, start bloku",
        phone_risk: true,
        anti_phone_instruction: "Telefon w drugim pokoju."
      },
      biggest_risk: "opóźnienie startu bloku",
      counterplan: "telefon off do 9:30",
      urgent_items: [],
      not_doing: [],
      minimum_viable_day: tomorrowMinimum,
      confidence: "high",
      open_loops: [],
      energy_state: "średnia",
      reconciliation_notes: `Saturday review: ${synthesisText.substring(0, 150)}...`,
      adversary_note: "Zimna synteza behawioralna zakończona.",
      tension_action: {
        action: tomorrowTension,
        why_it_matters: "Przełamanie oporu w nowym cyklu",
        minimum_version: tomorrowTensionMin,
        due_time: "14:00",
        verification: "self",
        status: "planned"
      },
      production_artifact: {
        artifact: tomorrowArtifact,
        definition_of_done: "Fizycznie istniejący rezultat",
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
      { role: 'user', content: JSON.stringify(answers) },
      { role: 'assistant', content: JSON.stringify(planningDraft) }
    ];

    // Update reconciliation row to launch the planning session
    const { error: updateErrPlanning } = await supabase.from('daily_reconciliations').update({
      planning_status: 'active',
      planning_history: initialHistory
    }).eq('id', reconciliationId);
    if (updateErrPlanning) console.error('[saturday] failed to activate planning session:', updateErrPlanning);

    const bridgeText = 
      `${synthesisText}\n\n` +
      `─────\n` +
      `✅ Saturday Check-In zakończony.\n\n` +
      `Jutro nie zaczynamy od planowania.\n` +
      `Jutro nie definiujemy całego dnia.\n` +
      `Definiujemy pierwszy ruch, który stabilizuje resztę.\n\n` +
      `Pierwszy artefakt:\n` +
      `→ ${tomorrowArtifact}\n\n` +
      `Minimum:\n` +
      `→ ${tomorrowMinimum}\n\n` +
      `Start:\n` +
      `→ ${tomorrowStart}\n\n` +
      `Po tym wracasz do reszty dnia normalnie.\n\n` +
      `Potwierdzasz?`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Tak', callback_data: 'planning_confirm_tak' },
          { text: '🔧 Zmień', callback_data: 'planning_change_request' },
          { text: '📉 Minimum', callback_data: 'planning_show_minimum' }
        ]
      ]
    };

    await sendTelegramWithMarkup(chatId, bridgeText, replyMarkup, telegramToken);
    console.log('[saturday] checkin complete, bridge prompt sent:', reconciliationId);
  }
}

async function sendTelegram(chatId: number, text: string, token: string) {
  await safeSendTelegram(chatId, text, token, { parse_mode: 'Markdown' });
}

async function sendTelegramWithMarkup(chatId: number, text: string, replyMarkup: any, token: string) {
  await safeSendTelegram(chatId, text, token, { reply_markup: replyMarkup });
}
