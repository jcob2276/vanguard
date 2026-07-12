import { sendMessageParsed } from "../_shared/telegram.ts";
import { createServiceClient, safeExecute } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { getRecentStrongBehavioralPatterns } from "../_shared/vanguardPatterns.ts";
import { deepseekChat } from "../_shared/deepseek.ts";
import { getWarsawDateString } from "../_shared/time.ts";

export async function runWeeklySynthesis(req: Request): Promise<unknown> {
  const VANGUARD_USER_ID = getVanguardUserId();
  const supabase = createServiceClient();

  try {
    const now = new Date();
    const todayWarsaw = getWarsawDateString(now);
    const weekStart = (() => { const d = new Date(todayWarsaw + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().split('T')[0]; })();
    const cut7d = new Date(weekStart + 'T00:00:00Z');
    const weekEnd = getWarsawDateString(now);

    console.log(`[weekly-synthesis] start | ${weekStart} – ${weekEnd}`);

    // 1. Friction events — last 7 days
    const frictionEvents = await safeExecute(
      supabase.from('friction_events')
        .select('friction_type, deviation, declared_intention, actual_behavior, occurred_at')
        .eq('user_id', VANGUARD_USER_ID)
        .in('event_kind', ['friction_event', 'positive_micro_action'])
        .gte('occurred_at', cut7d.toISOString())
        .order('occurred_at', { ascending: false }),
    );

    const biometrics = await safeExecute(supabase.from('vanguard_daily_aggregates').select('date, sleep_hours, hrv_avg, readiness_score, execution_score, final_state').eq('user_id', VANGUARD_USER_ID).gte('date', weekStart).order('date', { ascending: false }));
    const plannings = await safeExecute(supabase.from('daily_reconciliations').select('date, planning_summary, p2_parsed').eq('user_id', VANGUARD_USER_ID).gte('date', weekStart).not('planning_summary', 'is', null).order('date', { ascending: false }));
    const dailyReflections = await safeExecute(supabase.from('daily_wins').select('date, day_note, journal_entry, result').eq('user_id', VANGUARD_USER_ID).gte('date', weekStart).or('day_note.not.is.null,journal_entry.not.is.null').order('date', { ascending: true }));
    const weeklyReflectionRows = await safeExecute(
      supabase.from('weekly_reviews')
        .select('week_start, proud_of, do_differently, sabotage, obligation, week_highlight, week_regret, new_belief, bottleneck, review_completed_at')
        .eq('user_id', VANGUARD_USER_ID)
        .not('review_completed_at', 'is', null)
        .gte('review_completed_at', cut7d.toISOString())
        .order('review_completed_at', { ascending: false })
        .limit(1),
    );
    const weeklyReflection = (weeklyReflectionRows || [])[0] || null;

    const topHypotheses = await safeExecute(
      supabase.from('vanguard_curiosity_queue')
        .select('hypothesis, provocation, confidence_score, category')
        .eq('user_id', VANGUARD_USER_ID)
        .eq('status', 'pending')
        .order('confidence_score', { ascending: false })
        .limit(3),
    );

    const stream = await safeExecute(
      supabase.from('vanguard_stream')
        .select('content, created_at, category')
        .eq('user_id', VANGUARD_USER_ID)
        .gte('created_at', cut7d.toISOString())
        .not('source', 'eq', 'system')
        .order('created_at', { ascending: false })
        .limit(35),
    );

    // Etap 1: Powtarzalne wzorce behawioralne (z dedykowanej tabeli)
    const strongPatterns = await getRecentStrongBehavioralPatterns(
      supabase,
      VANGUARD_USER_ID,
      4
    );

    // --- Aggregate friction by type ---
    const frictionByType: Record<string, number> = {};
    for (const e of (frictionEvents || [])) {
      if (e.friction_type) {
        frictionByType[e.friction_type] = (frictionByType[e.friction_type] || 0) + 1;
      }
    }
    const frictionSorted = Object.entries(frictionByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // --- Biometric averages ---
    const bio = biometrics || [];
    const sleepDays = bio.filter((b: any) => b.sleep_hours != null);
    const hrvDays = bio.filter((b: any) => b.hrv_avg != null);
    const execDays = bio.filter((b: any) => b.execution_score != null);

    const avgSleep = sleepDays.length
      ? (sleepDays.reduce((s: number, b: any) => s + b.sleep_hours, 0) / sleepDays.length).toFixed(1)
      : null;
    const avgHrv = hrvDays.length
      ? Math.round(hrvDays.reduce((s: number, b: any) => s + b.hrv_avg, 0) / hrvDays.length)
      : null;
    const avgExec = execDays.length
      ? Math.round(execDays.reduce((s: number, b: any) => s + b.execution_score, 0) / execDays.length * 100)
      : null;

    // --- Build LLM context ---
    const frictionText = frictionSorted.length > 0
      ? frictionSorted.map(([type, count]) => `${type}: ${count}x`).join(' | ')
      : 'brak';

    const frictionDetails = (frictionEvents || []).slice(0, 12)
      .map((e: any) => `[${e.occurred_at?.split('T')[0]}] ${e.friction_type}: ${e.deviation || e.actual_behavior || '—'}`)
      .join('\n');

    const bioText = [
      `Sen: ${avgSleep ?? 'brak'}h (${sleepDays.length} dni)`,
      `HRV: ${avgHrv ?? 'brak'} (${hrvDays.length} dni)`,
      `Wykonanie Top3: ${avgExec != null ? avgExec + '%' : 'brak'} (${execDays.length} dni)`,
    ].join(' | ');

    const planningsText = (plannings || []).map((p: any) => {
      const plan = p.planning_summary || {};
      const prodArtifact = plan.production_artifact?.artifact || plan.one_clear_move || '—';
      const minViable = plan.minimum_viable_day || '—';
      
      const p2 = p.p2_parsed || {};
      const biggestCost = p2.biggest_cost || '—';
      const blockers = p2.blocker_candidates?.join('; ') || '—';
      
      return `[Data: ${p.date}]\n- Plan (artefakt): ${prodArtifact} | Minimum: ${minViable}\n- Rzeczywistość (koszt): ${biggestCost} | Nazwane blokery: ${blockers}`;
    }).join('\n\n');

    const dailyReflectionsText = (dailyReflections || []).length > 0
      ? (dailyReflections || []).map((d: any) => {
          const parts = [`[${d.date}, wynik dnia: ${d.result ?? '—'}]`];
          if (d.day_note?.trim()) parts.push(`Refleksja: "${d.day_note.trim()}"`);
          if (d.journal_entry?.trim()) parts.push(`Co zrobiono: "${d.journal_entry.trim()}"`);
          return parts.join(' ');
        }).join('\n')
      : 'Brak refleksji wieczornych w tym tygodniu.';

    const weeklyReflectionText = weeklyReflection
      ? [
          weeklyReflection.week_highlight?.trim() && `Highlight tygodnia: "${weeklyReflection.week_highlight.trim()}"`,
          weeklyReflection.proud_of?.trim() && `Dumny z: "${weeklyReflection.proud_of.trim()}"`,
          weeklyReflection.do_differently?.trim() && `Zrobiłby inaczej: "${weeklyReflection.do_differently.trim()}"`,
          weeklyReflection.sabotage?.trim() && `Sabotaż: "${weeklyReflection.sabotage.trim()}"`,
          weeklyReflection.obligation?.trim() && `Zobowiązanie: "${weeklyReflection.obligation.trim()}"`,
          weeklyReflection.week_regret?.trim() && `Żal tygodnia: "${weeklyReflection.week_regret.trim()}"`,
          weeklyReflection.new_belief?.trim() && `Nowe przekonanie: "${weeklyReflection.new_belief.trim()}"`,
          weeklyReflection.bottleneck?.trim() && `Wąskie gardło: "${weeklyReflection.bottleneck.trim()}"`,
        ].filter(Boolean).join('\n') || 'Refleksja tygodnia wypełniona, ale bez treści w polach tekstowych.'
      : 'Brak ukończonej Refleksji Tygodnia w tym oknie (zakładka Tydzień).';

    const hypothesesText = (topHypotheses || []).length > 0
      ? (topHypotheses || []).map((h: any) =>
          `[${h.category}, conf=${h.confidence_score?.toFixed(2)}] ${h.hypothesis}`
        ).join('\n')
      : 'Brak hipotez w kolejce.';

    const patternsText = strongPatterns.length > 0
      ? strongPatterns.map((p, i) => `${i+1}. ${p.evidence_text} (N=${p.occurrence_count}, pewność=${Math.round(p.confidence*100)}%)`).join('\n')
      : 'Brak silnych powtarzalnych wzorców w tym okresie.';

    const streamText = (stream || [])
      .map((s: any) => `[${s.created_at?.split('T')[0]}][${s.category || '—'}] ${s.content}`)
      .join('\n');

    // --- LLM synthesis ---
    const { content: synthesisText } = await deepseekChat({
      apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
      model: 'deepseek-v4-flash',
      temperature: 0.4,
      maxTokens: 700,
      messages: [
        {
          role: 'system',
          content: `Jesteś Vanguard OS. Generujesz TYGODNIOWĄ SYNTEZĘ behawioralną.
 
ZASADY ABSOLUTNE:
1. Tylko to co jawnie widać w danych — bez psychoanalizy motywów.
2. Liczby są źródłem prawdy — podaj je konkretnie.
3. Jeden wzorzec który naprawdę widać w danych (nie spekuluj). Możesz odwołać się do sekcji POWTARZALNE WZORCE jeśli pasują do tego tygodnia.
4. Deklaracje vs dane: Porównaj plany i nazwane blokery z rzeczywistym kosztem i tarciami. Pokaż rozjazdy i samooszukiwanie bez ogródek, posługując się cytatami z planów i kosztów. Szczególnie odnieś się do tego, czy zapowiedziane blokery faktycznie się zmaterializowały lub czy pojawiły się niespodziewane tarcia.
5. Hipoteza systemu: wybierz jedną z kolejki TYLKO jeśli pasuje do danych tygodnia. Jeśli żadna nie pasuje — napisz "brak pasującej hipotezy".
6. Pytanie na następne 7 dni: konkretne, operacyjne — nie motywacyjne, nie ogólne.
7. REFLEKSJE (wieczorne + tygodniowa) to głos użytkownika, nie surowe dane — cytuj wprost gdzie pasuje (WZORZEC TYGODNIA / DEKLARACJE VS DANE), nie psychoanalizuj ich treści. Jeśli coś nazwanego w REFLEKSJI TYGODNIA (sabotaż/wąskie gardło) pokrywa się z friction/biometrią — to jest twój najmocniejszy dowód, nazwij to wprost.
 
FORMAT (trzymaj się dokładnie tej struktury, po polsku):
 
TYDZIEŃ [data_od] – [data_do]
 
LICZBY
• Friction: [top typy z liczbami]
• Biometria: [sen, HRV, wykonanie]
• Plany wieczorne: [liczba] z 7 dni
 
WZORZEC TYGODNIA
[1-3 zdania. Tylko obserwacja z danych. Możesz odwołać się do sekcji POWTARZALNE WZORCE jeśli są aktualne w tym tygodniu. Brak ocen i interpretacji motywów.]
 
DEKLARACJE VS DANE (Anty-Self-Deception)
[Analiza rozjazdów planów z kosztami i tarciami z cytatami. Porównaj zadeklarowane blokery z rzeczywistością.]
 
HIPOTEZA SYSTEMU
[Jedna hipoteza z kolejki lub "brak pasującej hipotezy"]
 
PYTANIE NA NASTĘPNE 7 DNI
[Jedno pytanie. Max 20 słów. Operacyjne, nie filozoficzne.]`
        },
        {
          role: 'user',
          content: `OKRES: ${weekStart} – ${weekEnd}
 
BIOMETRIA (${bio.length} dni danych):
${bioText}
 
FRICTION EVENTS — typy:
${frictionText}
 
FRICTION DETAILS:
${frictionDetails || 'brak'}
 
PLANY I DEKLARACJE VS RZECZYWISTOŚĆ KOŃCA DNIA:
${planningsText || 'brak danych o planach'}
 
SESJE PLANOWANIA WIECZORNEGO: ${(plannings || []).length} z 7 dni
 
REFLEKSJE WIECZORNE (Domknięcie Dnia — dzień po dniu):
${dailyReflectionsText}
 
REFLEKSJA TYGODNIA (zakładka Tydzień):
${weeklyReflectionText}
 
HIPOTEZY Z KOLEJKI (top 3 wg confidence):
${hypothesesText}
 
POWTARZALNE WZORCE (Etap 1 — wykryte wcześniej i potwierdzone danymi):
${patternsText}
 
STRUMIEŃ (ostatnie 7 dni):
${streamText || 'brak wpisów'}`
        }
      ],
    });

    if (!synthesisText) throw new Error('LLM returned empty synthesis');

    // --- Send to Telegram ---
    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0', 10);

    const telegramResult = await sendMessageParsed(
      TELEGRAM_TOKEN,
      TELEGRAM_CHAT_ID,
      `📊 SYNTEZA TYGODNIOWA\n\n${synthesisText}\n\n─────\nOdpisz na pytanie powyżej — odpowiedź leci do strumienia i otwiera planning na następne 7 dni.`,
    );
    if (!telegramResult.ok) {
      throw new Error(`Telegram error: ${telegramResult.description}`);
    }

    // --- Log to stream ---
    const { error: streamInsertErr } = await supabase.from('vanguard_stream').insert({
      user_id: VANGUARD_USER_ID,
      content: `[weekly synthesis sent] ${weekStart} – ${weekEnd} | friction: ${frictionSorted.map(([t, c]) => `${t}:${c}`).join(',')}`,
      source: 'system',
      classification: 'system:weekly',
    });
    if (streamInsertErr) {
      console.error('[weekly-synthesis] stream insert failed:', streamInsertErr);
      throw new Error(`Stream insert failed: ${streamInsertErr.message}`);
    }

    console.log(`[weekly-synthesis] done`);
    return { success: true, week: `${weekStart} – ${weekEnd}` };

  } catch (err: any) {
    console.error('[weekly-synthesis] error:', err);
    throw err;
  }
}
