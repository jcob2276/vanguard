import { getTodayWarsaw, shiftDateStr } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth/growth';
import { avg, daysBefore } from './desktopMath';
import type { OuraRow, WorkoutSessionSummary, NutritionDayRow, NarrativeInsight } from './desktopDataTypes';

const DOW_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function computeDayOfWeekReadiness(oura: OuraRow[]) {
  const groups: Record<number, number[]> = {};
  for (const o of oura) {
    if (!o.readiness_score) continue;
    const d = new Date(o.date + 'T12:00:00Z').getDay();
    if (!groups[d]) groups[d] = [];
    groups[d].push(o.readiness_score);
  }
  return [1, 2, 3, 4, 5, 6, 0].map(d => ({
    day: DOW_PL[d],
    avg: groups[d]?.length ? Math.round(avg(groups[d]) ?? 0) : null,
    count: groups[d]?.length || 0
  }));
}

function computeSleepBuckets(oura: OuraRow[]) {
  const BUCKETS: Array<[string, (h: number) => boolean]> = [
    ['<6h', h => h < 6],
    ['6-7h', h => h >= 6 && h < 7],
    ['7-8h', h => h >= 7 && h < 8],
    ['>8h', h => h >= 8]
  ];
  const acc: Record<string, number[]> = Object.fromEntries(BUCKETS.map(([l]) => [l, []]));
  for (let i = 0; i < oura.length - 1; i++) {
    const h = oura[i].total_sleep_hours;
    const next = oura[i + 1]?.readiness_score;
    if (!h || !next) continue;
    const bucket = BUCKETS.find(([, fn]) => fn(h));
    if (bucket) acc[bucket[0]].push(next);
  }
  return BUCKETS.map(([label]) => ({
    label,
    avg: acc[label].length >= 2 ? Math.round(avg(acc[label]) ?? 0) : null,
    count: acc[label].length
  }));
}

function computeNutritionImpact(oura: OuraRow[], nutrition: NutritionDayRow[]) {
  const nutrMap: Record<string, NutritionDayRow> = Object.fromEntries((nutrition || []).map((n) => [n.date, n]));
  const nextDay = (d: string) => shiftDateStr(d, 1);
  const high: number[] = [], low: number[] = [];
  for (const o of oura) {
    const n = nutrMap[o.date];
    const nextReadiness = oura.find((x) => x.date === nextDay(o.date))?.readiness_score;
    if (!n?.protein || !nextReadiness) continue;
    if (n.protein >= 150) high.push(nextReadiness);
    else low.push(nextReadiness);
  }
  const avgHigh = high.length >= 3 ? Math.round(avg(high) ?? 0) : null;
  const avgLow = low.length >= 3 ? Math.round(avg(low) ?? 0) : null;
  return avgHigh && avgLow ? { high: avgHigh, low: avgLow, delta: avgHigh - avgLow } : null;
}

export function computeNarrativeInsights(oura: OuraRow[], sessions: WorkoutSessionSummary[], nutrition: NutritionDayRow[]) {
  const out: NarrativeInsight[] = [];

  // Day-of-week readiness pattern
  const dow = computeDayOfWeekReadiness(oura);
  const bestDow = dow.filter(d => d.avg !== null && d.count >= 3).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const worstDow = dow.filter(d => d.avg !== null && d.count >= 3).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
  if (bestDow && worstDow && bestDow.day !== worstDow.day) {
    const delta = (bestDow.avg ?? 0) - (worstDow.avg ?? 0);
    if (delta >= 7)
      out.push({
        type: 'data',
        urgency: delta >= 14 ? 'high' : 'medium',
        headline: `${bestDow.day} to Twój szczyt — ${bestDow.avg}/100 readiness`,
        evidence: `${worstDow.day} jest o ${delta} pkt niżej (${worstDow.avg}/100). Planuj wymagające sesje i spotkania na ${bestDow.day}–${
          dow[(dow.findIndex(d => d.day === bestDow.day) + 1) % 7]?.day
        }.`
      });
  }

  // Sleep → next day impact
  const buckets = computeSleepBuckets(oura);
  const bestBucket = buckets.filter(b => b.avg !== null && b.count >= 2).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const worstBucket = buckets
    .filter(b => b.avg !== null && b.count >= 2)
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
  if (bestBucket && worstBucket && bestBucket.label !== worstBucket.label) {
    const delta = (bestBucket.avg ?? 0) - (worstBucket.avg ?? 0);
    if (delta >= 8)
      out.push({
        type: 'data',
        urgency: delta >= 16 ? 'high' : 'medium',
        headline: `Sen ${bestBucket.label} → readiness ${bestBucket.avg}. Sen ${worstBucket.label} → ${worstBucket.avg}.`,
        evidence: `${delta} pkt różnicy w readiness zależy od jednej godziny snu. Twój optymalny próg jest wyraźny.`
      });
  }

  // Sleep debt this week
  const debt = oura
    .slice(-7)
    .reduce((acc, o) => (o.total_sleep_hours ? acc + Math.max(0, 7.5 - o.total_sleep_hours) : acc), 0);
  if (debt >= 4)
    out.push({
      type: 'data',
      urgency: 'high',
      headline: `Skumulowany dług senny 7 dni: ${debt.toFixed(1)}h`,
      evidence: `Średnia ${(7.5 - debt / 7).toFixed(1)}h/noc zamiast 7.5h celu. Recovery i HRV są na minusie — priorytet: sen.`
    });

  // Protein impact
  const nutrImpact = computeNutritionImpact(oura, nutrition);
  if (nutrImpact && nutrImpact.delta >= 6)
    out.push({
      type: 'data',
      urgency: 'medium',
      headline: `Białko ≥150g → +${nutrImpact.delta} pkt readiness następnego dnia`,
      evidence: `Z białkiem: ${nutrImpact.high}/100. Bez: ${nutrImpact.low}/100. Dieta bezpośrednio steruje Twoją regeneracją.`
    });

  // Training gap
  const ws = getWeekStartWarsaw(getTodayWarsaw());
  const thisWeek = sessions.filter((s) => (s.date ?? '') >= ws).length;
  const prev3wk = [7, 14, 21].map(
    off => sessions.filter((s) => (s.date ?? '') >= daysBefore(off + 7) && (s.date ?? '') < daysBefore(off)).length
  );
  const avgPrev = avg(prev3wk.filter(v => v > 0));
  if (thisWeek === 0 && avgPrev !== null && avgPrev >= 2)
    out.push({
      type: 'data',
      urgency: 'high',
      headline: `Zerowe treningi w tym tygodniu — Twoja norma to ${(avgPrev ?? 0).toFixed(1)}×/tydzień`,
      evidence: `Ostatnie 3 tygodnie: ${prev3wk.join(', ')} sesji. Ten tydzień: 0. Konsekwencja jest Twoim głównym dźwignią.`
    });

  // HRV trend
  const hrv7 = avg(oura.slice(-7).map((o) => o.hrv_avg).filter((v): v is number => v != null));
  const hrv14 = avg(oura.slice(-14, -7).map((o) => o.hrv_avg).filter((v): v is number => v != null));
  if (hrv7 && hrv14) {
    const delta = Math.round(hrv7 - hrv14);
    if (Math.abs(delta) >= 5)
      out.push({
        type: 'data',
        urgency: Math.abs(delta) >= 10 ? 'high' : 'medium',
        headline: `HRV ${delta > 0 ? '↑ rośnie' : '↓ spada'} — ${delta > 0 ? '+' : ''}${delta}ms vs poprzedni tydzień`,
        evidence: `7d avg: ${Math.round(hrv7)}ms vs ${Math.round(hrv14)}ms tydzień temu. ${
          delta < 0
            ? 'Sygnał: system nerwowy jest pod presją.'
            : 'Dobry kierunek — recovery pracuje.'
        }`
      });
  }

  return out;
}
