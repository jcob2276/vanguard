import { Suspense, lazy, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import SmartAlerts, { AlertItem } from './SmartAlerts';
import WeeklyDigest from './WeeklyDigest';
import CockpitBanner from './CockpitBanner';
import Heatmap from './Heatmap';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, startOfWeek, differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Dumbbell, Smartphone, Moon, Sun, Target, Briefcase, Zap, CheckSquare, Square, Trash2, Plus, X, Fingerprint, Check, Star, Sparkles, ImageIcon, ArrowRight, Type } from 'lucide-react';
import { createProject } from '../../lib/projects';
import { subDays } from 'date-fns';

const WorkoutLogger = lazy(() => import('../biometrics/WorkoutLogger'));
const Fundament = lazy(() => import('../core/Fundament'));

// ── Constants ─────────────────────────────────────────────────────────────────
const RACE_DATE = new Date('2026-10-04T09:00:00+02:00');
const C = { indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e', sky: '#38bdf8', violet: '#a78bfa' };
const LIMITER_PL = { sleep: 'sen', calories: 'kalorie', carbs: 'węgle', cardio_load: 'cardio', strength_load: 'siłownia', mental_load: 'głowa', recovery_ok: 'OK' };
const WELLNESS_NAMES = ['sauna', 'lodowata', 'zimny prysznic', 'stretching', 'foam rolling'];
const isLogWellness  = (l: any) => (l.muscle_tags||[]).includes('wellness') || WELLNESS_NAMES.some(w => (l.exercise_name||'').toLowerCase().startsWith(w));

type ChartTooltipPayload = {
  color?: string;
  name?: string | number;
  value?: string | number;
};

type LenieLog = {
  date: string;
  final_stimulus?: string | null;
  context_note?: string | null;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────
const daysBefore = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
const avg = (arr: number[]) => arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : null;

function weekStartDate() {
  const ds = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const d = new Date(ds + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
}

function sessionVol(s: any) {
  return (s.exercise_logs || []).reduce((sum: number, l: any) => {
    if (isLogWellness(l)) return sum;
    return sum + (parseFloat(l.weight) || 0) * (parseInt(l.reps) || 0);
  }, 0);
}

function sessionMuscles(s: any) {
  const seen = new Set();
  (s.exercise_logs || []).forEach((l: any) => (l.muscle_tags || []).forEach((t: any) => { if (t !== 'wellness') seen.add(t); }));
  return [...seen].slice(0, 3).join(', ') || '—';
}

function weeklyVolume(sessions: any[]) {
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

function muscleBreakdown(sessions: any[]) {
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

function weeklyRunKm(strava: any[]) {
  const runs = strava.filter((a: any) => ['Run', 'TrailRun', 'VirtualRun', 'Hike'].includes(a.sport_type));
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

function computeCorrelations(oura: any[], sessions: any[]) {
  if (oura.length < 10) return [];
  const sessionMap = Object.fromEntries(sessions.map((s: any) => [s.date, s]));
  const nextDate = (d: string) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 1); return dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }); };
  const prevDate = (d: string) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() - 1); return dt.toLocaleDateString('en-CA'); };
  const goodSleep   = oura.filter((o: any) => (o.total_sleep_hours || 0) >= 7);
  const shortSleep  = oura.filter((o: any) => o.total_sleep_hours > 0 && o.total_sleep_hours < 6.5);
  const volAfter    = (days: any[]) => days.map((o: any) => sessionVol(sessionMap[nextDate(o.date)] || { exercise_logs: [] })).filter((v: number) => v > 0);
  const avgGoodVol  = avg(volAfter(goodSleep));
  const avgShortVol = avg(volAfter(shortSleep));
  const withHRV     = oura.filter((o: any) => o.hrv_avg && o.readiness_score).sort((a: any, b: any) => a.hrv_avg - b.hrv_avg);
  const t           = Math.floor(withHRV.length / 3);
  const avgReadHigh = avg(withHRV.slice(-t).map((o: any) => o.readiness_score));
  const avgReadLow  = avg(withHRV.slice(0, t).map((o: any) => o.readiness_score));
  const trainedDates = new Set(sessions.map((s: any) => s.date));
  const recovAfterTrain = oura.filter((o: any) => trainedDates.has(prevDate(o.date))).map((o: any) => o.readiness_score).filter(Boolean);
  const recovAfterRest  = oura.filter((o: any) => !trainedDates.has(prevDate(o.date))).map((o: any) => o.readiness_score).filter(Boolean);
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
      good: { label: 'Po treningu', val: `${Math.round(avg(recovAfterTrain) ?? 0)}/100` },
      bad:  { label: 'Po odpoczynku', val: `${Math.round(avg(recovAfterRest) ?? 0)}/100` },
      delta: Math.round((avg(recovAfterTrain) ?? 0) - (avg(recovAfterRest) ?? 0)),
      positive: (avg(recovAfterTrain) ?? 0) >= (avg(recovAfterRest) ?? 0),
    } : null,
  ].filter(Boolean);
}

function cockpitDecision(status: any, limiter: any, strain: any, provisional: any) {
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

function computeDigest(sessions: any[], oura: any[], strava: any[]) {
  const ws = weekStartDate();
  const weekSess    = sessions.filter((s: any) => s.date >= ws);
  const wellnessSess = weekSess.filter((s: any) => (s.exercise_logs||[]).length > 0 && (s.exercise_logs||[]).every((l: any) => isLogWellness(l)));
  const trainSess   = weekSess.filter((s: any) => !wellnessSess.includes(s));
  const weekRuns    = strava.filter((a: any) => ['Run','TrailRun','VirtualRun'].includes(a.sport_type) && a.start_date.slice(0,10) >= ws);
  const weekOura    = oura.filter((o: any) => o.date >= ws);
  return {
    sessions: trainSess.length + weekRuns.length,
    gym: trainSess.length,
    runs: weekRuns.length,
    wellness: wellnessSess.length,
    kmRun: weekRuns.reduce((s: number, a: any) => s + (parseFloat(a.distance)||0), 0) / 1000,
    avgSleep: avg(weekOura.map((o: any) => o.total_sleep_hours).filter(Boolean)),
    avgReadiness: avg(weekOura.map((o: any) => o.readiness_score).filter(Boolean)),
    totalVol: trainSess.reduce((s: number, sess: any) => s + sessionVol(sess), 0),
  };
}

function computeAlerts(oura: any[], sessions: any[], nutrition: any[]) {
  const alerts: AlertItem[] = [];
  const lat = oura[oura.length - 1];
  const avg7HRV = avg(oura.slice(-8, -1).map((o: any) => o.hrv_avg).filter(Boolean));
  if (lat?.hrv_avg && avg7HRV && (avg7HRV - lat.hrv_avg) / avg7HRV > 0.12)
    alerts.push({ type: 'warn', msg: `HRV o ${Math.round(avg7HRV - lat.hrv_avg)}ms poniżej 7-dniowej średniej` });
  const lastS = [...sessions].filter((s: any) => sessionVol(s) > 0).reverse()[0];
  const daysSince = lastS ? Math.floor((Date.now() - new Date(lastS.date + 'T12:00:00').getTime()) / 86400000) : null;
  if (daysSince !== null && daysSince >= 3)
    alerts.push({ type: 'warn', msg: `${daysSince} dni bez treningu siłowego` });
  const lowSleep = oura.slice(-3).filter((o: any) => o.total_sleep_hours > 0 && o.total_sleep_hours < 7).length;
  if (lowSleep >= 2) alerts.push({ type: 'warn', msg: `${lowSleep}/3 ostatnich nocy poniżej 7h snu` });
  const lowKcal = nutrition.slice(-3).filter((n: any) => n.calories > 100 && n.calories < 2200).length;
  if (lowKcal >= 2) alerts.push({ type: 'info', msg: `Niskie kalorie ${lowKcal} dni pod rząd` });
  if (!alerts.length && (lat?.readiness_score ?? 0) >= 70)
    alerts.push({ type: 'ok', msg: 'Sygnały OK — dobry dzień na ciśnięcie' });
  return alerts;
}

const calcSleepDebt = (oura: any[]) =>
  +oura.slice(-7).reduce((acc: number, o: any) => o.total_sleep_hours ? acc + (8 - o.total_sleep_hours) : acc, 0).toFixed(1);

function trendDelta(oura: any[], field: string) {
  const latest = oura[oura.length - 1]?.[field];
  const week   = oura[Math.max(0, oura.length - 8)]?.[field];
  if (!latest || !week) return null;
  const delta = +(latest - week).toFixed(1);
  return delta !== 0 ? { delta: Math.abs(delta), up: delta > 0 } : null;
}

function pushPullBalance(sessions: any[]) {
  const PUSH = new Set(['klatka', 'triceps', 'barki', 'przedni-bark']);
  const PULL = new Set(['plecy', 'biceps', 'tylny-bark', 'grzbiet', 'trapez']);
  let push = 0, pull = 0;
  const cutoff = daysBefore(30);
  for (const s of sessions) {
    if (s.date < cutoff) continue;
    for (const l of (s.exercise_logs || [])) {
      const tags = l.muscle_tags || [];
      const v = (parseFloat(l.weight)||0) * (parseInt(l.reps)||0);
      if (tags.some((t: any) => PUSH.has(t))) push += v;
      if (tags.some((t: any) => PULL.has(t))) pull += v;
    }
  }
  return push + pull > 0 ? { push, pull } : null;
}

// ── Insights helpers ──────────────────────────────────────────────────────────
const DOW_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function computeDayOfWeekReadiness(oura: any[]) {
  const groups: Record<number, number[]> = {};
  for (const o of oura) {
    if (!o.readiness_score) continue;
    const d = new Date(o.date + 'T12:00:00').getDay();
    if (!groups[d]) groups[d] = [];
    groups[d].push(o.readiness_score);
  }
  return [1,2,3,4,5,6,0].map(d => ({
    day: DOW_PL[d],
    avg: groups[d]?.length ? Math.round(avg(groups[d]) ?? 0) : null,
    count: groups[d]?.length || 0,
  }));
}

function computeSleepBuckets(oura: any[]) {
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
    avg: acc[label].length >= 2 ? Math.round(avg(acc[label]) ?? 0) : null,
    count: acc[label].length,
  }));
}

function computeNutritionImpact(oura: any[], nutrition: any[]) {
  const nutrMap = Object.fromEntries((nutrition||[]).map((n: any) => [n.date, n]));
  const nextDay = (d: string) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + 1); return dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }); };
  const high: number[] = [], low: number[] = [];
  for (const o of oura) {
    const n = nutrMap[o.date];
    if (!n?.protein || !oura.find((x: any) => x.date === nextDay(o.date))?.readiness_score) continue;
    const next = oura.find((x: any) => x.date === nextDay(o.date)).readiness_score;
    if (n.protein >= 150) high.push(next); else low.push(next);
  }
  const avgHigh = high.length >= 3 ? Math.round(avg(high) ?? 0) : null;
  const avgLow  = low.length >= 3  ? Math.round(avg(low) ?? 0)  : null;
  return avgHigh && avgLow ? { high: avgHigh, low: avgLow, delta: avgHigh - avgLow } : null;
}

function computeNarrativeInsights(oura: any[], sessions: any[], nutrition: any[], wins: any[]) {
  const out = [];

  // Day-of-week readiness pattern
  const dow = computeDayOfWeekReadiness(oura);
  const bestDow  = dow.filter(d => d.avg !== null && d.count >= 3).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const worstDow = dow.filter(d => d.avg !== null && d.count >= 3).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
  if (bestDow && worstDow && bestDow.day !== worstDow.day) {
    const delta = (bestDow.avg ?? 0) - (worstDow.avg ?? 0);
    if (delta >= 7) out.push({
      type: 'data', urgency: delta >= 14 ? 'high' : 'medium',
      headline: `${bestDow.day} to Twój szczyt — ${bestDow.avg}/100 readiness`,
      evidence: `${worstDow.day} jest o ${delta} pkt niżej (${worstDow.avg}/100). Planuj wymagające sesje i spotkania na ${bestDow.day}–${dow[(dow.findIndex(d => d.day === bestDow.day) + 1) % 7]?.day}.`,
    });
  }

  // Sleep → next day impact
  const buckets = computeSleepBuckets(oura);
  const bestBucket  = buckets.filter(b => b.avg !== null && b.count >= 2).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
  const worstBucket = buckets.filter(b => b.avg !== null && b.count >= 2).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))[0];
  if (bestBucket && worstBucket && bestBucket.label !== worstBucket.label) {
    const delta = (bestBucket.avg ?? 0) - (worstBucket.avg ?? 0);
    if (delta >= 8) out.push({
      type: 'data', urgency: delta >= 16 ? 'high' : 'medium',
      headline: `Sen ${bestBucket.label} → readiness ${bestBucket.avg}. Sen ${worstBucket.label} → ${worstBucket.avg}.`,
      evidence: `${delta} pkt różnicy w readiness zależy od jednej godziny snu. Twój optymalny próg jest wyraźny.`,
    });
  }

  // Sleep debt this week
  const debt = oura.slice(-7).reduce((acc: number, o: any) => o.total_sleep_hours ? acc + Math.max(0, 7.5 - o.total_sleep_hours) : acc, 0);
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
  const thisWeek = sessions.filter((s: any) => s.date >= ws).length;
  const prev3wk = [7, 14, 21].map(off => sessions.filter((s: any) => s.date >= daysBefore(off + 7) && s.date < daysBefore(off)).length);
  const avgPrev = avg(prev3wk.filter(v => v > 0));
  if (thisWeek === 0 && avgPrev !== null && avgPrev >= 2) out.push({
    type: 'data', urgency: 'high',
    headline: `Zerowe treningi w tym tygodniu — Twoja norma to ${(avgPrev ?? 0).toFixed(1)}×/tydzień`,
    evidence: `Ostatnie 3 tygodnie: ${prev3wk.join(', ')} sesji. Ten tydzień: 0. Konsekwencja jest Twoim głównym dźwignią.`,
  });

  // HRV trend
  const hrv7   = avg(oura.slice(-7).map((o: any) => o.hrv_avg).filter(Boolean));
  const hrv14  = avg(oura.slice(-14, -7).map((o: any) => o.hrv_avg).filter(Boolean));
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
  const fmt = (dt: Date) => dt.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  return {
    personalYear, sprintNumber, weekInSprint, dayInSprint,
    daysLeft: SPRINT_DAYS - dayInSprint - 1,
    pct: Math.round((dayInSprint / SPRINT_DAYS) * 100),
    sprintStart: fmt(sprintStart), sprintEnd: fmt(sprintEnd),
    prevStart: prevStart ? fmt(prevStart) : null,
    prevEnd:   prevEnd   ? fmt(prevEnd)   : null,
  };
}

function sprintMetrics(oura: any[], sessions: any[], strava: any[], start: string | null, end: string | null) {
  if (!start || !end) return null;
  const o    = oura.filter((r: any) => r.date >= start && r.date <= end);
  const s    = sessions.filter((r: any) => r.date >= start && r.date <= end);
  const runs = strava.filter((a: any) => {
    const d = a.start_date.slice(0, 10);
    return d >= start && d <= end && ['Run', 'TrailRun', 'VirtualRun'].includes(a.sport_type);
  });
  return {
    avgReadiness: avg(o.map((r: any) => r.readiness_score).filter(Boolean)),
    avgSleep:     avg(o.map((r: any) => r.total_sleep_hours).filter(Boolean)),
    avgHRV:       avg(o.map((r: any) => r.hrv_avg).filter(Boolean)),
    totalVol:     s.reduce((sum: number, sess: any) => sum + sessionVol(sess), 0),
    trainDays:    s.filter((sess: any) => sessionVol(sess) > 0).length,
    kmRun:        runs.reduce((sum: number, a: any) => sum + (parseFloat(a.distance) || 0), 0) / 1000,
  };
}

// ── Streak helper ────────────────────────────────────────────────────────────
function computeWeekStreak(sessions: any[]) {
  const ws = weekStartDate();
  let streak = 0;
  const cursor = new Date(ws + 'T12:00:00');
  for (let i = 0; i < 52; i++) {
    const wStart = cursor.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const wEnd   = new Date(cursor.getTime() + 6 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const hasTrain = sessions.some((s: any) => s.date >= wStart && s.date <= wEnd && sessionVol(s) > 0);
    if (!hasTrain) break;
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

// ── Data hook ─────────────────────────────────────────────────────────────────
function useDesktopData(userId: string | undefined) {
  const [s, setS] = useState<{
    loading: boolean;
    oura: any[];
    nutrition: any[];
    sessions: any[];
    body: any[];
    strain: any | null;
    strava: any[];
    projects: any[];
    moves: any[];
    goals: any | null;
    sprintGoals: any[];
    stream: any[];
    patterns: any[];
    wins: any[];
    wiki: any[];
    knowledge: any[];
    lenieLogs: any[];
    habits: any[];
    habitLogs: any[];
  }>({
    loading: true,
    oura: [],
    nutrition: [],
    sessions: [],
    body: [],
    strain: null,
    strava: [],
    projects: [],
    moves: [],
    goals: null,
    sprintGoals: [],
    stream: [],
    patterns: [],
    wins: [],
    wiki: [],
    knowledge: [],
    lenieLogs: [],
    habits: [],
    habitLogs: [],
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setS(p => ({ ...p, loading: true }));
    const { data, error } = await supabase.rpc('get_desktop_dashboard_data', { p_user_id: userId });
    if (error) {
      console.error('Error loading dashboard data:', error);
      setS(p => ({ ...p, loading: false }));
      return;
    }
    const d = data as any;
    setS({
      loading: false,
      oura: d?.oura || [],
      nutrition: d?.nutrition || [],
      sessions: d?.sessions || [],
      body: d?.body || [],
      strain: d?.strain || null,
      strava: d?.strava || [],
      projects: d?.projects || [],
      moves: d?.moves || [],
      goals: d?.goals || null,
      sprintGoals: d?.sprintGoals || [],
      stream: d?.stream || [],
      patterns: d?.patterns || [],
      wins: d?.wins || [],
      wiki: d?.wiki || [],
      knowledge: d?.knowledge || [],
      lenieLogs: d?.lenieLogs || [],
      habits: d?.habits || [],
      habitLogs: d?.habitLogs || [],
    });
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

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <div className={`rounded-[20px] border border-border-custom bg-surface p-5 shadow-sm ${className}`}>
      {title && <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted mb-4 pb-2.5 border-b border-border-custom">{title}</p>}
      {children}
    </div>
  );
}

interface KPIProps {
  label: string;
  value?: any;
  unit?: string;
  color?: string;
  barMax?: number;
  note?: string | null;
  trend?: { up: boolean; delta: number } | null;
}

function KPI({ label, value, unit, color = 'text-text-primary', barMax, note, trend }: KPIProps) {
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

// ── 3. Marathon ───────────────────────────────────────────────────────────────
interface MarathonPanelProps {
  strava: any[];
  grid: string;
  tick: string;
}

function MarathonPanel({ strava, grid, tick }: MarathonPanelProps) {
  const daysLeft  = differenceInDays(RACE_DATE, new Date());
  const weeksLeft = Math.ceil(daysLeft / 7);
  const kmData    = weeklyRunKm(strava);
  const recent4   = kmData.slice(-4);
  const avgKm     = recent4.length ? Math.round((avg(recent4.map(w => w.km)) ?? 0) * 10) / 10 : null;
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

// ── 4. Projects & Goals ──────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; badge: string; label: string }> = {
  doing:   { dot: 'bg-sky-500',     badge: 'bg-sky-500/10 text-sky-500 border-sky-500/20',           label: 'W toku' },
  done:    { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', label: 'Done' },
  blocked: { dot: 'bg-rose-500',    badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',         label: 'Blokada' },
  todo:    { dot: 'bg-text-muted',  badge: 'bg-surface border-border-custom text-text-muted',          label: 'Plan' },
};

const SENSE_CFG: Record<string, { label: string; cls: string }> = {
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

interface ProjectsSectionProps {
  goals: any;
  projects: any[];
  moves: any[];
}

function ProjectsSection({ goals, projects, moves }: ProjectsSectionProps) {
  const projMap    = Object.fromEntries((projects||[]).map((p: any) => [p.id, p]));
  const activeProj = (projects||[]).filter((p: any) => p.sense_status !== 'cut' && p.sense_status !== 'completed');
  const ws         = weekStartDate();
  const doneWeek   = (moves||[]).filter((m: any) => m.status === 'done' && (m.completed_at||'').slice(0,10) >= ws);
  const inProgress = (moves||[]).filter((m: any) => m.status === 'doing');
  const blocked    = (moves||[]).filter((m: any) => m.status === 'blocked');

  const feedMoves  = [
    ...inProgress,
    ...blocked,
    ...(moves||[]).filter((m: any) => m.status === 'done').slice(0, 8),
  ].slice(0, 14);

  return (
    <Panel title="Projekty & Cele">
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
                {activeProj.slice(0, 6).map((p: any) => {
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
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted mb-2.5">Zadania projektowe</p>
              <div className="divide-y divide-border-custom/40">
                {feedMoves.map((m: any) => {
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
            <p className="text-[11px] text-text-muted py-6 text-center">Brak projektów — dodaj je w sekcji Projekty</p>
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
const INTEL_CFG: Record<string, {
  label: string;
  urgencyMap: Record<string, string>;
  dot: Record<string, string>;
  badge: string;
}> = {
  data:     { label: 'DANE',    urgencyMap: { high: 'border-rose-500/30 bg-rose-500/[0.04]', medium: 'border-amber-500/30 bg-amber-500/[0.04]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' }, badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  pattern:  { label: 'WZORZEC', urgencyMap: { high: 'border-rose-500/30 bg-rose-500/[0.04]', medium: 'border-amber-500/30 bg-amber-500/[0.04]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' }, badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  wiki:     { label: 'WIEDZA',  urgencyMap: { high: 'border-emerald-500/30 bg-emerald-500/[0.04]', medium: 'border-emerald-500/20 bg-emerald-500/[0.03]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-emerald-500', medium: 'bg-emerald-400', low: 'bg-emerald-400/50' }, badge: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  knowledge:{ label: 'ZASADA',  urgencyMap: { high: 'border-amber-500/30 bg-amber-500/[0.04]', medium: 'border-amber-500/20 bg-amber-500/[0.03]', low: 'border-border-custom bg-surface-solid' }, dot: { high: 'bg-amber-500', medium: 'bg-amber-400', low: 'bg-amber-300' }, badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

const LOW_VALUE_INTEL_TYPES = new Set(['person', 'source_summary', 'operating_model', 'lesson', 'osoba']);
const LOW_VALUE_INTEL_TITLES = new Set(['jakub', 'poprawka użytkownika', 'aktualny snapshot operacyjny', 'aktualne tematy ze streamu']);
const LOW_VALUE_INTEL_TEXT = [
  'osoba analizowana',
  'poprawka:',
  'desktop footprint',
  'aktualny model operacyjny składa się',
  'najmocniejszy sygnał:',
  'content:',
  'category:',
];

function cleanIntelText(value: string | null | undefined, max = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function isUsefulIntelCard(card: any) {
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

function intelScore(card: any) {
  const urgencyScore = card.urgency === 'high' ? 30 : card.urgency === 'medium' ? 15 : 0;
  const typeScore = card.type === 'data' ? 80 : card.type === 'pattern' ? 55 : card.type === 'knowledge' ? 25 : 15;
  const countScore = Math.min((card.count || 0) * 4, 20);
  const importanceScore = Math.min(card.importance || 0, 10);
  return typeScore + urgencyScore + countScore + importanceScore;
}

interface IntelligencePanelProps {
  oura: any[];
  sessions: any[];
  nutrition: any[];
  wins: any[];
  patterns: any[];
  wiki: any[];
  knowledge: any[];
}

function IntelligencePanel({ oura, sessions, nutrition, wins, patterns, wiki, knowledge }: IntelligencePanelProps) {
  const dataInsights = computeNarrativeInsights(oura, sessions, nutrition, wins);

  const cards: any[] = [
    ...dataInsights.map(i => ({ ...i, type: 'data' })),
    ...(patterns||[]).map((p: any) => ({
      type: 'pattern',
      urgency: (p.confidence||0) >= 0.7 ? 'high' : 'medium',
      headline: p.title,
      evidence: p.evidence_text,
      meta: `${p.occurrence_count}× · ${p.last_seen || ''}`,
    })),
    ...(wiki||[]).filter((w: any) => w.summary).map((w: any) => ({
      type: 'wiki',
      urgency: 'medium',
      headline: w.title,
      evidence: w.summary,
      meta: w.page_type,
    })),
    ...(knowledge||[]).map((k: any) => ({
      type: 'knowledge',
      urgency: (k.importance_score||0) >= 9 ? 'high' : 'medium',
      headline: k.title,
      evidence: k.content,
      meta: k.category,
    })),
  ];

  const visibleCards = cards
    .map(card => ({
      ...card,
      headline: cleanIntelText(card.headline, 120),
      evidence: cleanIntelText(card.evidence),
      count: card.count ?? Number(String(card.meta || '').match(/\d+/)?.[0] || 0),
      importance: card.importance ?? card.importance_score ?? 0,
    }))
    .filter(isUsefulIntelCard)
    .sort((a, b) => intelScore(b) - intelScore(a))
    .slice(0, 6);

  if (!visibleCards.length) return (
    <Panel title="Intelligence — za mało danych">
      <p className="text-[11px] text-text-muted text-center py-8">Wnioski pojawią się po kilku tygodniach danych.</p>
    </Panel>
  );

  return (
    <Panel title="Intelligence — co powinieneś wiedzieć">
      <div className="grid grid-cols-3 gap-3">
        {visibleCards.map((card, i) => {
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
function computeLenieInsight(logs: any[]) {
  if (!logs?.length) return null;
  const DOW_PL   = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const DOW_FULL = ['niedziela', 'poniedzialek', 'wtorek', 'sroda', 'czwartek', 'piatek', 'sobota'];
  const recent   = logs.slice(0, 10);
  const total30  = logs.filter((l: any) => l.date >= daysBefore(30)).length;
  const total60  = logs.filter((l: any) => l.date >= daysBefore(60) && l.date < daysBefore(30)).length;

  // Day-of-week peak
  const dowCount: Record<number, number> = {};
  for (const l of recent) {
    const d = new Date(l.date + 'T12:00:00').getDay();
    dowCount[d] = (dowCount[d] || 0) + 1;
  }
  const sorted   = Object.entries(dowCount).sort((a, b) => b[1] - a[1]);
  const peakDay  = sorted[0] ? DOW_PL[+sorted[0][0]] : null;
  const peakN    = sorted[0] ? sorted[0][1] : 0;

  // Top trigger keywords — context_note (weighted x2) + final_stimulus combined
  // Filter: appears in 2+ distinct entries, but not in >60% of entries with text
  const STOP = new Set('i w z na do sie to ze a nie jest bylo mi jak po przez od o ich je co byl ta te ten ta to mnie bo ale go mu tak juz czy wiec az no wtedy kiedy wlaczyl wlaczalem mialem bylo'.split(' '));
  const wc: Record<string, number> = {};
  const entryCount: Record<string, number> = {};
  const entriesWithText = recent.filter((l: any) => l.final_stimulus || l.context_note).length;

  for (const l of recent) {
    const text = [(l.context_note || ''), (l.context_note || ''), (l.final_stimulus || '')].join(' ');
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

  const insight = computeLenieInsight(logs || []);

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
interface SprintPanelProps {
  sprint: any;
  sprintGoal: any;
  onSave: (goalText: string) => Promise<void>;
  metrics: any;
  prevMetrics: any;
  projectMetrics: any;
  goals: any;
  currentWeight: number | null;
  weight30ago: number | null;
}

interface BodyMetric {
  label: string;
  curr: any;
  prev: any;
  fmt: (v: any) => string;
  dec?: number;
}

function SprintPanel({ sprint, sprintGoal, onSave, metrics, prevMetrics, projectMetrics, goals, currentWeight, weight30ago }: SprintPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(sprintGoal?.goal_text || '');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const delta = (curr: any, prev: any, decimals = 0) => {
    if (curr == null || prev == null) return null;
    const d = +(curr - prev).toFixed(decimals);
    return d !== 0 ? { abs: Math.abs(d), up: d > 0 } : null;
  };

  const BODY: BodyMetric[] = [
    { label: 'Readiness', curr: metrics?.avgReadiness, prev: prevMetrics?.avgReadiness, fmt: (v: number) => `${Math.round(v)}` },
    { label: 'Sen avg',   curr: metrics?.avgSleep,     prev: prevMetrics?.avgSleep,     fmt: (v: number) => `${v.toFixed(1)}h`, dec: 1 },
    { label: 'Treningi',  curr: metrics?.trainDays,    prev: prevMetrics?.trainDays,    fmt: (v: number) => `${v}×` },
    { label: 'Km biegu',  curr: metrics?.kmRun,        prev: prevMetrics?.kmRun,        fmt: (v: number) => `${v.toFixed(0)}`, dec: 1 },
    { label: 'Objętość',  curr: metrics?.totalVol ? +(metrics.totalVol/1000).toFixed(1) : null, prev: prevMetrics?.totalVol ? +(prevMetrics.totalVol/1000).toFixed(1) : null, fmt: (v: number) => `${v}Mg`, dec: 1 },
    ...(currentWeight != null ? [{ label: 'Waga', curr: currentWeight, prev: weight30ago, fmt: (v: number) => `${v.toFixed(1)}`, dec: 1 }] : []),
  ];

  const PROJECTS = [
    { label: 'Done w sprincie', val: projectMetrics?.doneInSprint, color: 'text-emerald-500' },
    { label: 'W toku',          val: projectMetrics?.inProgress,   color: 'text-sky-400' },
    { label: 'Zablokowane',     val: projectMetrics?.blocked,      color: projectMetrics?.blocked > 0 ? 'text-rose-500' : 'text-text-primary' },
    { label: 'Projekty',        val: projectMetrics?.activeProjects,color: 'text-amber-400' },
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

        {/* Projekty */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-500 mb-3">Projekty</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {PROJECTS.map(({ label, val, color }) => (
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
export default function DesktopDashboard({ session }: { session: any }) {
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

  async function deleteHabit(id: string) {
    if (!confirm('Usunąć nawyk?')) return;
    await supabase.from('habits').delete().eq('id', id);
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  async function toggleHabit(habitId: string) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const existing = habitLogs.find((l: any) => l.habit_id === habitId && l.date === today);
    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
      if (!error) setHabitLogs((prev: any) => prev.filter((l: any) => l.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habitId, date: today, completed: true }).select().single();
      if (!error) setHabitLogs((prev: any) => [...prev, data]);
    }
  }
  // ── Dreams (Lista 200 Marzeń) ─────────────────────────────────────────────
  const [dreams, setDreams] = useState<any[]>([]);
  const [newDreamTitle, setNewDreamTitle] = useState('');
  const [newDreamCategory, setNewDreamCategory] = useState('inne');
  const [dreamFilter, setDreamFilter] = useState('all');
  const [isAddingDream, setIsAddingDream] = useState(false);
  const [editingDream, setEditingDream] = useState<any | null>(null);
  const [editDreamTitle, setEditDreamTitle] = useState('');
  const [editDreamDesc, setEditDreamDesc] = useState('');
  const [editDreamCat, setEditDreamCat] = useState('inne');
  const [editDreamLifeGoal, setEditDreamLifeGoal] = useState<string | null>(null);
  const [newDreamLifeGoal, setNewDreamLifeGoal] = useState<string | null>(null);
  const [savingDream, setSavingDream] = useState(false);

  const [visionItems, setVisionItems] = useState<any[]>([]);
  const [newVisionContent, setNewVisionContent] = useState('');
  const [newVisionType, setNewVisionType] = useState('affirmation');
  const [newVisionColor, setNewVisionColor] = useState('indigo');
  const [isAddingVision, setIsAddingVision] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('dreams').select('*').eq('user_id', userId)
      .order('is_done', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setDreams(data); });
    supabase.from('vision_board_items').select('*').eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setVisionItems(data); });
  }, [userId]);

  async function addDream() {
    if (!newDreamTitle.trim()) return;
    const { data, error } = await supabase.from('dreams')
      .insert({ user_id: userId, title: newDreamTitle.trim(), category: newDreamCategory, life_goal: newDreamLifeGoal || null } as any)
      .select().single();
    if (!error && data) { setDreams(prev => [data, ...prev]); setNewDreamTitle(''); setNewDreamLifeGoal(null); setIsAddingDream(false); }
  }

  async function toggleDream(dream: any) {
    const is_done = !dream.is_done;
    const { data, error } = await supabase.from('dreams')
      .update({ is_done, done_at: is_done ? new Date().toISOString() : null })
      .eq('id', dream.id).select().single();
    if (!error && data) setDreams(prev => prev.map(d => d.id === dream.id ? data : d));
  }

  async function deleteDream(id: string) {
    await supabase.from('dreams').delete().eq('id', id);
    setDreams(prev => prev.filter(d => d.id !== id));
    if (editingDream?.id === id) setEditingDream(null);
  }

  async function toggleTop5(dream: any) {
    const is_top5 = !dream.is_top5;
    const { data, error } = await supabase.from('dreams').update({ is_top5 }).eq('id', dream.id).select().single();
    if (!error && data) setDreams(prev => prev.map(d => d.id === dream.id ? data : d));
  }

  function openDreamModal(dream: any) {
    setEditingDream(dream);
    setEditDreamTitle(dream.title);
    setEditDreamDesc(dream.description || '');
    setEditDreamCat(dream.category);
    setEditDreamLifeGoal(dream.life_goal || null);
  }

  async function saveDreamEdit() {
    if (!editingDream) return;
    setSavingDream(true);
    const { data, error } = await supabase.from('dreams')
      .update({ title: editDreamTitle.trim(), description: editDreamDesc.trim() || null, category: editDreamCat, life_goal: editDreamLifeGoal || null } as any)
      .eq('id', editingDream.id).select().single();
    if (!error && data) {
      setDreams(prev => prev.map(d => d.id === editingDream.id ? data : d));
      setEditingDream(null);
    }
    setSavingDream(false);
  }

  async function dreamToProject(dream: any) {
    try {
      const project = (await createProject(userId!, { name: dream.title, goal: dream.description || undefined })) as any;
      if (project) {
        await supabase.from('projects').update({ dream_id: dream.id }).eq('id', project.id);
        alert(`Projekt "${dream.title}" utworzony!`);
      }
    } catch (e: any) {
      alert('Błąd: ' + e.message);
    }
  }

  async function addVisionItem() {
    if (!newVisionContent.trim()) return;
    const { data, error } = await supabase.from('vision_board_items')
      .insert({ user_id: userId, type: newVisionType, content: newVisionContent.trim(), color: newVisionColor })
      .select().single();
    if (!error && data) { setVisionItems(prev => [data, ...prev]); setNewVisionContent(''); setIsAddingVision(false); }
  }

  async function deleteVisionItem(id: string) {
    await supabase.from('vision_board_items').delete().eq('id', id);
    setVisionItems(prev => prev.filter(v => v.id !== id));
  }

  const DREAM_CATEGORIES = ['all', 'finanse', 'ciało', 'relacje', 'doświadczenia', 'wolność', 'inne'];
  const DREAM_CAT_LABEL: Record<string, string> = { all: 'Wszystkie', finanse: 'Finanse', ciało: 'Ciało', relacje: 'Relacje', doświadczenia: 'Doświadczenia', wolność: 'Wolność', inne: 'Inne' };
  const DREAM_CAT_COLOR: Record<string, string> = { finanse: 'text-emerald-500', ciało: 'text-rose-500', relacje: 'text-violet-500', doświadczenia: 'text-amber-500', wolność: 'text-sky-500', inne: 'text-text-muted' };

  const VB_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-300',  border: 'border-indigo-500/25' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/25' },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/25' },
    rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-300',    border: 'border-rose-500/25' },
    violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-500/25' },
    sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-300',     border: 'border-sky-500/25' },
  };

  const filteredDreams = dreamFilter === 'all' ? dreams : dreams.filter(d => d.category === dreamFilter);
  const doneDreams = dreams.filter(d => d.is_done).length;
  const top5Dreams = dreams.filter(d => d.is_top5 && !d.is_done).slice(0, 5);
  const projectByDreamId = useMemo(() =>
    Object.fromEntries((projects || []).filter((p: any) => p.dream_id).map((p: any) => [p.dream_id, p])),
    [projects],
  );

  const [syncing,     setSyncing]     = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [showFundament, setShowFundament] = useState(false);
  const [theme,       setTheme]       = useState(() => localStorage.getItem('vanguard_theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('vanguard_theme', theme);
  }, [theme]);

  // Hexagon state
  const [hexagonScores, setHexagonScores] = useState({
    zdrowie: 5,
    finanse: 5,
    kariera: 5,
    relacje: 5,
    rozwoj: 5,
    duchowosc: 5,
  });
  const [savingHexagon, setSavingHexagon] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchHexagon = async () => {
      try {
        const { data } = await supabase
          .from('vanguard_preferences')
          .select('key, value')
          .eq('user_id', userId)
          .eq('key', 'morning_hexagon_scores')
          .maybeSingle();
        if (data) {
          try {
            setHexagonScores(JSON.parse(data.value));
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load hexagon scores:', err);
      }
    };
    fetchHexagon();
  }, [userId]);

  const saveHexagonScores = async () => {
    if (!userId) return;
    setSavingHexagon(true);
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      const valStr = JSON.stringify(hexagonScores);
      
      // Save to preferences
      await supabase
        .from('vanguard_preferences')
        .upsert({ user_id: userId, key: 'morning_hexagon_scores', value: valStr, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });

      // Log change to stream
      const streamText = `[Heksagon] Zaktualizowano ocenę sfer życia: Zdrowie & Ciało: ${hexagonScores.zdrowie}/10, Finanse: ${hexagonScores.finanse}/10, Kariera & Praca: ${hexagonScores.kariera}/10, Relacje: ${hexagonScores.relacje}/10, Rozwój: ${hexagonScores.rozwoj}/10, Duchowość & Czas dla siebie: ${hexagonScores.duchowosc}/10.`;
      
      await supabase.from('vanguard_stream').insert({
        user_id: userId,
        content: streamText,
        source: 'hexagon',
        category: 'productivity',
        classification: 'hexagon_update'
      });

      alert('Zapisano oceny sfer życia w bazie! 🎯');
      refresh();
    } catch (err) {
      console.error('Failed to save hexagon scores:', err);
      alert('Błąd zapisu ocen.');
    } finally {
      setSavingHexagon(false);
    }
  };

  const grid = theme === 'dark' ? '#2d3748' : '#e5e7eb';
  const tick = theme === 'dark' ? '#9ca3af' : '#6b7280';

  const syncAll = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    const base = import.meta.env.VITE_SUPABASE_URL;
    const call = async (fn: string, b: Record<string, any> = {}) => {
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

  function startGoogleAuth() {
    const root = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: window.location.origin,
      client_id: '111163364613-nqd67ulputbk8ehbusls071g0ae4k2om.apps.googleusercontent.com',
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly'
      ].join(' ')
    };
    window.location.href = `${root}?${new URLSearchParams(options).toString()}`;
  }

  // Keyboard shortcuts: s=sync, t=trening, d=dark toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
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

  // Project metrics
  const ws               = weekStartDate();
  const movesDoneThisWeek = (moves||[]).filter(m => m.status === 'done' && (m.completed_at||'').slice(0,10) >= ws).length;
  const projectMetrics   = {
    doneInSprint:   (moves||[]).filter(m => m.status === 'done' && (m.completed_at||'').slice(0,10) >= sprint.sprintStart).length,
    inProgress:     (moves||[]).filter(m => m.status === 'doing').length,
    blocked:        (moves||[]).filter(m => m.status === 'blocked').length,
    activeProjects: (projects||[]).filter(p => p.sense_status !== 'cut' && p.sense_status !== 'completed').length,
  };

  const saveSprintGoal = useCallback(async (text: string) => {
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

  if (showFundament) return (
    <div className="min-h-screen bg-background text-text-primary p-8 max-w-4xl mx-auto">
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
        <Fundament session={session} onBack={() => { setShowFundament(false); refresh(); }} onSyncCalendar={startGoogleAuth} isSyncing={syncing} />
      </Suspense>
    </div>
  );

  if (showWorkout) return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
      <WorkoutLogger session={session} onBack={() => { setShowWorkout(false); refresh(); }} />
    </Suspense>
  );

  return (
    <>
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
          <button onClick={() => setShowFundament(true)}
            className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer"
            title="Fundament">
            <Fingerprint size={14} />
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
          projectMetrics={projectMetrics}
          goals={goals}
          currentWeight={currentWeight}
          weight30ago={weight30ago}
        />
        <WeeklyDigest digest={digest} movesDoneThisWeek={movesDoneThisWeek} streak={streak} />

        {/* Heatmap */}
        <Panel title="Konsekwencja treningowa — 13 tygodni">
          <Heatmap sessions={sessions} strava={strava} />
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

        {/* Heksagon Życia */}
        <Panel title="Heksagon Życia — Koło sfer życia (Morita)">
          <div className="grid grid-cols-[1fr_380px] gap-8 items-center p-2">
            {/* Left: SVG Hexagon Radar Chart */}
            <div className="flex justify-center items-center">
              <svg width={300} height={300} className="overflow-visible">
                {/* Conic Grid lines */}
                {[2, 4, 6, 8, 10].map(k => {
                  const points = [0, 1, 2, 3, 4, 5].map(index => {
                    const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                    const radius = 110;
                    const cx = 150;
                    const cy = 150;
                    const val = k / 10;
                    return `${cx + radius * val * Math.cos(angle)},${cy + radius * val * Math.sin(angle)}`;
                  }).join(' ');
                  return (
                    <polygon
                      key={k}
                      points={points}
                      fill="none"
                      stroke={grid}
                      strokeWidth="1"
                      strokeDasharray={k === 10 ? "none" : "2,3"}
                    />
                  );
                })}

                {/* Axis lines */}
                {[0, 1, 2, 3, 4, 5].map(index => {
                  const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                  const radius = 110;
                  const cx = 150;
                  const cy = 150;
                  const x = cx + radius * Math.cos(angle);
                  const y = cy + radius * Math.sin(angle);
                  return (
                    <line
                      key={index}
                      x1={cx}
                      y1={cy}
                      x2={x}
                      y2={y}
                      stroke={grid}
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Value Polygon */}
                <polygon
                  points={[0, 1, 2, 3, 4, 5].map(index => {
                    const keys = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'];
                    const score = hexagonScores[keys[index] as keyof typeof hexagonScores] || 5;
                    const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                    const radius = 110;
                    const cx = 150;
                    const cy = 150;
                    const val = score / 10;
                    return `${cx + radius * val * Math.cos(angle)},${cy + radius * val * Math.sin(angle)}`;
                  }).join(' ')}
                  fill="rgba(79, 70, 229, 0.2)"
                  stroke="rgba(79, 70, 229, 0.85)"
                  strokeWidth="2"
                />

                {/* Value dots */}
                {[0, 1, 2, 3, 4, 5].map(index => {
                  const keys = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'];
                  const score = hexagonScores[keys[index] as keyof typeof hexagonScores] || 5;
                  const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                  const radius = 110;
                  const cx = 150;
                  const cy = 150;
                  const val = score / 10;
                  const x = cx + radius * val * Math.cos(angle);
                  const y = cy + radius * val * Math.sin(angle);
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="rgb(79, 70, 229)"
                      stroke={theme === 'dark' ? '#000' : '#fff'}
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Labels */}
                {[
                  { label: 'Zdrowie & Ciało', xOffset: 0, yOffset: -15, align: 'middle' },
                  { label: 'Finanse & Konto', xOffset: 12, yOffset: 5, align: 'start' },
                  { label: 'Kariera & Praca', xOffset: 12, yOffset: 5, align: 'start' },
                  { label: 'Relacje', xOffset: 0, yOffset: 15, align: 'middle' },
                  { label: 'Rozwój Osobisty', xOffset: -12, yOffset: 5, align: 'end' },
                  { label: 'Duchowość & Ja', xOffset: -12, yOffset: 5, align: 'end' },
                ].map((lbl, index) => {
                  const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                  const radius = 110;
                  const cx = 150;
                  const cy = 150;
                  const x = cx + (radius + 10) * Math.cos(angle) + lbl.xOffset;
                  const y = cy + (radius + 10) * Math.sin(angle) + lbl.yOffset;
                  return (
                    <text
                      key={index}
                      x={x}
                      y={y}
                      textAnchor={lbl.align as 'start' | 'middle' | 'end'}
                      className="text-[9px] font-black uppercase tracking-wider fill-text-primary"
                    >
                      {lbl.label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Right: Sliders */}
            <div className="space-y-3.5">
              {[
                { key: 'zdrowie', label: 'Zdrowie & Ciało', desc: 'Stan organizmu, energia, nawyki zdrowotne', color: 'accent-emerald-500' },
                { key: 'finanse', label: 'Finanse & Konto', desc: 'Zarabianie, oszczędności, inwestycje', color: 'accent-amber-500' },
                { key: 'kariera', label: 'Kariera & Praca', desc: 'Cele zawodowe, skuteczność, głęboka praca', color: 'accent-indigo-500' },
                { key: 'relacje', label: 'Relacje', desc: 'Jakość kontaktu z bliskimi, brak samotności', color: 'accent-pink-500' },
                { key: 'rozwoj', label: 'Rozwój Osobisty', desc: 'Nowe umiejętności, 1% lepszy każdego dnia', color: 'accent-sky-500' },
                { key: 'duchowosc', label: 'Duchowość & Czas dla siebie', desc: 'Spokój wewnętrzny, medytacja, obecność', color: 'accent-violet-500' },
              ].map(item => (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text-primary">{item.label}</span>
                    <span className="font-black text-primary font-display">{hexagonScores[item.key as keyof typeof hexagonScores] || 5}/10</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={hexagonScores[item.key as keyof typeof hexagonScores] || 5}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        setHexagonScores(prev => ({ ...prev, [item.key]: val }));
                      }}
                      className={`w-full h-1 bg-border-custom rounded-lg appearance-none cursor-pointer ${item.color}`}
                    />
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <button
                  onClick={saveHexagonScores}
                  disabled={savingHexagon}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-hover active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingHexagon ? 'Zapisywanie...' : 'Zapisz oceny sfer życia 🎯'}
                </button>
              </div>
            </div>
          </div>
        </Panel>

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

        {/* Lista 200 Marzeń */}
        <Panel title="">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Lista Marzeń</p>
                <p className="mt-0.5 font-display text-[15px] font-black tracking-tight text-text-primary leading-none">
                  200 Marzeń
                  <span className="ml-2 text-[11px] font-bold text-text-muted">
                    {doneDreams > 0 ? `${doneDreams} zrealizowanych` : `${dreams.length} zapisanych`}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsAddingDream(p => !p)}
                className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
              >
                <Plus size={11} /> Dodaj marzenie
              </button>
            </div>

            {/* Add form */}
            {isAddingDream && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3.5 space-y-2.5">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newDreamTitle}
                    onChange={e => setNewDreamTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDream()}
                    placeholder="Wpisz marzenie..."
                    className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
                  />
                  <select
                    value={newDreamCategory}
                    onChange={e => setNewDreamCategory(e.target.value)}
                    className="rounded-xl border border-border-custom bg-surface px-3 py-2 text-[11px] font-bold text-text-secondary outline-none focus:border-primary cursor-pointer"
                  >
                    {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                      <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
                    ))}
                  </select>
                  <button onClick={addDream} className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">
                    Dodaj
                  </button>
                  <button onClick={() => setIsAddingDream(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Cel:</span>
                  {([['cialo', 'Ciało', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'], ['duch', 'Duch', 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500'], ['konto', 'Konto', 'border-amber-500/40 bg-amber-500/10 text-amber-600']] as [string, string, string][]).map(([val, label, active]) => (
                    <button key={val} onClick={() => setNewDreamLifeGoal(newDreamLifeGoal === val ? null : val)}
                      className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${newDreamLifeGoal === val ? active : 'border-border-custom text-text-muted hover:text-text-secondary'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top 5 Marzeń */}
            {top5Dreams.length > 0 && (
              <div className="space-y-2">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-500 flex items-center gap-1.5">
                  <Star size={9} fill="currentColor" /> Top 5 Marzeń
                </p>
                <div className="space-y-1.5">
                  {top5Dreams.map(dream => (
                    <div key={dream.id} className="flex items-center gap-2.5 rounded-[14px] border border-amber-500/20 bg-amber-500/[0.04] px-3.5 py-2.5">
                      <Star size={10} className="shrink-0 text-amber-500" fill="currentColor" />
                      <button onClick={() => openDreamModal(dream)} className="flex-1 text-left text-[11px] font-bold text-text-primary hover:text-primary truncate cursor-pointer">
                        {dream.title}
                      </button>
                      {dream.description && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary/40" title="Ma wizję" />}
                      <span className={`text-[7px] font-black uppercase tracking-widest shrink-0 ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>{dream.category}</span>
                      {projectByDreamId[dream.id] ? (
                        <span className="shrink-0 flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary/70">
                          <ArrowRight size={9} /> {projectByDreamId[dream.id].name}
                        </span>
                      ) : (
                        <button
                          onClick={() => dreamToProject(dream)}
                          className="shrink-0 flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
                        >
                          <ArrowRight size={9} /> Projekt
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border-custom" />
              </div>
            )}

            {/* Category filter */}
            <div className="flex gap-1.5 flex-wrap">
              {DREAM_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setDreamFilter(cat)}
                  className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    dreamFilter === cat
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border-custom text-text-muted hover:border-text-secondary hover:text-text-secondary'
                  }`}
                >
                  {DREAM_CAT_LABEL[cat]}
                  {cat !== 'all' && dreams.filter(d => d.category === cat).length > 0 && (
                    <span className="ml-1 opacity-60">{dreams.filter(d => d.category === cat).length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Dreams list */}
            {filteredDreams.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-text-muted/50">
                {dreams.length === 0 ? 'Zacznij od zapisania pierwszego marzenia' : 'Brak marzeń w tej kategorii'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredDreams.map(dream => (
                  <div
                    key={dream.id}
                    onClick={() => openDreamModal(dream)}
                    className={`group flex items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5 transition-all cursor-pointer ${
                      dream.is_done
                        ? 'border-emerald-500/15 bg-emerald-500/[0.04] opacity-60'
                        : dream.is_top5
                        ? 'border-amber-500/15 bg-amber-500/[0.02] hover:border-amber-500/30'
                        : 'border-border-custom bg-surface hover:border-primary/20'
                    }`}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); toggleDream(dream); }}
                      className={`shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                        dream.is_done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-border-custom hover:border-primary'
                      }`}
                    >
                      {dream.is_done && <Check size={9} strokeWidth={3} />}
                    </button>
                    <p className={`flex-1 text-[11px] font-semibold leading-snug min-w-0 truncate ${dream.is_done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {dream.title}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {dream.is_top5 && !dream.is_done && <Star size={8} className="text-amber-500" fill="currentColor" />}
                      {dream.description && <span className="w-1 h-1 rounded-full bg-primary/40" />}
                      {projectByDreamId[dream.id] && (
                        <span className="text-[7px] font-black uppercase tracking-widest text-primary/60 border border-primary/20 rounded px-1 py-0.5">
                          proj
                        </span>
                      )}
                      <span className={`text-[7px] font-black uppercase tracking-widest ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>
                        {dream.category}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); deleteDream(dream.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {dreams.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border-custom">
                <div className="flex justify-between text-[8px] font-bold text-text-muted uppercase tracking-widest">
                  <span>{doneDreams} zrealizowanych</span>
                  <span>{dreams.length} / 200</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border-custom overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min((dreams.length / 200) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Vision Board */}
        <Panel title="">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Wizualizacja</p>
                <p className="mt-0.5 font-display text-[15px] font-black tracking-tight text-text-primary leading-none">
                  Vision Board
                  <span className="ml-2 text-[11px] font-bold text-text-muted">{visionItems.length} elementów</span>
                </p>
              </div>
              <button
                onClick={() => setIsAddingVision(p => !p)}
                className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
              >
                <Plus size={11} /> Dodaj
              </button>
            </div>

            {/* Add form */}
            {isAddingVision && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3.5 space-y-2.5">
                {/* Type selector */}
                <div className="flex gap-1.5">
                  {[
                    { v: 'affirmation', label: 'Afirmacja', icon: <Sparkles size={10} /> },
                    { v: 'image',       label: 'Obraz (URL)', icon: <ImageIcon size={10} /> },
                    { v: 'word',        label: 'Słowo',    icon: <Type size={10} /> },
                  ].map(({ v, label, icon }) => (
                    <button
                      key={v}
                      onClick={() => setNewVisionType(v)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        newVisionType === v ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border-custom text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
                {/* Color selector */}
                <div className="flex gap-1.5 items-center">
                  <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Kolor:</span>
                  {Object.keys(VB_COLORS).map(c => (
                    <button
                      key={c}
                      onClick={() => setNewVisionColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${VB_COLORS[c].bg} ${newVisionColor === c ? 'border-primary scale-125' : 'border-transparent hover:scale-110'}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newVisionContent}
                    onChange={e => setNewVisionContent(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addVisionItem()}
                    placeholder={newVisionType === 'image' ? 'URL obrazka...' : newVisionType === 'word' ? 'Jedno słowo...' : 'Afirmacja: Jestem...'}
                    className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
                  />
                  <button onClick={addVisionItem} className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">
                    Dodaj
                  </button>
                  <button onClick={() => setIsAddingVision(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Board grid */}
            {visionItems.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Sparkles size={20} className="mx-auto text-text-muted/30" />
                <p className="text-[11px] text-text-muted/50">Dodaj afirmacje, obrazy i słowa które cię inspirują</p>
              </div>
            ) : (
              <div className="columns-2 gap-2 space-y-0">
                {visionItems.map(item => {
                  const c = VB_COLORS[item.color] || VB_COLORS.indigo;
                  return (
                    <div key={item.id} className="group relative break-inside-avoid mb-2">
                      {item.type === 'image' ? (
                        <div className="relative overflow-hidden rounded-[14px] border border-border-custom bg-surface">
                          <img
                            src={item.content}
                            alt=""
                            className="w-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <button
                            onClick={() => deleteVisionItem(item.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-all cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : item.type === 'word' ? (
                        <div className={`relative flex items-center justify-center rounded-[14px] border ${c.border} ${c.bg} px-4 py-5`}>
                          <p className={`font-display text-[22px] font-black tracking-tight ${c.text} text-center`}>{item.content}</p>
                          <button
                            onClick={() => deleteVisionItem(item.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className={`relative rounded-[14px] border ${c.border} ${c.bg} px-3.5 py-4`}>
                          <p className={`text-[12px] font-bold leading-snug ${c.text}`}>{item.content}</p>
                          <button
                            onClick={() => deleteVisionItem(item.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* Intelligence — conclusions, not data */}
        <IntelligencePanel
          oura={oura} sessions={sessions} nutrition={nutrition} wins={wins}
          patterns={patterns} wiki={wiki} knowledge={knowledge}
        />

      </main>
    </div>

    {/* Dream edit modal */}
    {editingDream && createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
        onClick={() => setEditingDream(null)}
      >
        <div
          className="w-full max-w-lg rounded-[24px] border border-border-custom bg-surface p-6 shadow-2xl space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <h2 className="font-display text-[15px] font-black text-text-primary">Pogłęb wizję</h2>
            </div>
            <button onClick={() => setEditingDream(null)} className="text-text-muted hover:text-text-primary cursor-pointer transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Marzenie</label>
            <input
              value={editDreamTitle}
              onChange={e => setEditDreamTitle(e.target.value)}
              className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm font-semibold text-text-primary outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5 flex-1">
              <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Kategoria</label>
              <select
                value={editDreamCat}
                onChange={e => setEditDreamCat(e.target.value)}
                className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary cursor-pointer"
              >
                {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Cel życiowy</label>
              <div className="flex gap-1.5">
                {([['cialo', 'Ciało', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'], ['duch', 'Duch', 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500'], ['konto', 'Konto', 'border-amber-500/40 bg-amber-500/10 text-amber-600']] as [string, string, string][]).map(([val, label, active]) => (
                  <button key={val} onClick={() => setEditDreamLifeGoal(editDreamLifeGoal === val ? null : val)}
                    className={`rounded-xl border px-3 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${editDreamLifeGoal === val ? active : 'border-border-custom text-text-muted hover:text-text-secondary'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">
              Wizja — jak się czujesz gdy to osiągasz?
            </label>
            <textarea
              value={editDreamDesc}
              onChange={e => setEditDreamDesc(e.target.value)}
              placeholder="Opisz jak to wygląda, jak się czujesz, co widzisz, słyszysz, czujesz w tym momencie..."
              rows={5}
              className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary resize-none placeholder:text-text-muted/40"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={saveDreamEdit}
              disabled={savingDream || !editDreamTitle.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-40"
            >
              <Check size={11} strokeWidth={2.5} /> Zapisz wizję
            </button>
            <button
              onClick={() => { toggleTop5(editingDream); setEditingDream((prev: any) => prev ? { ...prev, is_top5: !prev.is_top5 } : null); }}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                editingDream.is_top5
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                  : 'border-border-custom text-text-muted hover:border-amber-500/30 hover:text-amber-500'
              }`}
            >
              <Star size={11} fill={editingDream.is_top5 ? 'currentColor' : 'none'} />
              Top 5
            </button>
            <button
              onClick={() => { deleteDream(editingDream.id); }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 text-rose-400/50 hover:text-rose-500 hover:border-rose-500/30 transition-all cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
