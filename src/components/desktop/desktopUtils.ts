import { getTodayWarsaw, formatWarsawDate, shiftDateStr } from '../../lib/date';
import { getWeekStartWarsaw } from '../../lib/growth/growth';
import { format, startOfWeek } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────
export const C = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#38bdf8',
  violet: '#a78bfa'
};

import { isLogWellness, sessionVol } from '../biometrics/workout/workoutUtils';
export { isLogWellness };

export interface OuraRow {
  date: string;
  hrv_avg: number | null;
  rhr_avg: number | null;
  readiness_score: number | null;
  total_sleep_hours: number | null;
  sleep_score?: number | null;
}

export interface WorkoutSessionSummary {
  date: string | null;
  exercise_logs: {
    exercise_name: string;
    weight: number | string | null;
    reps: number | string | null;
    muscle_tags?: string[];
    is_pws_or_msp?: boolean | null;
    rir?: number | null;
    rpe?: number | null;
  }[];
}

export interface StravaActivitySummary {
  start_date: string;
  sport_type: string;
  distance: number | string | null;
}

export interface NutritionDayRow {
  date: string;
  calories?: number | null;
  protein?: number | null;
}

export interface NarrativeInsight {
  type: 'data';
  urgency: 'high' | 'medium';
  headline: string;
  evidence: string;
}

export interface IntelCard {
  type: 'data' | 'pattern' | 'wiki' | 'knowledge';
  urgency?: 'high' | 'medium' | 'low';
  headline?: string | null;
  evidence?: string | null;
  meta?: string | null;
  count?: number;
  importance?: number;
  importance_score?: number | null;
}

export const daysBefore = (n: number) => shiftDateStr(getTodayWarsaw(), -n);

export const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : null;

export function weeklyVolume(sessions: WorkoutSessionSummary[]) {
  const map: Record<string, number> = {};
  const dates: Record<string, Date> = {};
  for (const s of sessions) {
    const ws = startOfWeek(new Date(s.date + 'T12:00:00Z'), { weekStartsOn: 1 });
    const k = formatWarsawDate(ws);
    map[k] = (map[k] || 0) + sessionVol(s);
    dates[k] = ws;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([k, v]) => ({ week: format(dates[k], 'dd.MM'), vol: Math.round(v / 100) / 10 }));
}

export function weeklyRunKm(strava: StravaActivitySummary[]) {
  const runs = strava.filter((a) => ['Run', 'TrailRun', 'VirtualRun', 'Hike'].includes(a.sport_type));
  const map: Record<string, number> = {};
  const dates: Record<string, Date> = {};
  for (const a of runs) {
    const ws = startOfWeek(new Date(a.start_date), { weekStartsOn: 1 });
    const k = formatWarsawDate(ws);
    map[k] = (map[k] || 0) + (parseFloat(String(a.distance)) || 0);
    dates[k] = ws;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([k, v]) => ({ week: format(dates[k], 'dd.MM'), km: Math.round(v / 100) / 10 }));
}

interface Alert {
  type: 'warn' | 'ok';
  msg: string;
}

export function computeAlerts(oura: OuraRow[], _sessions: WorkoutSessionSummary[], _nutrition: NutritionDayRow[]) {
  const alerts: Alert[] = [];
  const lat = oura[oura.length - 1];
  const avg7HRV = avg(oura.slice(-8, -1).map((o) => o.hrv_avg).filter((v): v is number => v != null));
  if (lat?.hrv_avg && avg7HRV && (avg7HRV - lat.hrv_avg) / avg7HRV > 0.12)
    alerts.push({ type: 'warn', msg: `HRV o ${Math.round(avg7HRV - lat.hrv_avg)}ms poniżej 7-dniowej średniej` });
  if (!alerts.length && (lat?.readiness_score ?? 0) >= 70)
    alerts.push({ type: 'ok', msg: 'Sygnały OK — dobry dzień na ciśnięcie' });
  return alerts;
}

// ── Insights helpers ──────────────────────────────────────────────────────────
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

export { SPRINT_SEASON, getSprintInfo } from '../../lib/growth/sprintUtils';

export function sprintMetrics(oura: OuraRow[], sessions: WorkoutSessionSummary[], strava: StravaActivitySummary[], start: string | null, end: string | null) {
  if (!start || !end) return null;
  const o = oura.filter((r) => r.date >= start && r.date <= end);
  const s = sessions.filter((r) => (r.date ?? '') >= start && (r.date ?? '') <= end);
  const runs = strava.filter((a) => {
    const d = a.start_date.slice(0, 10);
    return d >= start && d <= end && ['Run', 'TrailRun', 'VirtualRun'].includes(a.sport_type);
  });
  return {
    avgReadiness: avg(o.map((r) => r.readiness_score).filter((v): v is number => v != null)),
    avgSleep: avg(o.map((r) => r.total_sleep_hours).filter((v): v is number => v != null)),
    avgHRV: avg(o.map((r) => r.hrv_avg).filter((v): v is number => v != null)),
    totalVol: s.reduce((sum, sess) => sum + sessionVol(sess), 0),
    trainDays: s.filter((sess) => sessionVol(sess) > 0).length,
    kmRun: runs.reduce((sum, a) => sum + (parseFloat(String(a.distance)) || 0), 0) / 1000
  };
}

// ── Intelligence Panel config ─────────────────────────────────────────────────
export const INTEL_CFG: Record<
  string,
  {
    label: string;
    urgencyMap: Record<string, string>;
    dot: Record<string, string>;
    badge: string;
  }
> = {
  data: {
    label: 'DANE',
    urgencyMap: {
      high: 'border-rose-500/30 bg-rose-500/[0.04]',
      medium: 'border-amber-500/30 bg-amber-500/[0.04]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' },
    badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
  },
  pattern: {
    label: 'WZORZEC',
    urgencyMap: {
      high: 'border-rose-500/30 bg-rose-500/[0.04]',
      medium: 'border-amber-500/30 bg-amber-500/[0.04]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' },
    badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  },
  wiki: {
    label: 'WIEDZA',
    urgencyMap: {
      high: 'border-emerald-500/30 bg-emerald-500/[0.04]',
      medium: 'border-emerald-500/20 bg-emerald-500/[0.03]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-emerald-500', medium: 'bg-emerald-400', low: 'bg-emerald-400/50' },
    badge: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
  },
  knowledge: {
    label: 'ZASADA',
    urgencyMap: {
      high: 'border-amber-500/30 bg-amber-500/[0.04]',
      medium: 'border-amber-500/20 bg-amber-500/[0.03]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-amber-500', medium: 'bg-amber-400', low: 'bg-amber-300' },
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  }
};

const LOW_VALUE_INTEL_TYPES = new Set(['person', 'source_summary', 'operating_model', 'lesson', 'osoba']);
const LOW_VALUE_INTEL_TITLES = new Set([
  'jakub',
  'poprawka użytkownika',
  'aktualny snapshot operacyjny',
  'aktualne tematy ze streamu'
]);
const LOW_VALUE_INTEL_TEXT = [
  'osoba analizowana',
  'poprawka:',
  'desktop footprint',
  'aktualny model operacyjny składa się',
  'najmocniejszy sygnał:',
  'content:',
  'category:'
];

export function cleanIntelText(value: string | null | undefined, max = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

export function isUsefulIntelCard(card: IntelCard) {
  const headline = String(card.headline || '').trim().toLowerCase();
  const evidence = String(card.evidence || '').trim().toLowerCase();
  const meta = String(card.meta || '').trim().toLowerCase();
  if (!headline || headline.length < 4) return false;
  if (LOW_VALUE_INTEL_TYPES.has(meta)) return false;
  if (LOW_VALUE_INTEL_TITLES.has(headline)) return false;
  if (LOW_VALUE_INTEL_TEXT.some(marker => evidence.includes(marker))) return false;
  if (card.type === 'pattern' && (card.count || 0) < 2) return false;
  if ((card.type === 'wiki' || card.type === 'knowledge') && cleanIntelText(card.evidence).length < 40) return false;
  return true;
}

export function intelScore(card: IntelCard) {
  const urgencyScore = card.urgency === 'high' ? 30 : card.urgency === 'medium' ? 15 : 0;
  const typeScore = card.type === 'data' ? 80 : card.type === 'pattern' ? 55 : card.type === 'knowledge' ? 25 : 15;
  const countScore = Math.min((card.count || 0) * 4, 20);
  const importanceScore = Math.min(card.importance || 0, 10);
  return typeScore + urgencyScore + countScore + importanceScore;
}

// -- Lenie helpers -------------------------------------------------------------
export interface LenieLogRow {
  date: string;
  final_stimulus?: string | null;
  context_note?: string | null;
}

export function computeLenieInsight(logs: LenieLogRow[]) {
  if (!logs?.length) return null;
  const DOW_PL_LOCAL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const recent = logs.slice(0, 10);
  const total30 = logs.filter((l) => l.date >= daysBefore(30)).length;
  const total60 = logs.filter((l) => l.date >= daysBefore(60) && l.date < daysBefore(30)).length;

  // Day-of-week peak
  const dowCount: Record<number, number> = {};
  for (const l of recent) {
    const d = new Date(l.date + 'T12:00:00Z').getUTCDay();
    dowCount[d] = (dowCount[d] || 0) + 1;
  }
  const sorted = Object.entries(dowCount).sort((a, b) => b[1] - a[1]);
  const peakDay = sorted[0] ? DOW_PL_LOCAL[+sorted[0][0]] : null;
  const peakN = sorted[0] ? sorted[0][1] : 0;

  // Top trigger keywords
  const STOP = new Set(
    'i w z na do sie to ze a nie jest bylo mi jak po przez od o ich je co byl ta te ten ta to mnie bo ale go mu tak juz czy wiec az no wtedy kiedy wlaczyl wlaczalem mialem bylo'.split(
      ' '
    )
  );
  const wc: Record<string, number> = {};
  const entryCount: Record<string, number> = {};
  const entriesWithText = recent.filter((l) => l.final_stimulus || l.context_note).length;

  for (const l of recent) {
    const text = [l.context_note || '', l.context_note || '', l.final_stimulus || ''].join(' ');
    const seen = new Set<string>();
    for (const w of text.toLowerCase().split(/\W+/)) {
      if (w.length > 3 && !STOP.has(w) && !seen.has(w)) {
        wc[w] = (wc[w] || 0) + 1;
        entryCount[w] = (entryCount[w] || 0) + 1;
        seen.add(w);
      }
    }
  }
  const noiseThreshold = Math.max(2, Math.ceil(entriesWithText * 0.6));
  const topW = Object.entries(entryCount)
    .filter(([, c]) => c >= 2 && c < noiseThreshold)
    .sort((a, b) => (wc[b[0]] || 0) - (wc[a[0]] || 0))
    .slice(0, 3)
    .map(([w]) => w);

  // Trend
  const trend = total60 > 0 ? Math.round((total30 - total60) / total60 * 100) : null;

  // Build sentences
  const parts = [];

  if (trend !== null && Math.abs(trend) >= 20) {
    parts.push(`${trend > 0 ? 'Wzrost' : 'Spadek'} o ${Math.abs(trend)}% vs poprzedni miesiąc (${total30} vs ${total60} wpadek).`);
  } else if (total30 > 0) {
    parts.push(
      `${total30} wpadki/wpadek w ostatnich 30 dniach${
        total60 > 0 ? ` — stabilna częstotliwość (${total60} poprzednio)` : ''
      }.`
    );
  }

  if (peakDay && peakN > 1) {
    parts.push(`Najczęstszy dzień wpadki: ${peakDay} (${peakN}/${recent.length} ostatnich).`);
  }

  if (topW.length) {
    parts.push(`Dominujące słowa w triggerach: ${topW.join(', ')}.`);
  }

  if (!parts.length) return 'Za mało danych do wyciągnięcia wzorca.';
  return parts.join(' ');
}
