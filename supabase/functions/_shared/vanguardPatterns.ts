/**
 * vanguardPatterns.ts
 *
 * Etap 1 — Personal Pattern Memory (pierwsza warstwa detektorów).
 *
 * === MIGRACJA (czerwiec 2026) ===
 * Wzorce są teraz przechowywane w dedykowanej tabeli `vanguard_behavioral_patterns`
 * (migracja 20260602000001).
 * Poprzednio używaliśmy vanguard_curiosity_queue z category='behavioral_pattern' — to jest już legacy.
 *
 * Filozofia:
 * - Wszystko oparte na evidence (p2_parsed + friction_events + aggregates + planning_summary).
 * - Zawsze podajemy N + horyzont + pewność.
 * - Szanujemy dualizm.
 *
 * Użycie:
 *   import { detectRecurringBlockers, detectPlanAdherenceGaps, getRecentStrongBehavioralPatterns } from '../_shared/vanguardPatterns.ts';
 */

import { safeExecute } from './supabase.ts';

export interface PatternInsight {
  type: 'recurring_blocker' | 'plan_adherence_gap' | 'morning_protocol_impact' | 'sleep_friction_link' | 'early_warning' | 'narrative_biometric_mismatch';
  title: string;                    // Krótki tytuł do pokazania
  evidenceText: string;             // Gotowy tekst do wstawienia w wiadomość (po polsku)
  confidence: number;               // 0.0 – 1.0
  sampleSize: number;               // ile dni / obserwacji
  lastSeenDate: string | null;      // data ostatniego wystąpienia (YYYY-MM-DD)
  metadata?: Record<string, any>;   // surowe dane dla debugu / dalszego przetwarzania
}


/**
 * S1: Powtarzające się blokery użytkownika.
 *
 * Szuka blockerów z p2_parsed.blocker_candidates z ostatnich N dni
 * i sprawdza, czy w kolejnych dniach pojawiły się pasujące friction_events.
 */
export async function detectRecurringBlockers(
  supabase: any,
  userId: string,
  options: {
    lookbackDays?: number;      // ile dni wstecz brać p2_parsed (domyślnie 21)
    correlationWindowDays?: number; // w ilu dniach po blockerze szukamy friction (domyślnie 5)
    minOccurrences?: number;    // minimalna liczba powtórzeń blokera, żeby uznać za wzorzec (domyślnie 3)
  } = {}
): Promise<PatternInsight[]> {
  const lookback = options.lookbackDays ?? 21;
  const corrWindow = options.correlationWindowDays ?? 5;
  const minOcc = options.minOccurrences ?? 3;

  const cutoff = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString();

  // 1. Pobierz p2_parsed z ostatnich dni (z blockerami)
  const reconciliations = await safeExecute(
    supabase
      .from('daily_reconciliations')
      .select('date, p2_parsed')
      .eq('user_id', userId)
      .not('p2_parsed', 'is', null)
      .gte('date', cutoff.split('T')[0])
      .order('date', { ascending: false })
  );

  if (!reconciliations || reconciliations.length === 0) return [];

  // Zbierz wszystkie nazwane blokery + daty
  const blockerOccurrences: Array<{ blocker: string; date: string }> = [];

  for (const r of reconciliations) {
    const p2 = r.p2_parsed as any;
    if (!p2?.blocker_candidates || !Array.isArray(p2.blocker_candidates)) continue;
    if ((p2.parse_confidence ?? 0) < 0.35) continue; // za mało wiarygodne

    for (const b of p2.blocker_candidates) {
      if (typeof b === 'string' && b.trim().length > 3) {
        blockerOccurrences.push({
          blocker: b.trim().toLowerCase(),
          date: r.date,
        });
      }
    }
  }

  if (blockerOccurrences.length === 0) return [];

  // Lepsze grupowanie (mały krok po kolei)
  const blockerGroups = new Map<string, string[]>();

  function normalizeBlocker(text: string): string {
    const stopWords = new Set([
      'że', 'mi', 'się', 'na', 'do', 'z', 'w', 'o', 'i', 'a', 'ale', 'bo', 'no', 'już', 'jeszcze',
      'muszę', 'powinienem', 'trzeba', 'zrobić', 'zrobiłem', 'robić', 'robię'
    ]);

    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(' ')
      .filter(word => word.length > 1 && !stopWords.has(word))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Proste mapowanie na tematy (Faza A – poprawa jakości S1)
  function getBlockerTheme(text: string): string {
    const t = text.toLowerCase();

    // 1. Digital Distraction / Scrolling (priority to avoid false positives with cold_calls)
    if (/scroll|social|facebook|messenger|instagram|tiktok|youtube|grać|gier|porno|wrak|\bfb\b|\big\b|\byt\b/i.test(t) ||
        (/telefon|fon/i.test(t) && /leż|marn|ran|późn|scrol|łóżk|medi/i.test(t))) {
      return 'digital_distraction';
    }

    // 2. Relationships / Personal life
    if (/dziewczyn|związek|związku|relacj|randk|była|byłej|dotyk|kobieta|kobiety/i.test(t)) {
      return 'relationships';
    }

    // 3. Education / Studies
    if (/egzamin|nauka|uczyć|uczę|kurs|szkoł|uczeln|cisco|wykładowc|pytań/i.test(t)) {
      return 'education';
    }

    // 4. Sleep & Waking Routine
    if (/sen|wstawać|wczesno|zasnąć|spać|łóżk|zgrzeb|wstał/i.test(t)) {
      return 'sleep_routine';
    }

    // 5. Mental State / Overthinking / Alignment / Avoidance
    if (/chaos|overthinking|bałem|strach|niepokój|dryf|kierunek|cel|wahan|myśli|unika/i.test(t)) {
      return 'mental_state';
    }

    // 6. Cold Calls / Sales / Business Outreach
    if (/telefon|dzwonić|rozmow|klient|lead|zimny|outreach|sprzedaż|pitch/i.test(t)) {
      return 'cold_calls';
    }

    // 7. Email Followup
    if (/mail|email|odpowiedzieć|odpisać|korespondencja|inbox/.test(t)) {
      return 'email_followup';
    }

    // 8. Training & Physical Activity
    if (/trening|siłown|sport|ruch|ćwicz|workout/i.test(t)) {
      return 'training';
    }

    // 9. Eating / Nutrition
    if (/jedzenie|dieta|jedz|przekąska|jedzenie/i.test(t)) {
      return 'eating';
    }

    // 10. Writing / Content Creation
    if (/pisanie|tekst|artykuł|content|raport|writing/i.test(t)) {
      return 'writing_content';
    }

    // 11. Admin / Organization
    if (/admin|organizacja|planowanie|zadania|todo|inbox zero|porządkowanie/i.test(t)) {
      return 'admin';
    }

    // 12. Creative
    if (/kreatywny|twórczy|pomysł|brainstorm|content creation/i.test(t)) {
      return 'creative';
    }

    // 13. Business / Finances
    if (/pieniądze|finanse|biznes/i.test(t)) {
      return 'business';
    }

    return 'other';
  }


  function wordOverlap(a: string, b: string): number {
    const wordsA = new Set(a.split(' ').filter(w => w.length > 2));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    return overlap / Math.max(wordsA.size, wordsB.size);
  }

  for (const occ of blockerOccurrences) {
    const norm = normalizeBlocker(occ.blocker);
    if (!norm) continue;

    const theme = getBlockerTheme(occ.blocker);

    let matchedKey: string | null = null;

    for (const [key] of blockerGroups) {
      const keyNorm = normalizeBlocker(key);
      const keyTheme = getBlockerTheme(key);
      const overlap = wordOverlap(norm, keyNorm);

      // Dopasowanie jeśli:
      // - ten sam temat + rozsądny overlap (temat mocno pomaga), lub
      // - bardzo wysoki overlap, lub
      // - jeden zawiera drugi
      const sameTheme = theme !== 'other' && theme === keyTheme;
      const effectiveOverlap = sameTheme ? overlap * 1.3 : overlap; // boost dla tego samego tematu

      const goodMatch = effectiveOverlap >= 0.45 || norm.includes(keyNorm) || keyNorm.includes(norm);

      if (sameTheme || goodMatch) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      blockerGroups.get(matchedKey)!.push(occ.date);
    } else {
      const first = occ.blocker.length > 60 ? occ.blocker.substring(0, 60) : occ.blocker;
      blockerGroups.set(first, [occ.date]);
    }
  }

  // Po zbudowaniu grup — wybierz lepszego reprezentanta frazy dla każdej grupy
  // (to jest podpięcie pickBestRepresentativePhrase do rzeczywistego grupowania)
  const improvedGroups = new Map<string, string[]>();

  for (const [oldKey, dates] of blockerGroups) {
    const phrasesInGroup = blockerOccurrences
      .filter(o => dates.includes(o.date))
      .map(o => o.blocker);

    const bestPhrase = pickBestRepresentativePhrase(phrasesInGroup);
    const finalKey = bestPhrase.length > 60 ? bestPhrase.substring(0, 60) : bestPhrase;

    if (improvedGroups.has(finalKey)) {
      improvedGroups.get(finalKey)!.push(...dates);
    } else {
      improvedGroups.set(finalKey, [...dates]);
    }
  }

  blockerGroups.clear();
  for (const [k, v] of improvedGroups) {
    blockerGroups.set(k, v);
  }

  const insights: PatternInsight[] = [];

  // Dla każdej grupy sprawdzamy korelację z friction_events
  for (const [blockerPhrase, dates] of blockerGroups) {
    if (dates.length < minOcc) continue;

    // Dla każdego wystąpienia blokera patrzymy na friction w kolejnych dniach
    let totalCorrelated = 0;
    let lastCorrelatedDate: string | null = null;

    for (const blockerDate of dates) {
      const start = new Date(blockerDate);
      const end = new Date(start);
      end.setDate(end.getDate() + corrWindow);

      const frictions = await safeExecute(
        supabase
          .from('friction_events')
          .select('friction_type, occurred_at, event_kind')
          .eq('user_id', userId)
          .gte('occurred_at', start.toISOString())
          .lt('occurred_at', end.toISOString())
          .in('event_kind', ['friction_event'])
      );

      if (frictions && frictions.length > 0) {
        totalCorrelated += 1;
        lastCorrelatedDate = blockerDate;
      }
    }

    const ratio = totalCorrelated / dates.length;
    if (ratio < 0.4) continue; // za słaba korelacja na start

    const sample = dates.length;
    const pct = Math.round(ratio * 100);
    const blockerTheme = getBlockerTheme(blockerPhrase);

    const themeLabel = blockerTheme !== 'other' ? ` (temat: ${blockerTheme})` : '';
    const evidenceText =
      `Kiedy nazywasz "${blockerPhrase}" jako blocker${themeLabel} (jak ostatnio), ` +
      `to w ${pct}% przypadków w ciągu ${corrWindow} dni pojawia się konkretne tarcie behawioralne ` +
      `(N=${sample}, ostatnie ${lookback} dni).`;

    const displayTitle = blockerTheme !== 'other'
      ? `${blockerTheme} blocker`
      : `Powtarzający się blocker: ${blockerPhrase.substring(0, 50)}`;

    insights.push({
      type: 'recurring_blocker',
      title: displayTitle,
      evidenceText,
      confidence: Math.min(0.95, 0.5 + ratio * 0.45),
      sampleSize: sample,
      lastSeenDate: lastCorrelatedDate,
      metadata: {
        blockerPhrase,
        occurrences: dates.length,
        correlated: totalCorrelated,
        ratio,
        theme: blockerTheme,
      },
    });
  }

  // Sortuj po sile (confidence * sampleSize)
  return insights
    .sort((a, b) => (b.confidence * b.sampleSize) - (a.confidence * a.sampleSize))
    .slice(0, 2); // maksymalnie 2 najsilniejsze na raz (nie przytłaczać)
}

/**
 * Pomocnicza funkcja do wyboru najlepszego reprezentanta frazy blokera z grupy.
 * Priorytet: najczęściej występująca fraza → najkrótsza (dla czytelności).
 */
function pickBestRepresentativePhrase(phrases: string[]): string {
  if (phrases.length === 0) return '';

  // Policz częstotliwość każdej unikalnej frazy
  const freq = new Map<string, number>();
  for (const p of phrases) {
    freq.set(p, (freq.get(p) || 0) + 1);
  }

  // Posortuj: najpierw po częstotliwości malejąco, potem po długości rosnąco
  const sorted = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // wyższa częstotliwość wygrywa
    return a[0].length - b[0].length;       // przy remisie krótsza wygrywa
  });

  return sorted[0][0];
}

/**
 * S4: Plan adherence gap — rozjazd między tym, co zaplanowałeś wieczorem,
 * a tym co się realnie wydarzyło (p2 + friction + aggregates).
 *
 * W pierwszej wersji: patrzymy na wczorajszy plan vs dzisiejsze dane.
 */
export async function detectPlanAdherenceGaps(
  supabase: any,
  userId: string,
  yesterdayDate: string
): Promise<PatternInsight[]> {
  // Pobierz wczorajszy plan + dzisiejsze p2 + friction + aggregate
  const [planRow, todayP2, todayFriction, todayAggregate] = await Promise.all([
    safeExecute(
      supabase
        .from('daily_reconciliations')
        .select('planning_summary, date')
        .eq('user_id', userId)
        .eq('date', yesterdayDate)
        .not('planning_summary', 'is', null)
        .maybeSingle()
    ),
    safeExecute(
      supabase
        .from('daily_reconciliations')
        .select('p2_parsed, date')
        .eq('user_id', userId)
        .gte('date', yesterdayDate) // dzisiaj lub jutro rano
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()
    ),
    safeExecute(
      supabase
        .from('friction_events')
        .select('friction_type, event_kind, deviation, immediate_cost')
        .eq('user_id', userId)
        .gte('occurred_at', yesterdayDate + 'T00:00:00Z')
        .lt('occurred_at', yesterdayDate + 'T23:59:59Z')
        .in('event_kind', ['friction_event'])
        .limit(15)
    ),
    safeExecute(
      supabase
        .from('vanguard_daily_aggregates')
        .select('execution_score, final_state, identity_score')
        .eq('user_id', userId)
        .eq('date', yesterdayDate)
        .maybeSingle()
    ),
  ]);

  const plan = (planRow as any)?.planning_summary;
  if (!plan) return [];

  const prodArtifact = plan.production_artifact?.artifact || plan.one_clear_move;
  const tension = plan.tension_action?.action;

  if (!prodArtifact && !tension) return [];

  const p2 = (todayP2 as any)?.p2_parsed;
  const frictions = (todayFriction as any) || [];
  const agg = todayAggregate as any;

  const gaps: string[] = [];

  // Prosta heurystyka rozjazdu
  const hadBigCost = p2?.biggest_cost && p2.biggest_cost.length > 5;
  const hadBlockers = p2?.blocker_candidates?.length > 0;
  const highFriction = frictions.length >= 3;
  const badState = agg && (agg.final_state === 'CHAOS' || agg.final_state === 'AVOIDANCE' || (agg.execution_score ?? 1) < 0.4);

  if (prodArtifact && hadBigCost) {
    gaps.push(`zdefiniowałeś artefakt "${prodArtifact}", a wieczorem nazwałeś duży koszt`);
  }
  if (tension && highFriction) {
    gaps.push(`planowałeś ruch napięciowy, a pojawiło się ${frictions.length} tarć`);
  }
  if ((prodArtifact || tension) && badState) {
    gaps.push(`plan był konkretny, a dzień zakończył się w stanie ${agg?.final_state ?? 'słabym'}`);
  }
  if (p2?.day_score != null && p2.day_score <= 2 && (prodArtifact || tension)) {
    gaps.push(`planowałeś konkretnie, a oceniłeś dzień na ${p2.day_score}/5`);
  }

  if (gaps.length === 0) return [];

  const evidenceText =
    `Wczorajszy plan vs rzeczywistość: ${gaps.join(' + ')}. ` +
    `To nie jest ocena — po prostu powtarzający się schemat w Twoich danych.`;

  return [{
    type: 'plan_adherence_gap',
    title: 'Rozjazd plan vs wykonanie',
    evidenceText,
    confidence: 0.65 + Math.min(gaps.length * 0.1, 0.25),
    sampleSize: 1, // w tej wersji patrzymy na jeden dzień (agregujemy historycznie gdzie indziej)
    lastSeenDate: yesterdayDate,
    metadata: {
      prodArtifact,
      tension,
      p2BiggestCost: p2?.biggest_cost,
      frictionCount: frictions.length,
      finalState: agg?.final_state,
    },
  }];
}

/**
 * Helper: czy warto pokazać insight w danym kontekście (bridge / brief).
 */
export function shouldSurfaceInsight(insight: PatternInsight, minConfidence = 0.55, minSample = 3): boolean {
  if (insight.type === 'plan_adherence_gap') {
    return insight.confidence >= 0.6; // dla adherence nawet pojedynczy mocny dzień ma wartość
  }
  return insight.confidence >= minConfidence && insight.sampleSize >= minSample;
}

/**
 * Zapisuje wykryty wzorzec do dedykowanej tabeli vanguard_behavioral_patterns (Etap 1).
 * Zwraca id stworzonego wiersza (lub null przy błędzie).
 */
export async function recordBehavioralPattern(
  supabase: any,
  userId: string,
  insight: PatternInsight
): Promise<string | null> {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    // Prosty signature dla deduplikacji
    const signature = `${insight.type}:${insight.title.toLowerCase().replace(/\s+/g, '_').substring(0, 80)}`;

    const { data, error } = await supabase
      .from('vanguard_behavioral_patterns')
      .upsert({
        user_id: userId,
        pattern_type: insight.type,
        signature,
        title: insight.title,
        evidence_text: insight.evidenceText,
        first_seen: insight.lastSeenDate || today,
        last_seen: today,
        occurrence_count: 1,
        confidence: insight.confidence,
        status: 'visible',
        metadata: insight.metadata || {},
      }, {
        onConflict: 'user_id,signature',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[vanguardPatterns] recordBehavioralPattern upsert error:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn('[vanguardPatterns] recordBehavioralPattern failed (non-fatal):', e);
    return null;
  }
}

/**
 * Pobiera najświeższe, najsilniejsze wzorce behawioralne z dedykowanej tabeli (Etap 1).
 * Używane w morning-brief, Oracle i weekly synthesis.
 */
export interface BehavioralPattern {
  id: string;
  pattern_type: string;
  title: string | null;
  evidence_text: string;
  confidence: number;
  occurrence_count: number;
  status: string;
  last_seen: string | null;
}

export async function getRecentStrongBehavioralPatterns(
  supabase: any,
  userId: string,
  limit = 5,
  includeRejected = false
): Promise<BehavioralPattern[]> {
  try {
    let query = supabase
      .from('vanguard_behavioral_patterns')
      .select('id, pattern_type, title, evidence_text, confidence, occurrence_count, status, last_seen')
      .eq('user_id', userId)
      .order('confidence', { ascending: false })
      .order('last_seen', { ascending: false })
      .limit(limit);

    if (!includeRejected) {
      query = query.in('status', ['visible', 'user_confirmed', 'pending']);
    }

    const data = await safeExecute(query);

    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      pattern_type: row.pattern_type,
      title: row.title,
      evidence_text: row.evidence_text,
      confidence: row.confidence ?? 0.6,
      occurrence_count: row.occurrence_count ?? 1,
      status: row.status,
      last_seen: row.last_seen,
    }));
  } catch (e) {
    console.warn('[vanguardPatterns] getRecentStrongBehavioralPatterns failed:', e);
    return [];
  }
}

/**
 * Aktualizuje wzorzec na podstawie feedbacku użytkownika.
 * Używane przez patternFeedback handler.
 */
export async function updatePatternFeedback(
  supabase: any,
  userId: string,
  patternId: string,
  action: 'confirm' | 'reject' | 'snooze' | 'exception' | 'deception'
): Promise<void> {
  let newStatus: string;
  let confidenceDelta = 0;
  let extraMetadata: Record<string, any> = {};

  switch (action) {
    case 'confirm':
      newStatus = 'user_confirmed';
      confidenceDelta = 0.12;
      break;
    case 'reject':
      newStatus = 'user_rejected';
      confidenceDelta = -0.22;
      break;
    case 'snooze':
      newStatus = 'snoozed';
      confidenceDelta = -0.08;
      break;
    case 'exception':
      newStatus = 'user_rejected';
      confidenceDelta = -0.15;
      extraMetadata = { adherence_type: 'conscious_exception' };
      break;
    case 'deception':
      newStatus = 'user_confirmed';
      confidenceDelta = 0.20;
      extraMetadata = { adherence_type: 'self_deception' };
      break;
  }

  try {
    const { data: current } = await supabase
      .from('vanguard_behavioral_patterns')
      .select('confidence, occurrence_count, metadata')
      .eq('id', patternId)
      .eq('user_id', userId)
      .single();

    const newConfidence = Math.max(0.1, Math.min(0.98,
      (current?.confidence ?? 0.6) + confidenceDelta
    ));

    await supabase
      .from('vanguard_behavioral_patterns')
      .update({
        status: newStatus,
        confidence: newConfidence,
        metadata: {
          ...(current?.metadata || {}),
          ...extraMetadata,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', patternId)
      .eq('user_id', userId);

  } catch (e) {
    console.warn('[vanguardPatterns] updatePatternFeedback failed:', e);
  }
}

/**
 * Podstawowe logowanie/audyt przed testami Etapu 1.
 * Zaznacza, że dany wzorzec (szczególnie early warning) został faktycznie pokazany użytkownikowi.
 * Aktualizuje last_seen oraz last_shown w metadanych.
 */
export async function markPatternAsShown(
  supabase: any,
  patternId: string,
  date: string = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
): Promise<void> {
  try {
    const { data: current } = await supabase
      .from('vanguard_behavioral_patterns')
      .select('metadata')
      .eq('id', patternId)
      .single();

    await supabase
      .from('vanguard_behavioral_patterns')
      .update({
        last_seen: date,
        metadata: {
          ...(current?.metadata || {}),
          last_shown: date,
        },
      })
      .eq('id', patternId);
  } catch (e) {
    console.warn('[vanguardPatterns] markPatternAsShown failed:', e);
  }
}

/**
 * Mały helper do pobierania recent early warningów.
 * Używany w morning-brief i komendzie `wzorce` dla czystszego kodu.
 */
export async function getRecentEarlyWarnings(
  supabase: any,
  userId: string,
  limit = 5
): Promise<any[]> {
  try {
    const data = await safeExecute(
      supabase
        .from('vanguard_behavioral_patterns')
        .select('id, evidence_text, last_seen, confidence, status, metadata')
        .eq('user_id', userId)
        .eq('pattern_type', 'early_warning')
        .in('status', ['visible', 'user_confirmed'])
        .order('last_seen', { ascending: false })
        .limit(limit)
    );

    // Flatten last_shown for easier use in UI/history
    return (data || []).map((row: any) => ({
      ...row,
      last_shown: row.metadata?.last_shown || null,
    }));
  } catch (e) {
    console.warn('[vanguardPatterns] getRecentEarlyWarnings failed:', e);
    return [];
  }
}

/**
 * S2: Morning protocol impact (Etap 1)
 *
 * Detektor analizuje wpływ porannego protokołu (first_90_protected + phone_first)
 * na wykonanie i stan następnego dnia na podstawie vanguard_daily_aggregates.
 *
 * Aktywowany w reconciliation.ts razem z S1 i S4.
 */
export async function detectMorningProtocolImpact(
  supabase: any,
  userId: string,
  options: { lookbackDays?: number } = {}
): Promise<PatternInsight[]> {
  const lookback = options.lookbackDays ?? 25;

  const cutoff = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString().split('T')[0];

  // Pobierz reconciliations z first_90_protected + operational_facts (phone_first)
  const recs = await safeExecute(
    supabase
      .from('daily_reconciliations')
      .select('date, first_90_protected, planning_summary')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .not('first_90_protected', 'is', null)
      .order('date', { ascending: true })
  );

  if (!recs || recs.length === 0) return [];

  const insights: PatternInsight[] = [];

  for (let i = 0; i < recs.length - 1; i++) {
    const todayRec = recs[i];
    const nextDate = recs[i + 1].date; // bierzemy następny dzień z danych, niekoniecznie +1 kalendarzowo

    const first90Protected = todayRec.first_90_protected;
    const ops = (todayRec.planning_summary as any)?.operational_facts || {};
    const phoneFirst = ops.phone_first === true;

    // Pobierz aggregate następnego dnia
    const nextAgg = await safeExecute(
      supabase
        .from('vanguard_daily_aggregates')
        .select('execution_score, identity_score, final_state')
        .eq('user_id', userId)
        .eq('date', nextDate)
        .maybeSingle()
    );

    if (!nextAgg) continue;

    const exec = nextAgg.execution_score;
    const ident = nextAgg.identity_score;
    const state = nextAgg.final_state;

    // Prosta heurystyka wpływu
    let signal = '';
    if (first90Protected === false || phoneFirst) {
      if (exec != null && exec < 0.45) {
        signal = `pierwsze 90 przerwane / telefon pierwszy → niskie wykonanie następnego dnia (${Math.round(exec * 100)}%)`;
      } else if (state && ['CHAOS', 'AVOIDANCE', 'CONSUMING'].includes(state)) {
        signal = `pierwsze 90 przerwane / telefon pierwszy → następny dzień w stanie ${state}`;
      } else if (ident != null && ident < 60) {
        signal = `pierwsze 90 przerwane / telefon pierwszy → niski identity score następnego dnia (${ident})`;
      }
    }

    if (signal) {
      insights.push({
        type: 'morning_protocol_impact',
        title: 'Wpływ porannego protokołu na następny dzień',
        evidenceText: signal,
        confidence: 0.65,
        sampleSize: 1,
        lastSeenDate: nextDate,
        metadata: {
          date: todayRec.date,
          first_90_protected: first90Protected,
          phone_first: phoneFirst,
          next_day_execution: exec,
          next_day_state: state,
        },
      });
    }
  }

  // Agreguj jeśli jest kilka podobnych sygnałów
  if (insights.length >= 3) {
    return [{
      type: 'morning_protocol_impact',
      title: 'Powtarzający się wpływ porannego protokołu',
      evidenceText: `W ${insights.length} przypadkach z ostatnich ${lookback} dni, przerwanie first 90 lub telefon jako pierwsza czynność poprzedzało wyraźnie słabsze wykonanie lub gorszy stan następnego dnia.`,
      confidence: 0.72,
      sampleSize: insights.length,
      lastSeenDate: insights[insights.length - 1].lastSeenDate,
      metadata: { occurrences: insights.length },
    }];
  }

  return insights.slice(0, 2);
}

/**
 * S3: Sen → następnego dnia dominujący typ tarcia (Etap 1)
 *
 * Prosty detektor korelacji między niskim snem (z aggregates)
 * a konkretnymi typami friction_events następnego dnia.
 *
 * Jeden z czterech wzorców wysokiego ROI z researchu (ETAP_1_RESEARCH...).
 * Kompletujemy czwórkę: S1 (blokery), S2 (poranny protokół), S3 (sen), S4 (plan adherence).
 */
export async function detectSleepFrictionLink(
  supabase: any,
  userId: string,
  options: { lookbackDays?: number } = {}
): Promise<PatternInsight[]> {
  const lookback = options.lookbackDays ?? 30;

  const cutoff = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString().split('T')[0];

  // Pobierz aggregates z sleep_hours
  const aggregates = await safeExecute(
    supabase
      .from('vanguard_daily_aggregates')
      .select('date, sleep_hours')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .not('sleep_hours', 'is', null)
      .order('date', { ascending: true })
  );

  if (!aggregates || aggregates.length === 0) return [];

  const frictionBySleep: Record<string, { lowSleep: number; normalSleep: number }> = {};

  for (let i = 0; i < aggregates.length - 1; i++) {
    const day = aggregates[i];
    const nextDate = aggregates[i + 1].date; // następny dzień z danymi

    const sleep = day.sleep_hours;
    if (sleep == null) continue;

    const isLowSleep = sleep < 6.5;

    // Pobierz friction_events następnego dnia
    const frictions = await safeExecute(
      supabase
        .from('friction_events')
        .select('friction_type')
        .eq('user_id', userId)
        .gte('occurred_at', nextDate + 'T00:00:00Z')
        .lt('occurred_at', nextDate + 'T23:59:59Z')
        .eq('event_kind', 'friction_event')
    );

    if (!frictions || frictions.length === 0) continue;

    for (const f of frictions) {
      const type = f.friction_type || 'other';
      if (!frictionBySleep[type]) {
        frictionBySleep[type] = { lowSleep: 0, normalSleep: 0 };
      }
      if (isLowSleep) {
        frictionBySleep[type].lowSleep++;
      } else {
        frictionBySleep[type].normalSleep++;
      }
    }
  }

  const results: PatternInsight[] = [];

  // Szukamy typów, które wyraźnie częściej pojawiają się po niskim śnie
  Object.entries(frictionBySleep).forEach(([type, counts]) => {
    const total = counts.lowSleep + counts.normalSleep;
    if (total < 4) return; // za mało danych

    const lowRatio = counts.lowSleep / total;
    if (lowRatio > 0.65 && counts.lowSleep >= 3) {
      results.push({
        type: 'sleep_friction_link',
        title: `Niski sen → ${type}`,
        evidenceText: `Po snach poniżej 6.5h u Ciebie wyraźnie częściej pojawia się friction typu ${type} następnego dnia (N=${total}, ${Math.round(lowRatio * 100)}% przypadków po niskim śnie).`,
        confidence: 0.68,
        sampleSize: total,
        lastSeenDate: null,
        metadata: { friction_type: type, low_sleep_count: counts.lowSleep },
      });
    }
  });

  return results.slice(0, 2);
}

/**
 * Pierwszy prosty Early Warning (Etap 1)
 *
 * Wykrywa wczesne sygnały wchodzenia w znany zły reżim:
 * "Poranny dryf + niski sen + powtarzający się blocker" → wysokie ryzyko unikania / niskiego wykonania w najbliższych dniach.
 *
 * Na razie tylko jeden reżim, bardzo konserwatywnie.
 */
// Wartość cooldownu dla Early Warning przed fazą testów.
// 12 dni to rozsądny kompromis, żeby użytkownik nie dostawał tego samego ostrzeżenia co kilka dni.
const DEFAULT_EARLY_WARNING_COOLDOWN_DAYS = 12;

export async function detectEarlyWarningSignals(
  supabase: any,
  userId: string,
  options: { cooldownDays?: number } = {}
): Promise<PatternInsight[]> {
  const cooldownDays = options.cooldownDays ?? DEFAULT_EARLY_WARNING_COOLDOWN_DAYS;

  // Bierzemy ostatnie 5-7 dni danych
  const cutoff = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 3600 * 1000)
    .toISOString()
    .split('T')[0];

  // 1. Sprawdź ostatnie reconciliation pod kątem porannego dryfu (S2 sygnały)
  const recentRecs = await safeExecute(
    supabase
      .from('daily_reconciliations')
      .select('date, first_90_protected, planning_summary')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .order('date', { ascending: false })
      .limit(5)
  );

  let recentMorningDrift = 0;
  let lastDriftDate = '';

  if (recentRecs) {
    for (const r of recentRecs) {
      const ops = (r.planning_summary as any)?.operational_facts || {};
      const phoneFirst = ops.phone_first === true;
      const first90Broken = r.first_90_protected === false;

      if (phoneFirst || first90Broken) {
        recentMorningDrift++;
        if (!lastDriftDate) lastDriftDate = r.date;
      }
    }
  }

  // 2. Sprawdź czy był niski sen/fragmentacja/słaby stan w ostatnich dniach (S3 + nowości)
  const recentAggs = await safeExecute(
    supabase
      .from('vanguard_daily_aggregates')
      .select('date, sleep_hours, fragmentation_index, execution_score, final_state')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .order('date', { ascending: false })
      .limit(5)
  );

  let recentLowSleep = 0;
  if (recentAggs) {
    for (const a of recentAggs) {
      if (a.sleep_hours != null && a.sleep_hours < 6.5) recentLowSleep++;
    }
  }

  // 3. Sprawdź czy w ostatnich dniach był aktywny recurring blocker (S1)
  const recentPatterns = await safeExecute(
    supabase
      .from('vanguard_behavioral_patterns')
      .select('pattern_type, status, last_seen')
      .eq('user_id', userId)
      .eq('pattern_type', 'recurring_blocker')
      .in('status', ['visible', 'user_confirmed'])
      .gte('last_seen', cutoff)
  );

  const hasActiveRecurringBlocker = recentPatterns && recentPatterns.length > 0;

  // Warunek Early Warning (bardzo konserwatywny) — Reżim 1: Poranny dryf + sen + blocker
  const riskSignals = [];
  if (recentMorningDrift >= 2) riskSignals.push('kilka dni z przerwanym first 90 / telefonem rano');
  if (recentLowSleep >= 2) riskSignals.push('niski sen w ostatnich dniach');
  if (hasActiveRecurringBlocker) riskSignals.push('aktywny powtarzający się blocker');

  if (riskSignals.length >= 2) {
    // Cooldown + user rejection check
    const recentWarning = await safeExecute(
      supabase
        .from('vanguard_behavioral_patterns')
        .select('last_seen, status')
        .eq('user_id', userId)
        .eq('pattern_type', 'early_warning')
        .eq('metadata->>regime', 'morning_drift')
        .gte('last_seen', cooldownCutoff)
        .order('last_seen', { ascending: false })
        .limit(1)
    );

    const shouldSuppress = recentWarning?.some((w: any) =>
      w.status === 'user_rejected' || w.last_seen >= cooldownCutoff
    );

    if (!shouldSuppress) {
      return [{
        type: 'early_warning',
        title: 'Wczesny sygnał wejścia w zły schemat',
        evidenceText: `W ostatnich dniach masz ${riskSignals.join(' + ')}. U Ciebie takie kombinacje w przeszłości często poprzedzały silne unikanie i spadek wykonania (ostatnie przypadki: ${lastDriftDate || 'niedawno'}).`,
        confidence: 0.71,
        sampleSize: riskSignals.length,
        lastSeenDate: lastDriftDate || null,
        metadata: {
          regime: 'morning_drift',
          morningDriftDays: recentMorningDrift,
          lowSleepDays: recentLowSleep,
          hasRecurringBlocker: hasActiveRecurringBlocker,
        },
      }];
    }
  }

  // Reżim 2 (drugi prosty): Powtarzające się problemy z plan adherence
  const recentAdherenceWarnings = await safeExecute(
    supabase
      .from('vanguard_behavioral_patterns')
      .select('last_seen, confidence')
      .eq('user_id', userId)
      .eq('pattern_type', 'plan_adherence_gap')
      .in('status', ['visible', 'user_confirmed'])
      .gte('last_seen', cutoff)
      .order('last_seen', { ascending: false })
      .limit(5)
  );

  const recentAdherenceCount = recentAdherenceWarnings ? recentAdherenceWarnings.length : 0;

  if (recentAdherenceCount >= 2) {
    // Cooldown check for second regime
    const recentWarning = await safeExecute(
      supabase
        .from('vanguard_behavioral_patterns')
        .select('last_seen')
        .eq('user_id', userId)
        .eq('pattern_type', 'early_warning')
        .eq('metadata->>regime', 'repeated_adherence_failures')
        .gte('last_seen', cooldownCutoff)
        .order('last_seen', { ascending: false })
        .limit(1)
    );

    if (!recentWarning || recentWarning.length === 0) {
      return [{
        type: 'early_warning',
        title: 'Wczesny sygnał: powtarzające się rozjazdy plan vs wykonanie',
        evidenceText: `W ostatnich dniach miałeś ${recentAdherenceCount} wyraźne rozjazdy między planem a rzeczywistością. U Ciebie takie serie często poprzedzały dłuższy okres niskiego wykonania i unikania.`,
        confidence: 0.68,
        sampleSize: recentAdherenceCount,
        lastSeenDate: recentAdherenceWarnings?.[0]?.last_seen || null,
        metadata: {
          regime: 'repeated_adherence_failures',
          adherenceGapDays: recentAdherenceCount,
        },
      }];
    }
  }

  // Reżim 3: Wysoka fragmentacja + niski sen
  let fragmentationSleepDays = 0;
  let lastFragSleepDate = '';
  if (recentAggs) {
    for (const a of recentAggs) {
      if (a.sleep_hours != null && a.sleep_hours < 6.5 && a.fragmentation_index != null && a.fragmentation_index > 0.55) {
        fragmentationSleepDays++;
        if (!lastFragSleepDate) lastFragSleepDate = a.date;
      }
    }
  }

  if (fragmentationSleepDays >= 2) {
    const recentWarning = await safeExecute(
      supabase
        .from('vanguard_behavioral_patterns')
        .select('last_seen, status')
        .eq('user_id', userId)
        .eq('pattern_type', 'early_warning')
        .eq('metadata->>regime', 'fragmentation_sleep')
        .gte('last_seen', cooldownCutoff)
        .order('last_seen', { ascending: false })
        .limit(1)
    );
    const shouldSuppress = recentWarning?.some((w: any) =>
      w.status === 'user_rejected' || w.last_seen >= cooldownCutoff
    );
    if (!shouldSuppress) {
      return [{
        type: 'early_warning',
        title: 'Wczesny sygnał: wysoka fragmentacja + niski sen',
        evidenceText: `W ostatnich 5 dniach odnotowaliśmy ${fragmentationSleepDays} dni z krótkim snem (<6.5h) i podwyższoną fragmentacją uwagi (>0.55). Ta kombinacja silnie obniża odporność na dryf i unikanie trudnych zadań.`,
        confidence: 0.73,
        sampleSize: fragmentationSleepDays,
        lastSeenDate: lastFragSleepDate || null,
        metadata: {
          regime: 'fragmentation_sleep',
          daysCount: fragmentationSleepDays,
        },
      }];
    }
  }

  // Reżim 4: Przeniesienie unikania z weekendu na tydzień roboczy (Weekend Avoidance Spillover)
  let weekendAvoidance = false;
  let weekendDate = '';
  if (recentAggs) {
    for (const a of recentAggs) {
      const day = new Date(a.date).getDay();
      if (day === 0 || day === 6) { // Niedziela lub Sobota
        if ((a.execution_score != null && a.execution_score < 0.45) || a.final_state === 'AVOIDANCE' || a.final_state === 'CHAOS') {
          weekendAvoidance = true;
          weekendDate = a.date;
          break;
        }
      }
    }
  }

  let mondayTuesdayDrift = false;
  let driftDate = '';
  if (recentRecs) {
    for (const r of recentRecs) {
      const day = new Date(r.date).getDay();
      if (day === 1 || day === 2) { // Poniedziałek lub Wtorek
        const ops = (r.planning_summary as any)?.operational_facts || {};
        const phoneFirst = ops.phone_first === true;
        const first90Broken = r.first_90_protected === false;
        if (phoneFirst || first90Broken) {
          mondayTuesdayDrift = true;
          driftDate = r.date;
          break;
        }
      }
    }
  }

  if (weekendAvoidance && mondayTuesdayDrift) {
    const recentWarning = await safeExecute(
      supabase
        .from('vanguard_behavioral_patterns')
        .select('last_seen, status')
        .eq('user_id', userId)
        .eq('pattern_type', 'early_warning')
        .eq('metadata->>regime', 'weekend_spillover')
        .gte('last_seen', cooldownCutoff)
        .order('last_seen', { ascending: false })
        .limit(1)
    );
    const shouldSuppress = recentWarning?.some((w: any) =>
      w.status === 'user_rejected' || w.last_seen >= cooldownCutoff
    );
    if (!shouldSuppress) {
      return [{
        type: 'early_warning',
        title: 'Wczesny sygnał: przeniesienie unikania z weekendu',
        evidenceText: `Twój weekend (${weekendDate}) przyniósł spadek wykonania lub stan avoidance/chaos, a na początku tygodnia roboczego (${driftDate}) pojawił się poranny dryf (telefon/przerwane pierwsze 90). Grozi to zainfekowaniem całego tygodnia roboczego.`,
        confidence: 0.75,
        sampleSize: 2,
        lastSeenDate: driftDate,
        metadata: {
          regime: 'weekend_spillover',
          weekendDate,
          driftDate,
        },
      }];
    }
  }

  return [];
}

/**
 * S5: Rozbieżność narracja vs biometria (Anty-Self-Deception).
 * Wykrywa dni, w których użytkownik skarży się na zmęczenie/niewyspanie,
 * mimo że biometria (sen >= 6.8h i readiness >= 65) wskazuje na pełną fizyczną regenerację.
 */
export async function detectNarrativeBiometricMismatch(
  supabase: any,
  userId: string,
  options: { lookbackDays?: number } = {}
): Promise<PatternInsight[]> {
  const lookback = options.lookbackDays ?? 14;
  const cutoff = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString().split('T')[0];

  // 1. Pobierz daily_reconciliations z ostatnich N dni
  const recs = await safeExecute(
    supabase
      .from('daily_reconciliations')
      .select('date, user_response, p2_parsed')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .order('date', { ascending: true })
  );

  // 2. Pobierz aggregates z ostatnich N dni
  const aggs = await safeExecute(
    supabase
      .from('vanguard_daily_aggregates')
      .select('date, sleep_hours, readiness_score')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .order('date', { ascending: true })
  );

  if (!recs || recs.length === 0 || !aggs || aggs.length === 0) return [];

  // Map aggregates by date
  const aggMap = new Map<string, { sleep_hours: number | null; readiness_score: number | null }>();
  for (const a of aggs) {
    aggMap.set(a.date, { sleep_hours: a.sleep_hours, readiness_score: a.readiness_score });
  }

  const mismatchDates: Array<{ date: string; sleep: number; readiness: number; declared: string }> = [];

  const tiredKeywords = [/zmęczen/i, /zmęczo/i, /brak.*sił/i, /słab.*sen/i, /niewyspa/i, /padam/i, /wykończo/i, /padnię/i];

  for (const r of recs) {
    const textToCheck = `${r.user_response || ''} ${(r.p2_parsed as any)?.biggest_cost || ''}`;
    const mentionsTiredness = tiredKeywords.some(kw => kw.test(textToCheck));

    if (mentionsTiredness) {
      const agg = aggMap.get(r.date);
      if (agg && agg.sleep_hours != null && agg.readiness_score != null) {
        if (agg.sleep_hours >= 6.8 && agg.readiness_score >= 65) {
          const declaredCost = (r.p2_parsed as any)?.biggest_cost || '';
          mismatchDates.push({
            date: r.date,
            sleep: agg.sleep_hours,
            readiness: agg.readiness_score,
            declared: declaredCost.trim() || r.user_response?.substring(0, 60) || ''
          });
        }
      }
    }
  }

  if (mismatchDates.length === 0) return [];

  const lastMismatch = mismatchDates[mismatchDates.length - 1];
  const count = mismatchDates.length;

  const evidenceText = count === 1
    ? `Dnia ${lastMismatch.date} zadeklarowałeś zmęczenie/niewyspanie ("${lastMismatch.declared.substring(0, 50)}..."), mimo że Twój sen wyniósł ${lastMismatch.sleep}h, a gotowość (readiness) wynosiła ${lastMismatch.readiness}. Może to wskazywać na zmęczenie psychiczne lub opór przed działaniem.`
    : `W ostatnich ${lookback} dniach odnotowaliśmy ${count} dni, w których zgłaszałeś zmęczenie lub brak energii, chociaż gotowość fizyczna (readiness >= 65) oraz sen (>= 6.8h) były na dobrym poziomie (np. dnia ${lastMismatch.date} przy gotowości ${lastMismatch.readiness}).`;

  return [{
    type: 'narrative_biometric_mismatch',
    title: 'Rozbieżność narracja vs biometria',
    evidenceText,
    confidence: 0.65 + Math.min(count * 0.08, 0.25),
    sampleSize: count,
    lastSeenDate: lastMismatch.date,
    metadata: {
      occurrences: count,
      mismatch_details: mismatchDates,
    }
  }];
}
