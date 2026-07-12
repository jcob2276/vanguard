import {
  epley, avg, classifyRun, weekOf, isoDow, DOW_PL, exercisePatterns, ACTIVITY_KW, SAUNA_KW,
} from '../_shared/trainingHelpers.ts';

export interface CalculatorInputs {
  strainAll: any[];
  workoutsAll: any[];
  stravaAll: any[];
  ouraAll: any[];
  planContext: any[];
  today: string;
  now: Date;
  w0Start: string;
  warsaw: (d: Date) => string;
}

export function computeTrainingMetrics(inputs: CalculatorInputs) {
  const { strainAll, workoutsAll, stravaAll, ouraAll, planContext, today, now, w0Start, warsaw } = inputs;
  const todayDow = isoDow(today);
  const todayDowLabel = DOW_PL[todayDow];
  const weekProgress = todayDow / 7;
  const earlyWeek = todayDow <= 2;
  const midWeek = todayDow >= 3 && todayDow <= 4;

  // ── Per-week slices ───────────────────────────────────────────────────────
  const byWeek = (arr: any[], key = 'date'): any[][] => {
    const r: any[][] = [[], [], [], []];
    for (const x of arr) {
      const w = weekOf((x[key] as string) || warsaw(new Date(x.start_date as string)), now, warsaw);
      if (w >= 0 && w <= 3) r[w].push(x);
    }
    return r;
  };

  const stravaByWeek = (() => {
    const r: any[][] = [[], [], [], []];
    for (const a of stravaAll) {
      const w = weekOf(warsaw(new Date(a.start_date)), now, warsaw);
      if (w >= 0 && w <= 3) r[w].push(a);
    }
    return r;
  })();

  const workoutsByWeek = byWeek(workoutsAll);
  const strainByWeek = byWeek(strainAll);
  const ouraByWeek = byWeek(ouraAll);

  // ── HRmax ─────────────────────────────────────────────────────────────────
  const allHrMax = stravaAll.map((a: any) => Number(a.hr_max)).filter((v: number) => v > 100);
  const hrMax = allHrMax.length ? Math.max(...allHrMax) : null;
  const z2Ceiling = hrMax ? Math.round(hrMax * 0.76) : null;
  const thresholdHr = hrMax ? Math.round(hrMax * 0.88) : null;

  // ── Weekly summaries ──────────────────────────────────────────────────────
  const wkSummary = (wIdx: number) => {
    const runs = stravaByWeek[wIdx].filter((a: any) => /run/i.test(a.sport_type || ''));
    const allLogs = workoutsByWeek[wIdx].flatMap((w: any) => w.exercise_logs || []);
    const sets = allLogs.filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || '')).length;
    const km = runs.reduce((s: number, a: any) => s + (a.distance || 0) / 1000, 0);
    const strainAvg = avg(strainByWeek[wIdx].map((r: any) => Number(r.strain_score)).filter(Boolean));
    const recovAvg = avg(ouraByWeek[wIdx].map((r: any) => Number(r.readiness_score)).filter(Boolean));
    const hrvAvg = avg(ouraByWeek[wIdx].map((r: any) => Number(r.hrv_avg)).filter(Boolean));
    const sleepAvg = avg(ouraByWeek[wIdx].map((r: any) => Number(r.total_sleep_hours)).filter(Boolean));
    const saunaCount = workoutsByWeek[wIdx].filter((w: any) => (w.exercise_logs || []).some((l: any) => SAUNA_KW.test(l.exercise_name || ''))).length;
    const hasLongRun = runs.some((a: any) => classifyRun(a) === 'Długi bieg');
    const maxRunKm = runs.length ? Math.max(...runs.map((a: any) => (a.distance || 0) / 1000)) : 0;
    return { sets, km: +km.toFixed(1), strainAvg, recovAvg, hrvAvg, sleepAvg, saunaCount, hasLongRun, maxRunKm: +maxRunKm.toFixed(1), runCount: runs.length };
  };

  const [w0, w1, w2, w3] = [0, 1, 2, 3].map(wkSummary);
  const baseRunKm = avg([w1.km, w2.km, w3.km]) ?? 0;
  const baseSets = avg([w1.sets, w2.sets, w3.sets]) ?? 0;
  const baseStrain = avg([w1.strainAvg, w2.strainAvg, w3.strainAvg].filter(Boolean) as number[]) ?? null;
  const expectedRunKmToDate = +(baseRunKm * weekProgress).toFixed(1);
  const expectedSetsToDate = Math.round(baseSets * weekProgress);
  const expectedStrainToDate = baseStrain != null ? +(baseStrain * weekProgress).toFixed(1) : null;

  // ── ACWR + Monotony ──────────────────────────────────────────────────────
  const acuteStrains = strainAll.filter((r: any) => r.date >= w0Start && r.strain_score != null).map((r: any) => Number(r.strain_score));
  const chronicStrains = strainAll.filter((r: any) => r.strain_score != null).map((r: any) => Number(r.strain_score));
  const acuteLoad = avg(acuteStrains);
  const chronicLoad = chronicStrains.length >= 14 ? avg(chronicStrains) : null;
  const acwr = acuteLoad != null && chronicLoad != null && chronicLoad > 0 ? +(acuteLoad / chronicLoad).toFixed(2) : null;
  const acwrBand = (r: number) => r < 0.8 ? 'undertrained' : r <= 1.3 ? 'optimal' : r <= 1.5 ? 'elevated' : 'spike_risk';
  let monotony: number | null = null;
  if (acuteStrains.length >= 4) {
    const wm = avg(acuteStrains)!;
    const wSS = acuteStrains.reduce((s: number, v: number) => s + (v - wm) ** 2, 0);
    const wSD = Math.sqrt(wSS / (acuteStrains.length - 1));
    if (wSD > 0) monotony = +(wm / wSD).toFixed(2);
  }
  const acwrLabel: Record<string, string> = { undertrained: 'undertrained (<0.8)', optimal: 'sweet spot ✓ (0.8–1.3)', elevated: 'podwyższony (1.3–1.5)', spike_risk: '⚠️ SPIKE (>1.5)' };

  // ── e1RM progression ─────────────────────────────────────────────────────
  const e1RMBase: Record<string, number[]> = {};
  const e1RMWeek: Record<string, number[]> = {};
  for (const w of [...workoutsByWeek[3], ...workoutsByWeek[2], ...workoutsByWeek[1]]) {
    for (const l of (w.exercise_logs || []).filter((l: any) => Number(l.weight) > 0 && Number(l.reps) > 0)) {
      const e = epley(Number(l.weight), Number(l.reps));
      if (e) { (e1RMBase[l.exercise_name] ??= []).push(e); }
    }
  }
  for (const w of workoutsByWeek[0]) {
    for (const l of (w.exercise_logs || []).filter((l: any) => Number(l.weight) > 0 && Number(l.reps) > 0)) {
      const e = epley(Number(l.weight), Number(l.reps));
      if (e) { (e1RMWeek[l.exercise_name] ??= []).push(e); }
    }
  }
  const progressionLines: string[] = [];
  for (const name of Object.keys(e1RMBase).filter(n => e1RMWeek[n] && e1RMBase[n].length >= 3)) {
    const baseMax = Math.max(...e1RMBase[name]);
    const weekMax = Math.max(...e1RMWeek[name]);
    const p = ((weekMax - baseMax) / baseMax) * 100;
    if (Math.abs(p) >= 2) progressionLines.push(`${name}: ${p > 0 ? '+' : ''}${p.toFixed(1)}% e1RM (${weekMax.toFixed(1)}kg vs 3-tygodniowy maks ${baseMax.toFixed(1)}kg)`);
  }

  // ── Last session per exercise ────────────────────────────────────────────
  const allWorkoutsSorted = [...workoutsAll].sort((a: any, b: any) => b.date.localeCompare(a.date));
  const lastSessionByEx: Record<string, { date: string; sets: any[]; e1rm: number | null }> = {};
  for (const w of allWorkoutsSorted) {
    const logs = (w.exercise_logs || []).filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || '') && l.exercise_name?.trim());
    for (const l of logs) {
      if (!lastSessionByEx[l.exercise_name]) {
        const allSetsThisSession = logs.filter((x: any) => x.exercise_name === l.exercise_name);
        const bestE1rm = allSetsThisSession.reduce((best: number | null, s: any) => {
          const e = epley(Number(s.weight), Number(s.reps));
          return e && (best === null || e > best) ? e : best;
        }, null);
        lastSessionByEx[l.exercise_name] = { date: w.date, sets: allSetsThisSession, e1rm: bestE1rm };
      }
    }
  }
  const allTimeE1rm: Record<string, number> = {};
  for (const w of allWorkoutsSorted) {
    for (const l of (w.exercise_logs || []).filter((l: any) => Number(l.weight) > 0 && Number(l.reps) > 0)) {
      const e = epley(Number(l.weight), Number(l.reps));
      if (e && (!allTimeE1rm[l.exercise_name] || e > allTimeE1rm[l.exercise_name])) allTimeE1rm[l.exercise_name] = e;
    }
  }
  const exerciseHistoryLines = Object.entries(lastSessionByEx)
    .sort(([, a], [, b]) => b.date.localeCompare(a.date)).slice(0, 20)
    .map(([name, info]) => {
      const setBySn = [...info.sets].sort((a, b) => a.set_number - b.set_number);
      const setsStr = setBySn.map((s: any) => {
        const parts = [`${s.weight || 0}kg×${s.reps || 0}`];
        if (s.rir != null) parts.push(`RIR${s.rir}`);
        if (s.rpe != null) parts.push(`RPE${s.rpe}`);
        if (s.is_pws_or_msp) parts.push('MSP');
        return parts.join(' ');
      }).join(' | ');
      const e1rm = allTimeE1rm[name];
      return `  ${name} [${info.date}]: ${setsStr}${e1rm ? ` → e1RM ~${e1rm.toFixed(0)}kg` : ''}`;
    }).join('\n');

  // ── Plan compliance ──────────────────────────────────────────────────────
  const complianceLines: string[] = [];
  for (const p of planContext.filter((p: any) => p.planned_date <= today)) {
    const date = p.planned_date;
    const hasRun = stravaByWeek[0].some((a: any) => warsaw(new Date(a.start_date)) === date && /run/i.test(a.sport_type || ''));
    const hasWorkout = workoutsByWeek[0].some((w: any) => w.date === date);
    const done = hasRun || hasWorkout;
    const typeLabel = p.workout_type === 1 ? 'Wyścig' : p.workout_type === 2 ? 'Długi bieg' : 'Trening/bieg';
    complianceLines.push(`  ${date} [${typeLabel}] ${p.workout_name}: ${done ? '✓ WYKONANE' : '✗ BRAK'}`);
  }

  return {
    todayDow, todayDowLabel, weekProgress, earlyWeek, midWeek,
    stravaByWeek, workoutsByWeek, strainByWeek, ouraByWeek,
    hrMax, z2Ceiling, thresholdHr,
    w0, w1, w2, w3,
    baseRunKm, baseSets, baseStrain,
    expectedRunKmToDate, expectedSetsToDate, expectedStrainToDate,
    acwr, acwrBand, acwrLabel, monotony, acuteLoad, chronicLoad,
    progressionLines, exerciseHistoryLines, complianceLines, allTimeE1rm,
  };
}
