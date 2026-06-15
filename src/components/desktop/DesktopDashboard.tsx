import { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, startOfWeek, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Dumbbell, Smartphone, Moon, Sun, Target, Briefcase, Zap, CheckSquare, Square, Trash2, Plus, X } from 'lucide-react';
import { subDays } from 'date-fns';

const WorkoutLogger = lazy(() => import('../biometrics/WorkoutLogger'));

// ── Constants ─────────────────────────────────────────────────────────────────
const RACE_DATE = new Date('2026-10-04T09:00:00+02:00');
const C = { indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e', sky: '#38bdf8', violet: '#a78bfa' };
const LIMITER_PL = { sleep: 'sen', calories: 'kalorie', carbs: 'węgle', cardio_load: 'cardio', strength_load: 'siłownia', mental_load: 'głowa', recovery_ok: 'OK' };
const WELLNESS_NAMES = ['sauna', 'lodowata', 'zimny prysznic', 'stretching', 'foam rolling'];
const isLogWellness  = (l) => (l.muscle_tags||[]).includes('wellness') || WELLNESS_NAMES.some(w => (l.exercise_name||'').toLowerCase().startsWith(w));

type ChartTooltipPayload = {
  color?: string;
  name?: string | number;
  value?: string | number;
};

type LenieLog = {
  date: string;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────
const daysBefore = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

function weekStartDate() {
  const ds = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const d = new Date(ds + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}

function sessionVol(s) {
  return (s.exercise_logs || []).reduce((sum, l) => {
    if (isLogWellness(l)) return sum;
    return sum + (parseFloat(l.weight) || 0) * (parseInt(l.reps) || 0);
  }, 0);
}

function sessionMuscles(s) {
  const seen = new Set();
  (s.exercise_logs || []).forEach(l => (l.muscle_tags || []).forEach(t => { if (t !== 'wellness') seen.add(t); }));
  return [...seen].slice(0, 3).join(', ') || '—';
}

function weeklyVolume(sessions) {
  const map: Record<string, number> = {}, dates: Record<string, Date> = {};
  for (const s of sessions) {
    const ws = startOfWeek(new Date(s.date + 'T12:00:00'), { weekStartsOn: 1 });
    const k = ws.toISOString().slice(0, 10);
    map[k] = (map[k] || 0) + sessionVol(s);
    dates[k] = ws;
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-10)
    .map(([k, v]) => ({ week: format(dates[k], 'dd.MM'), vol: Math.round(v / 100) / 10 }));
}

function muscleBreakdown(sessions) {
  const map: Record<string, number> = {};
  const cutoff = daysBefore(30);
  for (const s of sessions) {
    if (s.date < cutoff) continue;
    for (const l of (s.exercise_logs || [])) {
      const tags = l.muscle_tags || [];
      if (!tags.length || tags.includes('wellness')) continue;
      const v = (parseFloat(l.weight) || 0) * (parseInt(l.reps) || 0);
      if (v > 0) map[tags[0]] = (map[tags[0]] || 0) + v;
    }
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([m, v]) => ({ m, v: Math.round(v) }));
}

function weeklyRunKm(strava) {
  const runs = strava.filter(a => ['Run', 'TrailRun', 'VirtualRun', 'Hike'].includes(a.sport_type));
  const map: Record<string, number> = {}, dates: Record<string, Date> = {};
  for (const a of runs) {
    const ws = startOfWeek(new Date(a.start_date), { weekStartsOn: 1 });
    const k = ws.toISOString().slice(0, 10);
    map[k] = (map[k] || 0) + (parseFloat(a.distance) || 0);
    dates[k] = ws;
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
    .map(([k, v]) => ({ week: format(dates[k], 'dd.MM'), km: Math.round(v / 100) / 10 }));
}

function computeCorrelations(oura, sessions) {
  if (oura.length < 10) return [];
  const sessionMap = Object.fromEntries(sessions.map(s => [s.date, s]));
  const nextDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 1); return dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }); };
  const prevDate = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() - 1); return dt.toLocaleDateString('en-CA'); };
  const goodSleep   = oura.filter(o => (o.total_sleep_hours || 0) >= 7);
  const shortSleep  = oura.filter(o => o.total_sleep_hours > 0 && o.total_sleep_hours < 6.5);
  const volAfter    = (days) => days.map(o => sessionVol(sessionMap[nextDate(o.date)] || { exercise_logs: [] })).filter(v => v > 0);
  const avgGoodVol  = avg(volAfter(goodSleep));
  const avgShortVol = avg(volAfter(shortSleep));
  const withHRV     = oura.filter(o => o.hrv_avg && o.readiness_score).sort((a, b) => a.hrv_avg - b.hrv_avg);
  const t           = Math.floor(withHRV.length / 3);
  const avgReadHigh = avg(withHRV.slice(-t).map(o => o.readiness_score));
  const avgReadLow  = avg(withHRV.slice(0, t).map(o => o.readiness_score));
  const trainedDates = new Set(sessions.map(s => s.date));
  const recovAfterTrain = oura.filter(o => trainedDates.has(prevDate(o.date))).map(o => o.readiness_score).filter(Boolean);
  const recovAfterRest  = oura.filter(o => !trainedDates.has(prevDate(o.date))).map(o => o.readiness_score).filter(Boolean);
  return [
    avgGoodVol && avgShortVol && Math.abs(avgGoodVol - avgShortVol) > 500 ? {
      title: 'Sen a objętość treningu',
      good: { label: '≥7h snu', val: `${(avgGoodVol/1000).toFixed(1)} Mg` },
      bad:  { label: '<6.5h snu', val: `${(avgShortVol/1000).toFixed(1)} Mg` },
      delta: Math.round((avgGoodVol - avgShortVol) / avgShortVol * 100), positive: avgGoodVol > avgShortVol,
    } : null,
    avgReadHigh && avgReadLow ? {
      title: 'HRV a readiness',
      good: { label: 'HRV wysoki', val: `${Math.round(avgReadHigh)}/100` },
      bad:  { label: 'HRV niski',  val: `${Math.round(avgReadLow)}/100` },
      delta: Math.round(avgReadHigh - avgReadLow), positive: true,
    } : null,
    recovAfterTrain.length > 2 && recovAfterRest.length > 2 ? {
      title: 'Readiness po treningu vs odpoczynku',
      good: { label: 'Po treningu', val: `${Math.round(avg(recovAfterTrain))}/100` },
      bad:  { label: 'Po odpoczynku', val: `${Math.round(avg(recovAfterRest))}/100` },
      delta: Math.round(avg(recovAfterTrain) - avg(recovAfterRest)),
      positive: avg(recovAfterTrain) >= avg(recovAfterRest),
    } : null,
  ].filter(Boolean);
}

function cockpitDecision(status, limiter, strain, provisional) {
  const fuelLimiter = limiter === 'calories' || limiter === 'carbs';
  if (status === 'green') return 'Możesz cisnąć — wszystko na zielono';
  if (status === 'red') {
    if (limiter === 'sleep') return 'Zadedykuj czas na sen i odpoczynek';
    if (fuelLimiter && !provisional) return 'Uzupełnij energię — niski bilans';
    return 'Ładowanie baterii / Regeneracja';
  }
  if (limiter === 'sleep') return 'Umiarkowanie — sen poniżej normy';
  if (fuelLimiter && !provisional) return 'Umiarkowanie — dobierz kalorie';
  if (limiter === 'cardio_load' || limiter === 'strength_load') return 'Umiarkowanie — wczoraj duży koszt';
  return (strain || 0) < 8 ? 'Lekki dzień — jest zapas' : 'Umiarkowanie — monitoruj';
}

function computeDigest(sessions, oura, strava) {
  const ws = weekStartDate();
  const weekSess    = sessions.filter(s => s.date >= ws);
  const wellnessSess = weekSess.filter(s => (s.exercise_logs||[]).length > 0 && (s.exercise_logs||[]).every(l => isLogWellness(l)));
  const trainSess   = weekSess.filter(s => !wellnessSess.includes(s));
  const weekRuns    = strava.filter(a => ['Run','TrailRun','VirtualRun'].includes(a.sport_type) && a.start_date.slice(0,10) >= ws);
  const weekOura    = oura.filter(o => o.date >= ws);
  return {
    sessions: trainSess.length,
    wellness: wellnessSess.length,
    kmRun: weekRuns.reduce((s, a) => s + (parseFloat(a.distance)||0), 0) / 1000,
    avgSleep: avg(weekOura.map(o => o.total_sleep_hours).filter(Boolean)),
    avgReadiness: avg(weekOura.map(o => o.readiness_score).filter(Boolean)),
    totalVol: trainSess.reduce((s, sess) => s + sessionVol(sess), 0),
  };
}

function computeAlerts(oura, sessions, nutrition) {
  const alerts = [];
  const lat = oura[oura.length - 1];
  const avg7HRV = avg(oura.slice(-8, -1).map(o => o.hrv_avg).filter(Boolean));
  if (lat?.hrv_avg && avg7HRV && (avg7HRV - lat.hrv_avg) / avg7HRV > 0.12)
    alerts.push({ type: 'warn', msg: `HRV o ${Math.round(avg7HRV - lat.hrv_avg)}ms poniżej 7-dniowej średniej` });
  const lastS = [...sessions].filter(s => sessionVol(s) > 0).reverse()[0];
  const daysSince = lastS ? Math.floor((Date.now() - new Date(lastS.date + 'T12:00:00').getTime()) / 86400000) : null;
  if (daysSince !== null && daysSince >= 3)
    alerts.push({ type: 'warn', msg: `${daysSince} dni bez treningu siłowego` });
  const lowSleep = oura.slice(-3).filter(o => o.total_sleep_hours > 0 && o.total_sleep_hours < 7).length;
  if (lowSleep >= 2) alerts.push({ type: 'warn', msg: `${lowSleep}/3 ostatnich nocy poniżej 7h snu` });
  const lowKcal = nutrition.slice(-3).filter(n => n.calories > 100 && n.calories < 2200).length;
  if (lowKcal >= 2) alerts.push({ type: 'info', msg: `Niskie kalorie ${lowKcal} dni pod rząd` });
  if (!alerts.length && (lat?.readiness_score ?? 0) >= 70)
    alerts.push({ type: 'ok', msg: 'Sygnały OK — dobry dzień na ciśnięcie' });
  return alerts;
}

const calcSleepDebt = (oura) =>
  +oura.slice(-7).reduce((acc, o) => o.total_sleep_hours ? acc + (8 - o.total_sleep_hours) : acc, 0).toFixed(1);

function trendDelta(oura, field) {
  const latest = oura[oura.length - 1]?.[field];
  const week   = oura[Math.max(0, oura.length - 8)]?.[field];
  if (!latest || !week) return null;
  const delta = +(latest - week).toFixed(1);
  return delta !== 0 ? { delta: Math.abs(delta), up: delta > 0 } : null;
}

function pushPullBalance(sessions) {
  const PUSH = new Set(['klatka', 'triceps', 'barki', 'przedni-bark']);
  const PULL = new Set(['plecy', 'biceps', 'tylny-bark', 'grzbiet', 'trapez']);
  let push = 0, pull = 0;
  const cutoff = daysBefore(30);
  for (const s of sessions) {
    if (s.date < cutoff) continue;
    for (const l of (s.exercise_logs || [])) {
      const tags = l.muscle_tags || [];
      const v = (parseFloat(l.weight)||0) * (parseInt(l.reps)||0);
      if (tags.some(t => PUSH.has(t))) push += v;
      if (tags.some(t => PULL.has(t))) pull += v;
    }
  }
  return push + pull > 0 ? { push, pull } : null;
}

// ── Insights helpers ──────────────────────────────────────────────────────────
const DOW_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function computeDayOfWeekReadiness(oura) {
  const groups = {};
  for (const o of oura) {
    if (!o.readiness_score) continue;
    const d = new Date(o.date + 'T12:00:00').getDay();
    if (!groups[d]) groups[d] = [];
    groups[d].push(o.readiness_score);
  }
  return [1,2,3,4,5,6,0].map(d => ({
    day: DOW_PL[d],
    avg: groups[d]?.length ? Math.round(avg(groups[d])) : null,
    count: groups[d]?.length || 0,
  }));
}

function computeSleepBuckets(oura) {
  const BUCKETS: Array<[string, (h: number) => boolean]> = [['<6h', h => h < 6], ['6-7h', h => h >= 6 && h < 7], ['7-8h', h => h >= 7 && h < 8], ['>8h', h => h >= 8]];
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
    avg: acc[label].length >= 2 ? Math.round(avg(acc[label])) : null,
    count: acc[label].length,
  }));
}

function computeNutritionImpact(oura, nutrition) {
  const nutrMap = Object.fromEntries((nutrition||[]).map(n => [n.date, n]));
  const nextDay = (d) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 1); return dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }); };
  const high = [], low = [];
  for (const o of oura) {
    const n = nutrMap[o.date];
    if (!n?.protein || !oura.find(x => x.date === nextDay(o.date))?.readiness_score) continue;
    const next = oura.find(x => x.date === nextDay(o.date)).readiness_score;
    if (n.protein >= 150) high.push(next); else low.push(next);
  }
  const avgHigh = high.length >= 3 ? Math.round(avg(high)) : null;
  const avgLow  = low.length >= 3  ? Math.round(avg(low))  : null;
  return avgHigh && avgLow ? { high: avgHigh, low: avgLow, delta: avgHigh - avgLow } : null;
}

function computeNarrativeInsights(oura, sessions, nutrition, wins) {
  const out = [];

  // Day-of-week readiness pattern
  const dow = computeDayOfWeekReadiness(oura);
  const bestDow  = dow.filter(d => d.avg && d.count >= 3).sort((a, b) => b.avg - a.avg)[0];
  const worstDow = dow.filter(d => d.avg && d.count >= 3).sort((a, b) => a.avg - b.avg)[0];
  if (bestDow && worstDow && bestDow.day !== worstDow.day) {
    const delta = bestDow.avg - worstDow.avg;
    if (delta >= 7) out.push({
      type: 'data', urgency: delta >= 14 ? 'high' : 'medium',
      headline: `${bestDow.day} to Twój szczyt — ${bestDow.avg}/100 readiness`,
      evidence: `${worstDow.day} jest o ${delta} pkt niżej (${worstDow.avg}/100). Planuj wymagające sesje i spotkania na ${bestDow.day}–${dow[(dow.findIndex(d => d.day === bestDow.day) + 1) % 7]?.day}.`,
    });
  }

  // Sleep → next day impact
  const buckets = computeSleepBuckets(oura);
  const bestBucket  = buckets.filter(b => b.avg && b.count >= 2).sort((a, b) => b.avg - a.avg)[0];
  const worstBucket = buckets.filter(b => b.avg && b.count >= 2).sort((a, b) => a.avg - b.avg)[0];
  if (bestBucket && worstBucket && bestBucket.label !== worstBucket.label) {
    const delta = bestBucket.avg - worstBucket.avg;
    if (delta >= 8) out.push({
      type: 'data', urgency: delta >= 16 ? 'high' : 'medium',
      headline: `Sen ${bestBucket.label} → readiness ${bestBucket.avg}. Sen ${worstBucket.label} → ${worstBucket.avg}.`,
      evidence: `${delta} pkt różnicy w readiness zależy od jednej godziny snu. Twój optymalny próg jest wyraźny.`,
    });
  }

  // Sleep debt this week
  const debt = oura.slice(-7).reduce((acc, o) => o.total_sleep_hours ? acc + Math.max(0, 7.5 - o.total_sleep_hours) : acc, 0);
  if (debt >= 4) out.push({
    type: 'data', urgency: 'high',
    headline: `Skumulowany dług senny 7 dni: ${debt.toFixed(1)}h`,
    evidence: `Średnia ${(7.5 - debt / 7).toFixed(1)}h/noc zamiast 7.5h celu. Recovery i HRV są na minusie — priorytet: sen.`,
  });

  // Protein impact
  const nutrImpact = computeNutritionImpact(oura, nutrition);
  if (nutrImpact && nutrImpact.delta >= 6) out.push({
    type: 'data', urgency: 'medium',
    headline: `Białko ≥150g → +${nutrImpact.delta} pkt readiness następnego dnia`,
    evidence: `Z białkiem: ${nutrImpact.high}/100. Bez: ${nutrImpact.low}/100. Dieta bezpośrednio steruje Twoją regeneracją.`,
  });

  // Training gap
  const ws = weekStartDate();
  const thisWeek = sessions.filter(s => s.date >= ws).length;
  const prev3wk = [7, 14, 21].map(off => sessions.filter(s => s.date >= daysBefore(off + 7) && s.date < daysBefore(off)).length);
  const avgPrev = avg(prev3wk.filter(v => v > 0));
  if (thisWeek === 0 && avgPrev >= 2) out.push({
    type: 'data', urgency: 'high',
    headline: `Zerowe treningi w tym tygodniu — Twoja norma to ${avgPrev.toFixed(1)}×/tydzień`,
    evidence: `Ostatnie 3 tygodnie: ${prev3wk.join(', ')} sesji. Ten tydzień: 0. Konsekwencja jest Twoim głównym dźwignią.`,
  });

  // HRV trend
  const hrv7   = avg(oura.slice(-7).map(o => o.hrv_avg).filter(Boolean));
  const hrv14  = avg(oura.slice(-14, -7).map(o => o.hrv_avg).filter(Boolean));
  if (hrv7 && hrv14) {
    const delta = Math.round(hrv7 - hrv14);
    if (Math.abs(delta) >= 5) out.push({
      type: 'data', urgency: Math.abs(delta) >= 10 ? 'high' : 'medium',
      headline: `HRV ${delta > 0 ? '↑ rośnie' : '↓ spada'} — ${delta > 0 ? '+' : ''}${delta}ms vs poprzedni tydzień`,
      evidence: `7d avg: ${Math.round(hrv7)}ms vs ${Math.round(hrv14)}ms tydzień temu. ${delta < 0 ? 'Sygnał: system nerwowy jest pod presją.' : 'Dobry kierunek — recovery pracuje.'}`,
    });
  }

  return out;
}

// ── Sprint logic (personal year = March 1) ────────────────────────────────────
const SPRINT_SEASON = ['', 'Wiosna', 'Lato', 'Jesień', 'Zima'];
const SPRINT_DAYS = 84; // 12 × 7

function getSprintInfo() {
  const ds  = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const d   = new Date(ds + 'T12:00:00');
  const yr  = d.getFullYear();
  let anchor = new Date(`${yr}-03-01T00:00:00`);
  if (d < anchor) anchor = new Date(`${yr - 1}-03-01T00:00:00`);
  const personalYear   = anchor.getFullYear();
  const daysSince      = Math.floor((d.getTime() - anchor.getTime()) / 86400000);
  const weeksSince     = Math.floor(daysSince / 7);
  const sprintNumber   = Math.floor(weeksSince / 12) + 1;
  const weekInSprint   = (weeksSince % 12) + 1;
  const dayInSprint    = daysSince % SPRINT_DAYS;
  const startOffset    = (sprintNumber - 1) * SPRINT_DAYS;
  const sprintStart    = new Date(anchor.getTime() +  startOffset          * 86400000);
  const sprintEnd      = new Date(anchor.getTime() + (startOffset + 83)   * 86400000);
  const prevStart      = sprintNumber > 1 ? new Date(anchor.getTime() + (startOffset - SPRINT_DAYS) * 86400000) : null;
  const prevEnd        = prevStart        ? new Date(anchor.getTime() + (startOffset - 1)            * 86400000) : null;
  const fmt = (dt) => dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  return {
    personalYear, sprintNumber, weekInSprint, dayInSprint,
    daysLeft: SPRINT_DAYS - dayInSprint - 1,
    pct: Math.round((dayInSprint / SPRINT_DAYS) * 100),
    sprintStart: fmt(sprintStart), sprintEnd: fmt(sprintEnd),
    prevStart: prevStart ? fmt(prevStart) : null,
    prevEnd:   prevEnd   ? fmt(prevEnd)   : null,
  };
}

function sprintMetrics(oura, sessions, strava, start, end) {
  if (!start || !end) return null;
  const o    = oura.filter(r => r.date >= start && r.date <= end);
  const s    = sessions.filter(r => r.date >= start && r.date <= end);
  const runs = strava.filter(a => {
    const d = a.start_date.slice(0, 10);
    return d >= start && d <= end && ['Run', 'TrailRun', 'VirtualRun'].includes(a.sport_type);
  });
  return {
    avgReadiness: avg(o.map(r => r.readiness_score).filter(Boolean)),
    avgSleep:     avg(o.map(r => r.total_sleep_hours).filter(Boolean)),
    avgHRV:       avg(o.map(r => r.hrv_avg).filter(Boolean)),
    totalVol:     s.reduce((sum, sess) => sum + sessionVol(sess), 0),
    trainDays:    s.filter(sess => sessionVol(sess) > 0).length,
    kmRun:        runs.reduce((sum, a) => sum + (parseFloat(a.distance) || 0), 0) / 1000,
  };
}

// ── Streak helper ────────────────────────────────────────────────────────────
function computeWeekStreak(sessions) {
  const ws = weekStartDate();
  let streak = 0;
  const cursor = new Date(ws + 'T12:00:00');
  for (let i = 0; i < 52; i++) {
    const wStart = cursor.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const wEnd   = new Date(cursor.getTime() + 6 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const hasTrain = sessions.some(s => s.date >= wStart && s.date <= wEnd && sessionVol(s) > 0);
    if (!hasTrain) break;
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

// ── Data hook ─────────────────────────────────────────────────────────────────
function useDesktopData(userId) {
  const [s, setS] = useState({ loading: true, oura: [], nutrition: [], sessions: [], body: [], strain: null, strava: [], projects: [], moves: [], goals: null, sprintGoals: [], stream: [], patterns: [], wins: [], wiki: [], knowledge: [], lenieLogs: [], habits: [], habitLogs: [] });
  const load = useCallback(async () => {
    if (!userId) return;
    setS(p => ({ ...p, loading: true }));
    const [
      { data: oura }, { data: nutrition }, { data: sessions },
      { data: body },  { data: strain },   { data: strava },
      { data: projects }, { data: moves },  { data: goals },
      { data: sprintGoalRows }, { data: streamRows }, { data: patternRows }, { data: winsRows },
      { data: wikiRows }, { data: knowledgeRows }, { data: lenieRows },
      { data: habitsRows }, { data: habitLogsRows },
    ] = await Promise.all([
      supabase.from('oura_daily_summary').select('date,hrv_avg,rhr_avg,total_sleep_hours,readiness_score').eq('user_id', userId).gte('date', daysBefore(60)).order('date', { ascending: true }),
      supabase.from('daily_nutrition').select('date,calories,protein').eq('user_id', userId).gte('date', daysBefore(14)).order('date', { ascending: true }),
      supabase.from('workout_sessions').select('id,date,workout_day,session_rpe,exercise_logs(exercise_name,weight,reps,muscle_tags)').eq('user_id', userId).gte('date', daysBefore(91)).order('date', { ascending: true }),
      supabase.from('body_metrics').select('date,weight').eq('user_id', userId).gte('date', daysBefore(90)).order('date', { ascending: true }),
      supabase.from('daily_strain').select('daily_status,main_limiter,strain_score,recovery_score,fueling_score,fueling_provisional').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('strava_activities_clean').select('sport_type,distance,start_date').eq('user_id', userId).gte('start_date', daysBefore(84)+'T00:00:00').order('start_date', { ascending: true }),
      supabase.from('career_projects').select('id,name,status,sense_status,area,thesis').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('career_moves').select('id,title,status,completed_at,planned_for,project_id').eq('user_id', userId).neq('status', 'dropped').order('updated_at', { ascending: false }).limit(80),
      supabase.from('life_goals').select('goal_cialo,goal_duch,goal_konto,date_cialo,date_duch,date_konto').eq('user_id', userId).maybeSingle(),
      supabase.from('sprint_goals').select('id,personal_year,sprint_number,goal_text').eq('user_id', userId).order('personal_year').order('sprint_number'),
      supabase.from('vanguard_stream').select('id,source,content,classification,category,tags,importance_score,timestamp').eq('user_id', userId).neq('source', 'eval_interview').gte('importance_score', 5).gte('timestamp', daysBefore(14)+'T00:00:00').order('importance_score', { ascending: false }).order('timestamp', { ascending: false }).limit(14),
      supabase.from('vanguard_behavioral_patterns').select('id,title,evidence_text,pattern_type,occurrence_count,confidence,last_seen,status').eq('user_id', userId).eq('status', 'active').order('occurrence_count', { ascending: false }).limit(10),
      supabase.from('daily_wins').select('date,mood_score,daily_rpe,journal_entry,tags').eq('user_id', userId).gte('date', daysBefore(14)).order('date', { ascending: true }),
      supabase.from('vanguard_wiki_pages').select('id,title,page_type,summary,confidence,updated_at').eq('user_id', userId).eq('status', 'active').not('summary', 'is', null).order('updated_at', { ascending: false }).limit(6),
      supabase.from('vanguard_knowledge').select('id,title,content,category,importance_score,tags').eq('user_id', userId).eq('is_verified', true).gte('importance_score', 7).order('importance_score', { ascending: false }).limit(6),
      supabase.from('habit_logs').select('date,logged_at,final_stimulus,context_note,habits!inner(name,is_positive)').eq('user_id', userId).eq('habits.is_positive', false).ilike('habits.name', '%lenie%').order('date', { ascending: false }).limit(10),
      supabase.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('habit_logs').select('*').eq('user_id', userId).gte('date', subDays(new Date(), 30).toISOString().split('T')[0]),
    ]);
    setS({ loading: false, oura: oura||[], nutrition: nutrition||[], sessions: sessions||[], body: body||[], strain: strain||null, strava: strava||[], projects: projects||[], moves: moves||[], goals: goals||null, sprintGoals: sprintGoalRows||[], stream: streamRows||[], patterns: patternRows||[], wins: winsRows||[], wiki: wikiRows||[], knowledge: knowledgeRows||[], lenieLogs: lenieRows||[], habits: habitsRows||[], habitLogs: habitLogsRows||[] });
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  return { ...s, refresh: load };
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Tip({ active = false, payload = [], label = '' }: { active?: boolean; payload?: ChartTooltipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-custom bg-surface-solid px-3 py-2 shadow-lg text-[11px]">
      <p className="text-text-muted font-bold mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }} className="font-black">{p.name}: {p.value}</p>)}
    </div>
  );
}

function Panel({ title, children, className = '' }) {
  return (
    <div className={`rounded-[20px] border border-border-custom bg-surface p-5 shadow-sm ${className}`}>
      {title && <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted mb-4 pb-2.5 border-b border-border-custom">{title}</p>}
      {children}
    </div>
  );
}

function KPI({ label, value, unit, color = 'text-text-primary', barMax, note, trend }) {
  const pct = barMax && value ? Math.min((value / barMax) * 100, 100) : null;
  return (
    <div className="rounded-[16px] border border-border-custom bg-surface px-4 py-3.5 flex flex-col gap-0.5 shadow-sm">
      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={`font-display text-[26px] font-black leading-none ${color}`}>
        {value ?? '—'}{unit && <span className="text-[11px] font-semibold text-text-muted ml-1">{unit}</span>}
      </p>
      {trend && (
        <p className={`text-[9px] font-bold mt-0.5 ${trend.up ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend.up ? '↑' : '↓'} {trend.delta} vs 7d temu
        </p>
      )}
      {note && <p className="text-[9px] text-text-muted mt-0.5">{note}</p>}
      {pct !== null && <div className="h-1 mt-1.5 bg-border-custom rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.indigo }} /></div>}
    </div>
  );
}

// ── Smart Alerts ──────────────────────────────────────────────────────────────
function SmartAlerts({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set());
  const visible = alerts.filter((_, i) => !dismissed.has(i));
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((a, i) => {
        if (dismissed.has(i)) return null;
        const cfg = {
          warn: 'bg-amber-500/[0.07] border-amber-500/25 text-amber-700 dark:text-amber-400',
          info: 'bg-sky-500/[0.07] border-sky-500/25 text-sky-700 dark:text-sky-400',
          ok:   'bg-emerald-500/[0.07] border-emerald-500/25 text-emerald-700 dark:text-emerald-400',
        }[a.type];
        const icon = { warn: '⚠', info: 'ℹ', ok: '✓' }[a.type];
        return (
          <div key={i} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${cfg}`}>
            <span>{icon}</span>
            <span>{a.msg}</span>
            <button onClick={() => setDismissed(d => new Set([...d, i]))} className="ml-1 opacity-40 hover:opacity-100 transition-opacity cursor-pointer text-[13px] leading-none">×</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Weekly Digest ─────────────────────────────────────────────────────────────
function WeeklyDigest({ digest, movesDoneThisWeek, streak }) {
  if (!digest) return null;
  const items = [
    digest.sessions > 0 && { label: 'treningi', value: `${digest.sessions}×`, color: 'text-indigo-500' },
    digest.totalVol > 0 && { label: 'objętość', value: `${(digest.totalVol/1000).toFixed(1)} Mg`, color: 'text-indigo-400' },
    digest.kmRun > 0.1 && { label: 'km biegu', value: digest.kmRun.toFixed(1), color: 'text-amber-500' },
    movesDoneThisWeek > 0 && { label: 'ruchy kariery', value: `${movesDoneThisWeek}×`, color: 'text-amber-400' },
    digest.avgSleep && { label: 'śr. sen', value: `${digest.avgSleep.toFixed(1)}h`, color: digest.avgSleep >= 7 ? 'text-emerald-500' : 'text-amber-500' },
    digest.avgReadiness && { label: 'śr. readiness', value: `${Math.round(digest.avgReadiness)}/100`, color: digest.avgReadiness >= 70 ? 'text-emerald-500' : 'text-amber-500' },
    digest.wellness > 0 && { label: 'wellness', value: `${digest.wellness}×`, color: 'text-teal-500' },
    streak > 1 && { label: 'tyg. z rzędu', value: `${streak}×`, color: 'text-violet-400' },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="rounded-[16px] border border-border-custom bg-surface/60 px-5 py-3 flex items-center gap-8">
      <span className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted shrink-0">Ten tydzień</span>
      <div className="flex items-center gap-8 flex-wrap">
        {items.map(({ label, value, color }) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className={`font-display text-[19px] font-black leading-none ${color}`}>{value}</span>
            <span className="text-[8px] text-text-muted font-bold">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 1. Cockpit ────────────────────────────────────────────────────────────────
function CockpitBanner({ strain, oura }) {
  const latest = oura[oura.length - 1];
  if (!strain && !latest) return null;
  const status = strain?.daily_status || 'unknown';
  const cfg = {
    green:  { bg: 'bg-emerald-500/[0.05] border-emerald-500/25', dot: 'bg-emerald-500', pulse: 'bg-emerald-400', tag: 'ZIELONY' },
    yellow: { bg: 'bg-amber-500/[0.05] border-amber-500/25',     dot: 'bg-amber-400',   pulse: 'bg-amber-300',   tag: 'ŻÓŁTY' },
    red:    { bg: 'bg-rose-500/[0.05] border-rose-500/25',       dot: 'bg-rose-500',     pulse: 'bg-rose-400',    tag: 'CZERWONY' },
  }[status] || { bg: 'bg-surface border-border-custom', dot: 'bg-text-muted', pulse: 'bg-text-muted', tag: '—' };
  const msg     = strain ? cockpitDecision(status, strain.main_limiter, strain.strain_score, strain.fueling_provisional) : '—';
  const limiter = strain?.main_limiter && strain.main_limiter !== 'recovery_ok' ? LIMITER_PL[strain.main_limiter] : null;
  const readColor = !latest?.readiness_score ? 'text-text-muted' : latest.readiness_score >= 70 ? 'text-emerald-500' : latest.readiness_score >= 50 ? 'text-amber-500' : 'text-rose-500';
  const ouraAge = latest?.date ? Math.floor((Date.now() - new Date(latest.date + 'T12:00:00').getTime()) / 86400000) : null;
  return (
    <div className={`rounded-[24px] border ${cfg.bg} px-8 py-6 flex items-center justify-between gap-8`}>
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="relative flex items-center justify-center w-3 h-3">
            <div className={`absolute w-3 h-3 rounded-full ${cfg.pulse} opacity-40 animate-ping`} />
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted">{cfg.tag} — COCKPIT</span>
        </div>
        <p className="font-display text-[32px] font-black leading-tight text-text-primary">{msg}</p>
        {limiter && <p className="text-[11px] text-text-secondary mt-1.5">Limiter: <span className="font-black">{limiter}</span></p>}
        {ouraAge !== null && ouraAge > 0 && (
          <p className="text-[8px] text-text-muted/60 mt-2">● Oura: {ouraAge === 1 ? 'wczoraj' : `${ouraAge} dni temu`}</p>
        )}
      </div>
      <div className="flex gap-6 shrink-0">
        {[
          { label: 'Readiness', val: latest?.readiness_score, unit: '/100', color: readColor },
          { label: 'HRV',       val: latest?.hrv_avg,          unit: 'ms' },
          { label: 'Sen',       val: latest?.total_sleep_hours ? +latest.total_sleep_hours.toFixed(1) : null, unit: 'h' },
          { label: 'Recovery',  val: strain?.recovery_score,   unit: '/100' },
          { label: 'Fueling',   val: strain?.fueling_score,    unit: '/100' },
        ].map(({ label, val, unit, color }) => (
          <div key={label} className="text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-1">{label}</p>
            <p className={`font-display text-[22px] font-black leading-none ${color || 'text-text-primary'}`}>
              {val ?? '—'}<span className="text-[10px] text-text-muted font-semibold ml-0.5">{unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 2. Heatmap with tooltip ───────────────────────────────────────────────────
function Heatmap({ sessions }) {
  const [tooltip, setTooltip] = useState(null);
  const today    = new Date();
  const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

  const dateMap = {};
  for (const s of sessions) {
    const vol      = sessionVol(s);
    const wellness = (s.exercise_logs||[]).length > 0 && (s.exercise_logs||[]).every(l => isLogWellness(l));
    const exercises = [...new Set((s.exercise_logs||[]).map(l => l.exercise_name))].slice(0, 3);
    dateMap[s.date] = { vol, wellness, name: s.workout_day, exercises, rpe: s.session_rpe };
  }

  const start = new Date(today.getTime() - 90 * 86400000);
  const dow   = start.getDay();
  start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
  const weeks = [], cur = new Date(start);
  while (weeks.length < 13) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const ds = cur.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      week.push({ date: ds, future: ds > todayStr, data: dateMap[ds] || null });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const cellColor = ({ future, data }) => {
    if (future) return 'bg-transparent border border-border-custom/20';
    if (!data)  return 'bg-border-custom';
    if (data.wellness) return 'bg-teal-500/50';
    const v = data.vol;
    if (v < 3000)  return 'bg-indigo-400/30';
    if (v < 8000)  return 'bg-indigo-500/55';
    if (v < 15000) return 'bg-indigo-600/80';
    return 'bg-indigo-700';
  };

  const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

  return (
    <div>
      <div className="flex gap-1.5 items-start">
        <div className="flex flex-col gap-[5px] pt-7 mr-1">
          {DAYS.map(d => <div key={d} className="text-[8px] text-text-muted w-4 h-3.5 flex items-center">{d}</div>)}
        </div>
        <div className="flex gap-1 flex-1 overflow-hidden">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[5px] flex-1">
              <div className="text-[8px] text-text-muted h-6 flex items-end pb-0.5">
                {wi % 3 === 0 ? format(parseISO(week[0].date), 'dd.MM') : ''}
              </div>
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`h-3.5 rounded-sm transition-opacity ${day.data ? 'cursor-pointer hover:opacity-70' : 'cursor-default'} ${cellColor(day)}`}
                  onMouseEnter={day.data ? (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ day, rect });
                  } : undefined}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: Math.min(tooltip.rect.right + 10, window.innerWidth - 190),
            top: Math.max(8, tooltip.rect.top - 36),
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="rounded-[14px] border border-border-custom bg-surface shadow-xl px-3.5 py-2.5 min-w-[160px]"
        >
          <p className="text-[9px] font-black text-text-muted mb-1">{tooltip.day.date}</p>
          {tooltip.day.data.name && <p className="text-[12px] font-black text-text-primary leading-tight">{tooltip.day.data.name}</p>}
          {tooltip.day.data.wellness ? (
            <p className="text-[10px] text-teal-500 font-bold mt-0.5">Wellness</p>
          ) : (
            <>
              {tooltip.day.data.vol > 0 && <p className="text-[11px] font-bold text-indigo-400 mt-0.5">{(tooltip.day.data.vol/1000).toFixed(1)} Mg</p>}
              {tooltip.day.data.rpe && <p className="text-[9px] text-text-muted mt-0.5">RPE <span className="font-black">{tooltip.day.data.rpe}</span></p>}
            </>
          )}
          {tooltip.day.data.exercises.length > 0 && (
            <p className="text-[9px] text-text-muted mt-1 leading-relaxed">{tooltip.day.data.exercises.join(' · ')}</p>
          )}
        </div>,
        document.body
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-custom">
        <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Legenda:</span>
        {[
          { color: 'bg-border-custom',  label: 'Odpoczynek' },
          { color: 'bg-teal-500/50',    label: 'Wellness' },
          { color: 'bg-indigo-400/30',  label: '<3 Mg' },
          { color: 'bg-indigo-500/55',  label: '3–8 Mg' },
          { color: 'bg-indigo-600/80',  label: '8–15 Mg' },
          { color: 'bg-indigo-700',     label: '>15 Mg' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-[8px] text-text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. Marathon ───────────────────────────────────────────────────────────────
function MarathonPanel({ strava, grid, tick }) {
  const daysLeft  = differenceInDays(RACE_DATE, new Date());
  const weeksLeft = Math.ceil(daysLeft / 7);
  const kmData    = weeklyRunKm(strava);
  const recent4   = kmData.slice(-4);
  const avgKm     = recent4.length ? Math.round(avg(recent4.map(w => w.km)) * 10) / 10 : null;
  const bestKm    = kmData.length  ? Math.max(...kmData.map(w => w.km)) : null;
  return (
    <Panel title="Maraton Gdańsk — 04.10.2026">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-display text-[40px] font-black leading-none text-text-primary">{daysLeft}</p>
          <p className="text-[10px] font-bold text-text-muted mt-1">dni do startu · {weeksLeft} tygodni</p>
        </div>
        <div className="text-right space-y-2">
          {avgKm !== null && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Avg 4 tygodnie</p>
              <p className="font-display text-[22px] font-black text-amber-500 leading-none">{avgKm} <span className="text-[11px] text-text-muted">km/tyg</span></p>
            </div>
          )}
          {bestKm !== null && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Rekord tyg.</p>
              <p className="font-display text-[18px] font-black text-text-primary leading-none">{bestKm} <span className="text-[11px] text-text-muted">km</span></p>
            </div>
          )}
        </div>
      </div>
      {kmData.length > 1 ? (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={kmData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="gRun" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={C.amber} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="week" tick={{ fontSize: 9, fill: tick }} />
            <YAxis tick={{ fontSize: 9, fill: tick }} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="km" name="km" stroke={C.amber} fill="url(#gRun)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-24 text-[11px] text-text-muted">Brak danych — zsynchronizuj Stravę</div>
      )}
    </Panel>
  );
}

// ── 4. Career & Goals ────────────────────────────────────────────────────────
const STATUS_CFG = {
  doing:   { dot: 'bg-sky-500',     badge: 'bg-sky-500/10 text-sky-500 border-sky-500/20',           label: 'W toku' },
  done:    { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', label: 'Done' },
  blocked: { dot: 'bg-rose-500',    badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',         label: 'Blokada' },
  todo:    { dot: 'bg-text-muted',  badge: 'bg-surface border-border-custom text-text-muted',          label: 'Plan' },
};

const SENSE_CFG = {
  sense:     { label: 'Sens',     cls: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/[0.06]' },
  unsure:    { label: 'Niepewny', cls: 'text-amber-500 border-amber-500/30 bg-amber-500/[0.06]' },
  cut:       { label: 'Odcięty', cls: 'text-rose-500 border-rose-500/30 bg-rose-500/[0.06]' },
  completed: { label: 'Gotowe',  cls: 'text-text-muted border-border-custom bg-surface' },
};

const LIFE_PILLARS = [
  { key: 'goal_cialo', dateKey: 'date_cialo', label: 'Ciało',  color: 'text-emerald-500', borderBg: 'bg-emerald-500/[0.05] border-emerald-500/20', Icon: Target },
  { key: 'goal_duch',  dateKey: 'date_duch',  label: 'Duch',   color: 'text-indigo-400',  borderBg: 'bg-indigo-500/[0.05] border-indigo-500/20',   Icon: Zap },
  { key: 'goal_konto', dateKey: 'date_konto', label: 'Konto',  color: 'text-amber-400',   borderBg: 'bg-amber-500/[0.05] border-amber-500/20',     Icon: Briefcase },
];

function CareerSection({ goals, projects, moves }) {
  const projMap    = Object.fromEntries((projects||[]).map(p => [p.id, p]));
  const activeProj = (projects||[]).filter(p => p.sense_status !== 'cut' && p.sense_status !== 'completed');
  const ws         = weekStartDate();
  const doneWeek   = (moves||[]).filter(m => m.status === 'done' && (m.completed_at||'').slice(0,10) >= ws);
  const inProgress = (moves||[]).filter(m => m.status === 'doing');
  const blocked    = (moves||[]).filter(m => m.status === 'blocked');

  const feedMoves  = [
    ...inProgress,
    ...blocked,
    ...(moves||[]).filter(m => m.status === 'done').slice(0, 8),
  ].slice(0, 14);

  return (
    <Panel title="Kariera & Cele">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Aktywne projekty', val: activeProj.length,  color: 'text-text-primary' },
          { label: 'Done ten tydzień', val: doneWeek.length,    color: 'text-emerald-500' },
          { label: 'W toku',           val: inProgress.length,  color: 'text-sky-500' },
          { label: 'Zablokowane',      val: blocked.length,     color: blocked.length > 0 ? 'text-rose-500' : 'text-text-muted' },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-[14px] border border-border-custom bg-surface-solid px-4 py-3 text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted mb-1">{label}</p>
            <p className={`font-display text-[28px] font-black leading-none ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6">
        {/* Left: projects + moves feed */}
        <div className="space-y-5">
          {activeProj.length > 0 && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-2.5">Projekty ({activeProj.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {activeProj.slice(0, 6).map(p => {
                  const sense = SENSE_CFG[p.sense_status] || SENSE_CFG.unsure;
                  return (
                    <div key={p.id} className="rounded-[12px] border border-border-custom bg-surface-solid px-3.5 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-text-primary truncate leading-tight">{p.name}</p>
                        {p.area && <p className="text-[9px] text-text-muted mt-0.5">{p.area}</p>}
                      </div>
                      <span className={`shrink-0 text-[7px] font-black uppercase tracking-wider border rounded-md px-1.5 py-0.5 ${sense.cls}`}>{sense.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {feedMoves.length > 0 && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-2.5">Ruchy kariery</p>
              <div className="divide-y divide-border-custom/40">
                {feedMoves.map(m => {
                  const cfg  = STATUS_CFG[m.status] || STATUS_CFG.todo;
                  const proj = projMap[m.project_id];
                  const dateStr = m.completed_at
                    ? new Date(m.completed_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' })
                    : m.planned_for
                      ? `plan: ${new Date(m.planned_for + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' })}`
                      : null;
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <p className="text-[12px] font-semibold text-text-primary flex-1 truncate">{m.title}</p>
                      {proj && <span className="text-[9px] text-text-muted shrink-0 hidden xl:block truncate max-w-[130px]">{proj.name}</span>}
                      {dateStr && <span className="text-[9px] text-text-muted shrink-0 whitespace-nowrap">{dateStr}</span>}
                      <span className={`shrink-0 text-[7px] font-black uppercase tracking-wider border rounded-md px-1.5 py-0.5 ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!activeProj.length && !feedMoves.length && (
            <p className="text-[11px] text-text-muted py-6 text-center">Brak projektów — dodaj je w module Kariery</p>
          )}
        </div>

        {/* Right: life goals */}
        {goals && (
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-3">Kierunki życia</p>
            <div className="space-y-3">
              {LIFE_PILLARS.map(({ key, dateKey, label, color, borderBg, Icon }) => {
                const text = goals[key];
                const days = goals[dateKey] ? differenceInDays(parseISO(goals[dateKey]), new Date()) : null;
                if (!text) return null;
                return (
                  <div key={key} className={`rounded-[16px] border ${borderBg} px-4 py-3.5`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={12} className={`${color} shrink-0`} />
                      <span className={`text-[8px] font-black uppercase tracking-wider ${color}`}>{label}</span>
                      {days !== null && (
                        <span className={`ml-auto text-[9px] font-black rounded-lg px-2 py-0.5 border ${
                          days <= 30 ? 'bg-amber-500/15 border-amber-500/30 text-amber-500' : 'border-border-custom text-text-muted'
                        }`}>{days}d</span>
                      )}
                    </div>
                    <p className="text-[13px] font-semibold text-text-primary leading-snug">{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── 5. Intelligence Panel ─────────────────────────────────────────────────────
const INTEL_CFG = {
  data:     { label: 'DANE',    urgencyMap: { high: 'border-rose-500/30 bg-rose-500/[0.04]', medium: 'border-amber-500/30 bg-amber-500/[0.04]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' }, badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  pattern:  { label: 'WZORZEC', urgencyMap: { high: 'border-rose-500/30 bg-rose-500/[0.04]', medium: 'border-amber-500/30 bg-amber-500/[0.04]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' }, badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  wiki:     { label: 'WIEDZA',  urgencyMap: { high: 'border-emerald-500/30 bg-emerald-500/[0.04]', medium: 'border-emerald-500/20 bg-emerald-500/[0.03]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-emerald-500', medium: 'bg-emerald-400', low: 'bg-emerald-400/50' }, badge: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  knowledge:{ label: 'ZASADA',  urgencyMap: { high: 'border-amber-500/30 bg-amber-500/[0.04]', medium: 'border-amber-500/20 bg-amber-500/[0.03]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-amber-500', medium: 'bg-amber-400', low: 'bg-amber-300' }, badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

function IntelligencePanel({ oura, sessions, nutrition, wins, patterns, wiki, knowledge }) {
  const dataInsights = computeNarrativeInsights(oura, sessions, nutrition, wins);

  const cards = [
    ...dataInsights.map(i => ({ ...i, type: 'data' })),
    ...(patterns||[]).map(p => ({
      type: 'pattern',
      urgency: (p.confidence||0) >= 0.7 ? 'high' : 'medium',
      headline: p.title,
      evidence: p.evidence_text,
      meta: `${p.occurrence_count}× · ${p.last_seen || ''}`,
    })),
    ...(wiki||[]).filter(w => w.summary).map(w => ({
      type: 'wiki',
      urgency: 'medium',
      headline: w.title,
      evidence: w.summary,
      meta: w.page_type,
    })),
    ...(knowledge||[]).map(k => ({
      type: 'knowledge',
      urgency: (k.importance_score||0) >= 9 ? 'high' : 'medium',
      headline: k.title,
      evidence: k.content,
      meta: k.category,
    })),
  ];

  if (!cards.length) return (
    <Panel title="Intelligence — za mało danych">
      <p className="text-[11px] text-text-muted text-center py-8">Wnioski pojawią się po kilku tygodniach danych.</p>
    </Panel>
  );

  return (
    <Panel title="Intelligence — co powinieneś wiedzieć">
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card, i) => {
          const cfg = INTEL_CFG[card.type] || INTEL_CFG.data;
          const urgency = card.urgency || 'medium';
          return (
            <div key={i} className={`rounded-[16px] border px-4 py-4 flex flex-col gap-2 ${cfg.urgencyMap[urgency]}`}>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot[urgency]}`} />
                <span className={`text-[7px] font-black uppercase tracking-[0.2em] border rounded-md px-1.5 py-0.5 ${cfg.badge}`}>{cfg.label}</span>
                {card.meta && <span className="text-[7px] text-text-muted ml-auto truncate max-w-[100px]">{card.meta}</span>}
              </div>
              <p className="text-[13px] font-bold text-text-primary leading-snug">{card.headline}</p>
              {card.evidence && (
                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-4">{card.evidence}</p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// -- Lenie mini-panel --------------------------------------------------------
function computeLenieInsight(logs) {
  if (!logs?.length) return null;
  const DOW_PL   = ['Nd', 'Pn', 'Wt', 'Sr', 'Cz', 'Pt', 'Sb'];
  const DOW_FULL = ['niedziela', 'poniedzialek', 'wtorek', 'sroda', 'czwartek', 'piatek', 'sobota'];
  const recent   = logs.slice(0, 10);
  const total30  = logs.filter(l => l.date >= daysBefore(30)).length;
  const total60  = logs.filter(l => l.date >= daysBefore(60) && l.date < daysBefore(30)).length;

  // Day-of-week peak
  const dowCount = {};
  for (const l of recent) {
    const d = new Date(l.date + 'T12:00:00').getDay();
    dowCount[d] = (dowCount[d] || 0) + 1;
  }
  const sorted   = Object.entries(dowCount).sort((a, b) => +b[1] - +a[1]);
  const peakDay  = sorted[0] ? DOW_PL[+sorted[0][0]] : null;
  const peakN    = sorted[0] ? +sorted[0][1] : 0;

  // Top trigger keywords
  const STOP = new Set('i w z na do sie to ze a nie jest bylo mi jak po przez od o ich je co byl ta te ten ta to'.split(' '));
  const wc   = {};
  for (const l of recent) {
    for (const w of (l.final_stimulus || '').toLowerCase().split(/\W+/)) {
      if (w.length > 3 && !STOP.has(w)) wc[w] = (wc[w] || 0) + 1;
    }
  }
  const topW = Object.entries(wc).sort((a, b) => +b[1] - +a[1]).slice(0, 2).map(([w]) => w);

  // Trend
  const trend = total60 > 0 ? Math.round((total30 - total60) / total60 * 100) : null;

  // Build sentences
  const parts = [];

  if (trend !== null && Math.abs(trend) >= 20) {
    parts.push(`${trend > 0 ? 'Wzrost' : 'Spadek'} o ${Math.abs(trend)}% vs poprzedni miesiąc (${total30} vs ${total60} wpadek).`);
  } else if (total30 > 0) {
    parts.push(`${total30} wpadki/wpadek w ostatnich 30 dniach${total60 > 0 ? ` — stabilna częstotliwość (${total60} poprzednio)` : ''}.`);
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

function LeniePanelMini({ logs, userId: _userId = null, accessToken: _accessToken = null }: { logs?: LenieLog[]; userId?: string | null; accessToken?: string | null }) {
  const totalMonth = (logs || []).filter(l => l.date >= daysBefore(30)).length;
  const totalWeek  = (logs || []).filter(l => l.date >= daysBefore(7)).length;
  const lastDate   = (logs || [])[0]?.date ?? null;
  const daysFree   = lastDate
    ? Math.floor((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000)
    : null;
  const freeColor  = daysFree === null ? 'text-text-muted'
    : daysFree === 0 ? 'text-rose-500'
    : daysFree <= 2  ? 'text-amber-400'
    : 'text-emerald-500';

  const insight = computeLenieInsight(logs);

  if (!logs?.length) return null;

  return (
    <div className="rounded-[20px] border border-rose-500/15 bg-rose-500/[0.025] px-6 py-4 flex items-center gap-8">
      <p className="text-[8px] font-black uppercase tracking-[0.25em] text-rose-500/50 shrink-0">Lenie</p>

      <div className="flex items-center gap-6 shrink-0">
        {[
          { label: 'Ten tydzie\u0144', val: totalWeek,  color: totalWeek > 0 ? 'text-rose-500' : 'text-emerald-500' },
          { label: '30 dni',       val: totalMonth, color: 'text-text-secondary' },
          { label: 'Czyste dni',   val: daysFree === 0 ? 'dzi\u015b' : daysFree !== null ? `${daysFree}d` : '\u2014', color: freeColor },
        ].map(({ label, val, color }) => (
          <div key={label} className="text-center">
            <p className="text-[7px] font-black uppercase tracking-wider text-text-muted mb-0.5">{label}</p>
            <p className={`font-display text-[18px] font-black leading-none ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 min-w-0 border-l border-border-custom/40 pl-6">
        {insight
          ? <p className="text-[11px] text-text-secondary leading-relaxed">{insight}</p>
          : <p className="text-[10px] text-text-muted italic">Za ma\u0142o danych do analizy.</p>
        }
      </div>
    </div>
  );
}

// ── Sprint Panel ──────────────────────────────────────────────────────────────
function SprintPanel({ sprint, sprintGoal, onSave, metrics, prevMetrics, careerMetrics, goals, currentWeight, weight30ago }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(sprintGoal?.goal_text || '');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const delta = (curr, prev, decimals = 0) => {
    if (curr == null || prev == null) return null;
    const d = +(curr - prev).toFixed(decimals);
    return d !== 0 ? { abs: Math.abs(d), up: d > 0 } : null;
  };

  const BODY = [
    { label: 'Readiness', curr: metrics?.avgReadiness, prev: prevMetrics?.avgReadiness, fmt: v => `${Math.round(v)}` },
    { label: 'Sen avg',   curr: metrics?.avgSleep,     prev: prevMetrics?.avgSleep,     fmt: v => `${v.toFixed(1)}h`, dec: 1 },
    { label: 'Treningi',  curr: metrics?.trainDays,    prev: prevMetrics?.trainDays,    fmt: v => `${v}×` },
    { label: 'Km biegu',  curr: metrics?.kmRun,        prev: prevMetrics?.kmRun,        fmt: v => `${v.toFixed(0)}`, dec: 1 },
    { label: 'Objętość',  curr: metrics?.totalVol ? +(metrics.totalVol/1000).toFixed(1) : null, prev: prevMetrics?.totalVol ? +(prevMetrics.totalVol/1000).toFixed(1) : null, fmt: v => `${v}Mg`, dec: 1 },
    ...(currentWeight != null ? [{ label: 'Waga', curr: currentWeight, prev: weight30ago, fmt: v => `${v.toFixed(1)}`, dec: 1 }] : []),
  ];

  const CAREER = [
    { label: 'Done w sprincie', val: careerMetrics?.doneInSprint, color: 'text-emerald-500' },
    { label: 'W toku',          val: careerMetrics?.inProgress,   color: 'text-sky-400' },
    { label: 'Zablokowane',     val: careerMetrics?.blocked,      color: careerMetrics?.blocked > 0 ? 'text-rose-500' : 'text-text-primary' },
    { label: 'Projekty',        val: careerMetrics?.activeProjects,color: 'text-amber-400' },
  ];

  return (
    <div className="rounded-[24px] border border-primary/15 bg-primary/[0.03] p-6">

      {/* Header + goal + progress */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-text-muted">Personal year {sprint.personalYear}</span>
          <span className="rounded-full border border-primary/20 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5">
            Sprint {sprint.sprintNumber} · {SPRINT_SEASON[sprint.sprintNumber] || `S${sprint.sprintNumber}`}
          </span>
        </div>

        {editing ? (
          <div className="flex gap-3 items-start mb-4">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSave(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="Cel sprintu — co ma się wydarzyć w tych 12 tygodniach?"
              className="flex-1 bg-surface border border-primary/30 rounded-[14px] p-3 text-[15px] font-semibold text-text-primary outline-none resize-none focus:border-primary/60 leading-snug"
              rows={2}
              autoFocus
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <button onClick={handleSave} disabled={saving}
                className="rounded-[10px] bg-primary text-white text-[9px] font-black uppercase px-3 py-2 cursor-pointer hover:bg-primary-hover disabled:opacity-50 transition-all">
                {saving ? '…' : 'Zapisz'}
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-[10px] border border-border-custom text-[9px] font-black uppercase px-3 py-2 text-text-muted cursor-pointer hover:text-text-primary transition-all">
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setDraft(sprintGoal?.goal_text || ''); setEditing(true); }}
            className="text-left group cursor-pointer mb-4 block w-full">
            {sprintGoal?.goal_text
              ? <p className="text-[20px] font-black text-text-primary leading-snug group-hover:text-primary transition-colors">{sprintGoal.goal_text}</p>
              : <p className="text-[15px] font-semibold text-text-muted italic group-hover:text-primary transition-colors">+ Dodaj cel sprintu…</p>
            }
          </button>
        )}

        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[9px] font-bold text-text-muted">Tydzień {sprint.weekInSprint} / 12</span>
            <span className="text-[9px] font-bold text-text-muted">{sprint.daysLeft} dni do końca sprintu</span>
          </div>
          <div className="h-2.5 bg-border-custom rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${sprint.pct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] text-text-muted">{sprint.sprintStart}</span>
            <span className="text-[9px] font-black text-primary">{sprint.pct}% ukończone</span>
            <span className="text-[8px] text-text-muted">{sprint.sprintEnd}</span>
          </div>
        </div>
      </div>

      {/* 3 life pillars */}
      <div className="grid grid-cols-3 gap-6 pt-5 border-t border-primary/10">

        {/* Ciało */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-3">Ciało</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {BODY.map(({ label, curr, prev, fmt, dec }) => {
              const d = curr != null && prev != null ? delta(curr, prev, dec ?? 0) : null;
              return (
                <div key={label}>
                  <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
                  <p className="font-display text-[18px] font-black leading-none text-text-primary">{curr != null ? fmt(curr) : '—'}</p>
                  {d && <p className={`text-[8px] font-bold mt-0.5 ${d.up ? 'text-emerald-500' : 'text-rose-500'}`}>{d.up ? '↑' : '↓'} {fmt(d.abs)}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kariera */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-500 mb-3">Kariera</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {CAREER.map(({ label, val, color }) => (
              <div key={label}>
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
                <p className={`font-display text-[18px] font-black leading-none ${color}`}>{val ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cele */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-3">Cele kierunkowe</p>
          <div className="space-y-2">
            {goals?.goal_konto && (
              <div className="rounded-[10px] bg-amber-500/[0.06] border border-amber-500/15 px-3 py-2.5">
                <p className="text-[7px] font-black uppercase tracking-wider text-amber-400 mb-1">Konto</p>
                <p className="text-[11px] font-semibold text-text-primary leading-snug line-clamp-2">{goals.goal_konto}</p>
              </div>
            )}
            {goals?.goal_duch && (
              <div className="rounded-[10px] bg-indigo-500/[0.06] border border-indigo-500/15 px-3 py-2.5">
                <p className="text-[7px] font-black uppercase tracking-wider text-indigo-400 mb-1">Duch</p>
                <p className="text-[11px] font-semibold text-text-primary leading-snug line-clamp-2">{goals.goal_duch}</p>
              </div>
            )}
            {!goals?.goal_konto && !goals?.goal_duch && (
              <p className="text-[10px] text-text-muted italic">Brak celów kierunkowych</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DesktopDashboard({ session }) {
  const userId      = session?.user?.id;
  const accessToken = session?.access_token;
  const { oura, nutrition, sessions, body, strain, strava, projects, moves, goals, sprintGoals, patterns, wins, wiki, knowledge, lenieLogs, habits: habitsData, habitLogs: habitLogsData, refresh } = useDesktopData(userId);
  const [habits, setHabits] = useState(habitsData);
  const [habitLogs, setHabitLogs] = useState(habitLogsData);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', icon: '✅', is_positive: true });

  useEffect(() => { setHabits(habitsData); }, [habitsData]);
  useEffect(() => { setHabitLogs(habitLogsData); }, [habitLogsData]);

  async function addHabit() {
    if (!newHabit.name.trim()) return;
    const { data, error } = await supabase.from('habits').insert({ user_id: userId, ...newHabit, name: newHabit.name.trim() }).select().single();
    if (!error) { setHabits(prev => [...prev, data]); setNewHabit({ name: '', icon: '✅', is_positive: true }); setIsAddingHabit(false); }
  }

  async function deleteHabit(id) {
    if (!confirm('Usunąć nawyk?')) return;
    await supabase.from('habits').delete().eq('id', id);
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  async function toggleHabit(habitId) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const existing = habitLogs.find(l => l.habit_id === habitId && l.date === today);
    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
      if (!error) setHabitLogs(prev => prev.filter(l => l.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habitId, date: today, completed: true }).select().single();
      if (!error) setHabitLogs(prev => [...prev, data]);
    }
  }
  const [syncing,     setSyncing]     = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [theme,       setTheme]       = useState(() => localStorage.getItem('vanguard_theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('vanguard_theme', theme);
  }, [theme]);

  const grid = theme === 'dark' ? '#2d3748' : '#e5e7eb';
  const tick = theme === 'dark' ? '#9ca3af' : '#6b7280';

  const syncAll = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    const base = import.meta.env.VITE_SUPABASE_URL;
    const call = async (fn, b = {}) => {
      const r = await fetch(`${base}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(b),
      });
      if (!r.ok) throw new Error(fn);
    };
    try {
      await Promise.all([
        call('sync-yazio', { userId, sync_history: true, days: 7 }),
        call('sync-oura', { userId }),
        call('sync-calendar', { userId })
      ]);
      await Promise.all([call('sync-oura-enhanced', { userId, days: 2 }), call('sync-oura-timeseries', { userId, days: 2 })]);
      await call('sync-strava', {});
      await call('compute-daily-strain', { userId, days: 2 });
      refresh();
    } catch (e) { console.error('[sync]', e); }
    finally { setSyncing(false); }
  }, [syncing, accessToken, userId, refresh]);

  // Keyboard shortcuts: s=sync, t=trening, d=dark toggle
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      if (e.key === 's') syncAll();
      if (e.key === 't') setShowWorkout(true);
      if (e.key === 'd') setTheme(th => th === 'light' ? 'dark' : 'light');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [syncAll]);

  // Derived
  const oura14    = oura.slice(-14);
  const latest    = oura[oura.length - 1] ?? null;
  const lastS     = [...sessions].reverse()[0] ?? null;
  const daysSince = lastS ? Math.floor((Date.now() - new Date(lastS.date + 'T12:00:00').getTime()) / 86400000) : null;
  const digest    = computeDigest(sessions, oura, strava);
  const alerts    = computeAlerts(oura, sessions, nutrition);
  const streak    = computeWeekStreak(sessions);
  const currentWeight = body.length ? +(body[body.length - 1]?.weight || 0) || null : null;
  const weight30ago   = currentWeight ? +(body.find(b => b.date <= daysBefore(28))?.weight || 0) || null : null;

  // Sprint
  const sprint      = getSprintInfo();
  const sprintGoal  = sprintGoals.find(g => g.personal_year === sprint.personalYear && g.sprint_number === sprint.sprintNumber) ?? null;
  const currMetrics = sprintMetrics(oura, sessions, strava, sprint.sprintStart, sprint.sprintEnd);
  const prevMetrics = sprint.prevStart ? sprintMetrics(oura, sessions, strava, sprint.prevStart, sprint.prevEnd) : null;

  // Career metrics
  const ws               = weekStartDate();
  const movesDoneThisWeek = (moves||[]).filter(m => m.status === 'done' && (m.completed_at||'').slice(0,10) >= ws).length;
  const careerMetrics    = {
    doneInSprint:   (moves||[]).filter(m => m.status === 'done' && (m.completed_at||'').slice(0,10) >= sprint.sprintStart).length,
    inProgress:     (moves||[]).filter(m => m.status === 'doing').length,
    blocked:        (moves||[]).filter(m => m.status === 'blocked').length,
    activeProjects: (projects||[]).filter(p => p.sense_status !== 'cut' && p.sense_status !== 'completed').length,
  };

  const saveSprintGoal = useCallback(async (text) => {
    await supabase.from('sprint_goals').upsert({
      user_id: userId,
      personal_year: sprint.personalYear,
      sprint_number: sprint.sprintNumber,
      goal_text: text,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,personal_year,sprint_number' });
    refresh();
  }, [userId, sprint.personalYear, sprint.sprintNumber, refresh]);

  const sleepData = oura14.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Sen: r.total_sleep_hours ? +r.total_sleep_hours.toFixed(1) : null, HRV: r.hrv_avg || null }));
  const nutrData  = nutrition.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Kcal: r.calories || 0, Białko: r.protein || 0 }));
  const volData   = weeklyVolume(sessions);
  const now       = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });

  if (showWorkout) return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
      <WorkoutLogger session={session} onBack={() => { setShowWorkout(false); refresh(); }} />
    </Suspense>
  );

  return (
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border-custom bg-background/95 backdrop-blur-md px-8 py-3.5 flex items-center gap-4">
        <div className="flex items-center gap-4">
          <span className="font-display text-[13px] font-black uppercase tracking-[0.3em] text-primary">Vanguard OS</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted hidden lg:block">{now}</span>
        </div>
        <div className="hidden xl:flex items-center gap-3 ml-4">
          {[['S','sync'], ['T','trening'], ['D','dark']].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1 text-[8px] text-text-muted">
              <kbd className="rounded border border-border-custom bg-surface px-1.5 py-0.5 font-mono text-[9px] font-black leading-none">{k}</kbd>
              <span>{l}</span>
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer">
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} className="text-yellow-400" />}
          </button>
          <button onClick={syncAll} disabled={syncing}
            className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 disabled:opacity-40 cursor-pointer">
            <RefreshCw size={14} className={syncing ? 'animate-spin text-primary' : ''} />
          </button>
          <button onClick={() => setShowWorkout(true)}
            className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/[0.14] transition-all active:scale-95 cursor-pointer">
            <Dumbbell size={13} /> Zaloguj trening
          </button>
          <Link to="/"
            className="flex items-center gap-1.5 rounded-full border border-border-custom px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface-solid transition-all cursor-pointer">
            <Smartphone size={12} /> Mobile
          </Link>
        </div>
      </header>

      <main className="px-8 py-7 space-y-5 max-w-[1600px] mx-auto">

        <SmartAlerts alerts={alerts} />
        <CockpitBanner strain={strain} oura={oura14} />
        <SprintPanel
          sprint={sprint}
          sprintGoal={sprintGoal}
          onSave={saveSprintGoal}
          metrics={currMetrics}
          prevMetrics={prevMetrics}
          careerMetrics={careerMetrics}
          goals={goals}
          currentWeight={currentWeight}
          weight30ago={weight30ago}
        />
        <WeeklyDigest digest={digest} movesDoneThisWeek={movesDoneThisWeek} streak={streak} />

        {/* Heatmap */}
        <Panel title="Konsekwencja treningowa — 13 tygodni">
          <Heatmap sessions={sessions} />
        </Panel>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-5">
          <Panel title="Sen & HRV — 14 dni">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={sleepData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={2} />
                <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} domain={[4, 10]} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} domain={[20, 100]} />
                <Tooltip content={<Tip />} />
                <Line yAxisId="l" type="monotone" dataKey="Sen" stroke={C.indigo}  strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="r" type="monotone" dataKey="HRV" stroke={C.emerald} strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.indigo }} /> Sen (h)</span>
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.emerald }} /> HRV (ms)</span>
            </div>
          </Panel>

          <Panel title="Objętość treningowa — 10 tygodni (Mg)">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={volData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: tick }} />
                <YAxis tick={{ fontSize: 9, fill: tick }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="vol" name="Mg" fill={C.amber} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Żywienie — 14 dni">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={nutrData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.rose} stopOpacity={0.25}/><stop offset="95%" stopColor={C.rose} stopOpacity={0}/></linearGradient>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.sky}  stopOpacity={0.25}/><stop offset="95%" stopColor={C.sky}  stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={2} />
                <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} domain={[0, 250]} />
                <Tooltip content={<Tip />} />
                <Area yAxisId="l" type="monotone" dataKey="Kcal"   stroke={C.rose} fill="url(#gK)" strokeWidth={2} dot={false} />
                <Area yAxisId="r" type="monotone" dataKey="Białko" stroke={C.sky}  fill="url(#gP)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.rose }} /> Kcal</span>
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.sky  }} /> Białko (g)</span>
            </div>
          </Panel>
        </div>

        {/* Marathon */}
        <MarathonPanel strava={strava} grid={grid} tick={tick} />

        {/* Lenie + Nawyki side by side */}
        <div className="grid grid-cols-2 gap-4">
          <LeniePanelMini logs={lenieLogs} userId={userId} accessToken={accessToken} />
          <div className="rounded-[20px] border border-border-custom bg-surface/60 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Nawyki</p>
              <button onClick={() => setIsAddingHabit(p => !p)} className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-primary border border-primary/20 bg-primary/5 px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-all cursor-pointer">
                <Plus size={10} /> Dodaj
              </button>
            </div>
            {isAddingHabit && (
              <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-primary">Nowy sygnał</p>
                  <button onClick={() => setIsAddingHabit(false)} className="text-text-muted hover:text-text-primary"><X size={13} /></button>
                </div>
                <div className="grid grid-cols-[44px_1fr] gap-2">
                  <input value={newHabit.icon} onChange={e => setNewHabit(p => ({ ...p, icon: e.target.value }))} className="rounded-lg border border-border-custom bg-surface p-2 text-center text-[13px] font-black text-text-primary outline-none focus:border-primary/50" placeholder="✅" />
                  <input value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addHabit()} className="rounded-lg border border-border-custom bg-surface px-3 py-2 text-[11px] font-bold text-text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/50" placeholder="Nazwa" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setNewHabit(p => ({ ...p, is_positive: true }))} className={`rounded-lg border py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer ${newHabit.is_positive ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400' : 'border-border-custom text-text-muted'}`}>Wzmacniać</button>
                  <button onClick={() => setNewHabit(p => ({ ...p, is_positive: false }))} className={`rounded-lg border py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer ${!newHabit.is_positive ? 'border-rose-500/35 bg-rose-500/10 text-rose-400' : 'border-border-custom text-text-muted'}`}>Unikać</button>
                </div>
                <button onClick={addHabit} className="w-full rounded-lg bg-primary py-2 text-[9px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">Dodaj</button>
              </div>
            )}
            <div className="space-y-2">
              {habits.map(habit => {
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                const doneToday = habitLogs.some(l => l.habit_id === habit.id && l.date === today);
                return (
                  <div key={habit.id} className="rounded-[14px] border border-border-custom bg-surface p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[14px] shrink-0">{habit.icon || '✅'}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-black uppercase text-text-primary">{habit.name}</p>
                          <p className="text-[7px] font-bold uppercase tracking-widest text-text-muted">{habit.is_positive ? 'wzmacniać' : 'unikać'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleHabit(habit.id)} className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors cursor-pointer ${doneToday ? (habit.is_positive ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-rose-500 bg-rose-500 text-white') : 'border-border-custom text-text-muted hover:text-text-primary'}`}>
                          {doneToday ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        <button onClick={() => deleteHabit(habit.id)} className="p-1.5 text-text-muted/40 hover:text-rose-500 rounded-lg cursor-pointer"><Trash2 size={11} /></button>
                      </div>
                    </div>
                    <div className="flex h-2 gap-0.5 overflow-hidden">
                      {Array.from({ length: 30 }).map((_, i) => {
                        const d = subDays(new Date(), 29 - i).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                        const has = habitLogs.some(l => l.habit_id === habit.id && l.date === d);
                        const ok = habit.is_positive ? has : !has;
                        return <div key={d} className={`flex-1 rounded-sm ${d === today && !has ? 'border border-border-custom' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />;
                      })}
                    </div>
                  </div>
                );
              })}
              {habits.length === 0 && <p className="text-[9px] text-text-muted/50 text-center py-3">Brak nawyków — dodaj pierwszy</p>}
            </div>
          </div>
        </div>

        {/* Intelligence — conclusions, not data */}
        <IntelligencePanel
          oura={oura} sessions={sessions} nutrition={nutrition} wins={wins}
          patterns={patterns} wiki={wiki} knowledge={knowledge}
        />

      </main>
    </div>
  );
}
