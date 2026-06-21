/**
 * S1: Powtarzające się blokery użytkownika.
 *
 * Szuka blockerów z p2_parsed.blocker_candidates z ostatnich N dni
 * i sprawdza, czy w kolejnych dniach pojawiły się pasujące friction_events.
 */

import { safeExecute } from '../supabase.ts';
import { getWarsawDayBoundaries } from '../time.ts';
import type { PatternInsight } from './types.ts';

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

  // Warsaw-calendar cutoff, not the UTC date of (now - N days) — `date` is a Warsaw
  // calendar column, and near midnight the UTC date can lag a full day behind Warsaw's.
  const cutoff = new Date(Date.now() - lookback * 24 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

  // 1. Pobierz p2_parsed z ostatnich dni (z blockerami)
  const reconciliations = await safeExecute(
    supabase
      .from('daily_reconciliations')
      .select('date, p2_parsed')
      .eq('user_id', userId)
      .not('p2_parsed', 'is', null)
      .gte('date', cutoff)
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

  for (const [_oldKey, dates] of blockerGroups) {
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
      // blockerDate is a Warsaw calendar date — new Date(blockerDate) parses it as UTC
      // midnight, which is 1-2h *after* true Warsaw midnight. Comparing that bare instant
      // against occurred_at (a real timestamptz) systematically excluded friction in the
      // first 1-2h of the Warsaw day from "correlated", and let the window leak 1-2h into
      // the day after it should have ended. getWarsawDayBoundaries gives the real instant.
      const { start } = getWarsawDayBoundaries(blockerDate);
      const endDateStr = (() => {
        const d = new Date(blockerDate + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + corrWindow);
        return d.toISOString().split('T')[0];
      })();
      const { start: end } = getWarsawDayBoundaries(endDateStr);

      const frictions = await safeExecute(
        supabase
          .from('friction_events')
          .select('friction_type, occurred_at, event_kind')
          .eq('user_id', userId)
          .gte('occurred_at', start)
          .lt('occurred_at', end)
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
