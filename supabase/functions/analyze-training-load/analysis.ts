import { deepseekChat, parseJsonFromContent } from '../_shared/deepseek.ts';
import { getWarsawDateString } from '../_shared/time.ts';
import {
  epley, avg, fmtPace, fmt, ACTIVITY_KW, SAUNA_KW, classifyRun, fmtGcZones,
  weekOf, isoDow, DOW_PL, dayDiff, exercisePatterns, PATTERN_RULES, LEG_PATTERN_KEYS,
} from '../_shared/trainingHelpers.ts';
import { buildCoachBrain } from './coachBrain.ts';
import { buildSystemPrompt, buildUserMsg } from './prompts.ts';

export async function analyzeTrainingLoad(supabase: any, userId: string, apiKey: string) {
  const now = new Date();
  const warsaw = getWarsawDateString;
  const today = warsaw(now);
  const todayDow = isoDow(today);
  const todayDowLabel = DOW_PL[todayDow];
  const weekProgress = todayDow / 7;
  const earlyWeek = todayDow <= 2;
  const midWeek = todayDow >= 3 && todayDow <= 4;

  const addWarsawDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  };
  const w0Start = addWarsawDays(today, -6);
  const w4Start = addWarsawDays(today, -27);

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [strainR, workoutsR, stravaR, ouraR, planR] = await Promise.all([
    supabase.from('daily_strain').select('date,strain_score,cardio_load,strength_load').eq('user_id', userId).gte('date', w4Start).lte('date', today).order('date'),
    supabase.from('workout_sessions').select('id,date,workout_day,session_notes,msp_passed,duration_minutes,exercise_logs(exercise_name,set_number,weight,reps,rir,rpe,muscle_tags,is_pws_or_msp)').eq('user_id', userId).gte('date', w4Start).lte('date', today).order('date'),
    supabase.from('strava_activities_clean').select('start_date,name,sport_type,distance,moving_time,hr_avg,hr_max,perceived_exertion,has_pr,workout_type,gc_hr_zones,gc_weather,gc_laps,gc_training_effect_aerobic,gc_training_effect_anaerobic,gc_vo2max,gc_enriched_at').eq('user_id', userId).eq('is_oura', false).gte('start_date', w4Start + 'T00:00:00').lte('start_date', today + 'T23:59:59').order('start_date'),
    supabase.from('oura_daily_summary').select('date,hrv_avg,rhr_avg,readiness_score,total_sleep_hours').eq('user_id', userId).gte('date', w4Start).lte('date', today).order('date'),
    supabase.from('training_plan_workouts').select('planned_date,workout_type,workout_name,target_distance_km,target_duration_min,target_pace_min_km,target_hr_max,goal').eq('user_id', userId).gte('planned_date', w0Start).lte('planned_date', addWarsawDays(today, 7)).order('planned_date'),
  ]);

  const queryErrors: string[] = [];
  if (strainR.error) { console.error('[training] strain query failed:', strainR.error.message); queryErrors.push('strain'); }
  if (workoutsR.error) { console.error('[training] workouts query failed:', workoutsR.error.message); queryErrors.push('workouts'); }
  if (stravaR.error) { console.error('[training] strava query failed:', stravaR.error.message); queryErrors.push('strava'); }
  if (ouraR.error) { console.error('[training] oura query failed:', ouraR.error.message); queryErrors.push('oura'); }
  if (planR.error) { console.error('[training] plan query failed:', planR.error.message); queryErrors.push('training_plan'); }

  const strainAll = strainR.data || [];
  const workoutsAll = workoutsR.data || [];
  const stravaAll = stravaR.data || [];
  const ouraAll = ouraR.data || [];
  const planContext = planR.data || [];

  // ── Per-week slices ───────────────────────────────────────────────────────
  const byWeek = (arr: any[], key = 'date'): any[][] => {
    const r: any[][] = [[], [], [], []];
    for (const x of arr) {
      const w = weekOf((x as any)[key] || warsaw(new Date((x as any).start_date)), now, warsaw);
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

  // ── Day-by-day: ten tydzień ───────────────────────────────────────────────
  const w0Dates = [...new Set([
    ...strainByWeek[0].map((r: any) => r.date),
    ...ouraByWeek[0].map((r: any) => r.date),
    ...workoutsByWeek[0].map((w: any) => w.date),
    ...stravaByWeek[0].map((a: any) => warsaw(new Date(a.start_date))),
  ])].sort();

  const dayLines: string[] = [];
  for (const date of w0Dates) {
    const s = strainByWeek[0].find((r: any) => r.date === date);
    const o = ouraByWeek[0].find((r: any) => r.date === date);
    const ws = workoutsByWeek[0].filter((w: any) => w.date === date);
    const runs = stravaByWeek[0].filter((a: any) => warsaw(new Date(a.start_date)) === date && /run/i.test(a.sport_type || ''));
    const parts: string[] = [`[${date}]`];
    if (o?.readiness_score != null || o?.hrv_avg != null) parts.push(`  readiness ${o?.readiness_score ?? '—'} | HRV ${fmt(Number(o?.hrv_avg), 0, 'ms')} | sen ${fmt(Number(o?.total_sleep_hours), 1, 'h')}`);
    if (s?.strain_score != null) parts.push(`  strain ${fmt(Number(s.strain_score))}`);
    for (const w of ws) {
      const realLogs = (w.exercise_logs || []).filter((l: any) => !ACTIVITY_KW.test(l.exercise_name || ''));
      const saunaMin = (w.exercise_logs || []).filter((l: any) => SAUNA_KW.test(l.exercise_name || '')).reduce((sum: number, l: any) => sum + (Number(l.reps) || 0), 0);
      const byEx: Record<string, any[]> = {};
      for (const l of realLogs) { (byEx[l.exercise_name] ??= []).push(l); }
      const exStr = Object.entries(byEx).map(([name, sets]) => {
        const best = sets.reduce((b: any, s: any) => { const e = epley(Number(s.weight), Number(s.reps)); const bE = b ? epley(Number(b.weight), Number(b.reps)) : 0; return e && e > (bE || 0) ? s : b }, null);
        const rirAvg = avg(sets.filter((s: any) => s.rir != null).map((s: any) => Number(s.rir)));
        return `    ${name} ${sets.length}s${best ? ` top:${best.weight}×${best.reps}` : ''}${rirAvg != null ? ` RIR${rirAvg.toFixed(1)}` : ''}`;
      }).join('\n');
      parts.push(`  siłownia [${w.workout_day}]${w.msp_passed ? ' ⭐MSP' : ''}${w.duration_minutes ? ` ${w.duration_minutes}min` : ''}:`);
      if (exStr) parts.push(exStr);
      if (saunaMin > 0) parts.push(`  sauna ${saunaMin}min`);
    }
    for (const r of runs) {
      const type = classifyRun(r);
      const dist = r.distance ? `${(r.distance / 1000).toFixed(1)}km` : '—';
      const pace = fmtPace(r.moving_time, r.distance);
      const hr = r.hr_avg ? `HR${Math.round(r.hr_avg)}${z2Ceiling ? (r.hr_avg > (thresholdHr || 999) ? ' ⚠️powyżej progu' : r.hr_avg > (z2Ceiling || 999) ? ' [strefa 3-4]' : ' [Z2]') : ''}` : '';
      const rpe = r.perceived_exertion ? `RPE${r.perceived_exertion}` : '';
      const pr = r.has_pr ? '🏆PR' : '';
      parts.push(`  ${type}: "${r.name}" ${dist} ${pace}${hr ? ` ${hr}` : ''}${rpe ? ` ${rpe}` : ''}${pr ? ` ${pr}` : ''}`);
      if (r.gc_enriched_at) {
        const gcLine: string[] = [];
        if (r.gc_training_effect_aerobic != null) gcLine.push(`TE aerob ${r.gc_training_effect_aerobic}`);
        if (r.gc_training_effect_anaerobic != null) gcLine.push(`TE anaerob ${r.gc_training_effect_anaerobic}`);
        if (r.gc_vo2max != null) gcLine.push(`VO2max ${r.gc_vo2max}`);
        if (r.gc_weather?.temp_c != null) gcLine.push(`${r.gc_weather.temp_c}°C${r.gc_weather.condition ? ` ${r.gc_weather.condition}` : ''}`);
        if (gcLine.length) parts.push(`    [GC] ${gcLine.join(' | ')}`);
        const zonesStr = fmtGcZones(r.gc_hr_zones);
        if (zonesStr) parts.push(`    [GC] strefy HR: ${zonesStr}`);
        if (Array.isArray(r.gc_laps) && r.gc_laps.length) {
          const lapStr = r.gc_laps.filter((l: any) => l.distance >= 900).map((l: any) => `Km${l.lap}:${fmtPace(l.duration, l.distance)}${l.avg_hr ? ` HR${Math.round(l.avg_hr)}` : ''}`).join(' ');
          if (lapStr) parts.push(`    [GC] km-splity: ${lapStr}`);
        }
      }
    }
    dayLines.push(parts.join('\n'));
  }

  // ── Plan context ──────────────────────────────────────────────────────────
  const planText = planContext.length > 0
    ? planContext.map((p: any) => {
        const tgt = [p.target_distance_km ? `${p.target_distance_km}km` : null, p.target_pace_min_km ? `@${p.target_pace_min_km}/km` : null, p.target_hr_max ? `HR<${p.target_hr_max}` : null].filter(Boolean).join(' ');
        const goal = p.goal ? ` | Cel fazy: ${p.goal.slice(0, 80)}` : '';
        return `  ${p.planned_date} T${p.workout_type}: ${p.workout_name}${tgt ? ` — ${tgt}` : ''}${goal}`;
      }).join('\n')
    : '  (brak aktywnego planu)';

  // ── Muscle coverage ───────────────────────────────────────────────────────
  const weekMuscleTags = [...new Set(
    workoutsByWeek[0].flatMap((w: any) => w.exercise_logs || []).flatMap((l: any) => Array.isArray(l.muscle_tags) ? l.muscle_tags : []).filter(Boolean)
  )];

  // ── CoachBrain ────────────────────────────────────────────────────────────
  const coachSignals = buildCoachBrain({
    workoutsAll, stravaByWeek, w0, baseStrain, today, todayDow,
    z2Ceiling, thresholdHr, allTimeE1rm,
  });

  // ── Build prompt ──────────────────────────────────────────────────────────
  const dataQualityNote = queryErrors.length
    ? `\n⚠️ DATA_QUALITY: zapytania do [${queryErrors.join(', ')}] nie powiodły się — traktuj jako NIEZNANE.\n`
    : '';

  const systemPrompt = buildSystemPrompt();
  const userMsg = buildUserMsg({
    dataQualityNote, hrMax, z2Ceiling, thresholdHr, today, todayDowLabel, todayDow,
    baseRunKm, baseSets, baseStrain, expectedRunKmToDate, expectedSetsToDate, expectedStrainToDate,
    earlyWeek, midWeek, acwr, acwrLabel, acwrBand, monotony, acuteLoad, chronicLoad,
    w0, w1, w2, w3, dayLines, weekMuscleTags, progressionLines, planText,
    complianceLines, exerciseHistoryLines, coachSignals,
  });

  const result = await deepseekChat({
    apiKey, model: 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
    maxTokens: 4000, temperature: 0.2, timeoutMs: 90000,
  });

  const parsed: any = parseJsonFromContent(result.content);
  if (!parsed) throw new Error(`No JSON in response. Raw: ${result.content.slice(0, 300)}`);

  parsed.stats = {
    week_strain: w0.strainAvg != null ? +w0.strainAvg.toFixed(1) : null,
    base_strain: avg([w1.strainAvg, w2.strainAvg, w3.strainAvg].filter(Boolean) as number[])?.toFixed(1) ?? null,
    week_recovery: w0.recovAvg != null ? Math.round(w0.recovAvg) : null,
    base_recovery: avg([w1.recovAvg, w2.recovAvg, w3.recovAvg].filter(Boolean) as number[]) != null ? Math.round(avg([w1.recovAvg, w2.recovAvg, w3.recovAvg].filter(Boolean) as number[])!) : null,
    week_hrv: w0.hrvAvg != null ? Math.round(w0.hrvAvg) : null,
    base_hrv: avg([w1.hrvAvg, w2.hrvAvg, w3.hrvAvg].filter(Boolean) as number[]) != null ? Math.round(avg([w1.hrvAvg, w2.hrvAvg, w3.hrvAvg].filter(Boolean) as number[])!) : null,
    week_sleep: w0.sleepAvg != null ? +w0.sleepAvg.toFixed(1) : null,
    base_sleep: avg([w1.sleepAvg, w2.sleepAvg, w3.sleepAvg].filter(Boolean) as number[]) != null ? +(avg([w1.sleepAvg, w2.sleepAvg, w3.sleepAvg].filter(Boolean) as number[])!.toFixed(1)) : null,
    week_sets: w0.sets, base_sets_pw: Math.round(avg([w1.sets, w2.sets, w3.sets]) ?? 0),
    week_run_km: w0.km, base_run_km_pw: +(avg([w1.km, w2.km, w3.km])?.toFixed(1) ?? '0'),
    week_sauna: w0.saunaCount, base_sauna_pw: +(avg([w1.saunaCount, w2.saunaCount, w3.saunaCount])?.toFixed(1) ?? '0'),
    muscle_tags: weekMuscleTags, hr_max: hrMax, z2_ceiling: z2Ceiling,
    today, day_of_week: todayDow, day_of_week_label: todayDowLabel,
    week_progress: +weekProgress.toFixed(2), early_week: earlyWeek,
    expected_run_km_to_date: expectedRunKmToDate, expected_sets_to_date: expectedSetsToDate,
    expected_strain_to_date: expectedStrainToDate, coach_signals: coachSignals,
    km_trend: [w3.km, w2.km, w1.km, w0.km],
    sets_trend: [w3.sets, w2.sets, w1.sets, w0.sets],
    strain_trend: [w3.strainAvg, w2.strainAvg, w1.strainAvg, w0.strainAvg],
    acwr, acwr_band: acwr != null ? acwrBand(acwr) : null,
    monotony, acute_load: acuteLoad != null ? +acuteLoad.toFixed(1) : null,
    chronic_load: chronicLoad != null ? +chronicLoad.toFixed(1) : null,
  };

  return parsed;
}
