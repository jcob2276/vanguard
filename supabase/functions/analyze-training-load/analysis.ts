import { deepseekChat, parseJsonFromContent } from '../_shared/deepseek.ts';
import { getWarsawDateString } from '../_shared/time.ts';
import {
  epley, avg, fmtPace, fmt, ACTIVITY_KW, SAUNA_KW, classifyRun, fmtGcZones,
} from '../_shared/trainingHelpers.ts';
import { buildCoachBrain } from './coachBrain.ts';
import { buildSystemPrompt, buildUserMsg } from './prompts.ts';
import { fetchTrainingRawData } from './trainingRepo.ts';
import { computeTrainingMetrics } from './loadCalculator.ts';

export async function analyzeTrainingLoad(supabase: any, userId: string, apiKey: string) {
  const now = new Date();
  const warsaw = getWarsawDateString;
  const today = warsaw(now);

  const addWarsawDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  };
  const w0Start = addWarsawDays(today, -6);
  const w4Start = addWarsawDays(today, -27);

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const { strainAll, workoutsAll, stravaAll, ouraAll, planContext, queryErrors } =
    await fetchTrainingRawData(supabase, userId, w4Start, w0Start, today, addWarsawDays);

  // ── Calculate training load metrics ───────────────────────────────────────
  const metrics = computeTrainingMetrics({
    strainAll, workoutsAll, stravaAll, ouraAll, planContext,
    today, now, w0Start, warsaw,
  });

  // ── Day-by-day: ten tydzień ───────────────────────────────────────────────
  const w0Dates = [...new Set([
    ...metrics.strainByWeek[0].map((r: any) => r.date),
    ...metrics.ouraByWeek[0].map((r: any) => r.date),
    ...metrics.workoutsByWeek[0].map((w: any) => w.date),
    ...metrics.stravaByWeek[0].map((a: any) => warsaw(new Date(a.start_date))),
  ])].sort();

  const dayLines: string[] = [];
  for (const date of w0Dates) {
    const s = metrics.strainByWeek[0].find((r: any) => r.date === date);
    const o = metrics.ouraByWeek[0].find((r: any) => r.date === date);
    const ws = metrics.workoutsByWeek[0].filter((w: any) => w.date === date);
    const runs = metrics.stravaByWeek[0].filter((a: any) => warsaw(new Date(a.start_date)) === date && /run/i.test(a.sport_type || ''));
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
      const hr = r.hr_avg ? `HR${Math.round(r.hr_avg)}${metrics.z2Ceiling ? (r.hr_avg > (metrics.thresholdHr || 999) ? ' ⚠️powyżej progu' : r.hr_avg > (metrics.z2Ceiling || 999) ? ' [strefa 3-4]' : ' [Z2]') : ''}` : '';
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
  const weekMuscleTags = [...new Set(metrics.workoutsByWeek[0].flatMap((w: any) => w.exercise_logs || []).flatMap((l: any) => Array.isArray(l.muscle_tags) ? l.muscle_tags : []).filter(Boolean))];
  const coachSignals = buildCoachBrain({ workoutsAll, stravaByWeek: metrics.stravaByWeek, w0: metrics.w0, baseStrain: metrics.baseStrain, today, todayDow: metrics.todayDow, z2Ceiling: metrics.z2Ceiling, thresholdHr: metrics.thresholdHr, allTimeE1rm: metrics.allTimeE1rm });
  const dataQualityNote = queryErrors.length ? `\n⚠️ DATA_QUALITY: zapytania do [${queryErrors.join(', ')}] nie powiodły się — traktuj jako NIEZNANE.\n` : '';
  const systemPrompt = buildSystemPrompt();
  const userMsg = buildUserMsg({
    dataQualityNote, hrMax: metrics.hrMax, z2Ceiling: metrics.z2Ceiling, thresholdHr: metrics.thresholdHr, today, todayDowLabel: metrics.todayDowLabel, todayDow: metrics.todayDow,
    baseRunKm: metrics.baseRunKm, baseSets: metrics.baseSets, baseStrain: metrics.baseStrain, expectedRunKmToDate: metrics.expectedRunKmToDate, expectedSetsToDate: metrics.expectedSetsToDate, expectedStrainToDate: metrics.expectedStrainToDate,
    earlyWeek: metrics.earlyWeek, midWeek: metrics.midWeek, acwr: metrics.acwr, acwrLabel: metrics.acwrLabel, acwrBand: metrics.acwrBand, monotony: metrics.monotony, acuteLoad: metrics.acuteLoad, chronicLoad: metrics.chronicLoad,
    w0: metrics.w0, w1: metrics.w1, w2: metrics.w2, w3: metrics.w3, dayLines, weekMuscleTags, progressionLines: metrics.progressionLines, planText,
    complianceLines: metrics.complianceLines, exerciseHistoryLines: metrics.exerciseHistoryLines, coachSignals,
  });

  const result = await deepseekChat({ apiKey, model: 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }], maxTokens: 4000, temperature: 0.2, timeoutMs: 90000 });
  const parsed: any = parseJsonFromContent(result.content);
  if (!parsed) throw new Error(`No JSON in response. Raw: ${result.content.slice(0, 300)}`);

  const bA = (vals: (number | null | undefined)[]) => { const f = vals.filter(Boolean) as number[]; return f.length ? avg(f) : null; };
  const bR = (vals: (number | null | undefined)[]) => { const v = bA(vals); return v != null ? Math.round(v) : null; };
  parsed.stats = {
    week_strain: metrics.w0.strainAvg != null ? +metrics.w0.strainAvg.toFixed(1) : null, base_strain: bA([metrics.w1.strainAvg, metrics.w2.strainAvg, metrics.w3.strainAvg])?.toFixed(1) ?? null,
    week_recovery: metrics.w0.recovAvg != null ? Math.round(metrics.w0.recovAvg) : null, base_recovery: bR([metrics.w1.recovAvg, metrics.w2.recovAvg, metrics.w3.recovAvg]),
    week_hrv: metrics.w0.hrvAvg != null ? Math.round(metrics.w0.hrvAvg) : null, base_hrv: bR([metrics.w1.hrvAvg, metrics.w2.hrvAvg, metrics.w3.hrvAvg]),
    week_sleep: metrics.w0.sleepAvg != null ? +metrics.w0.sleepAvg.toFixed(1) : null, base_sleep: bA([metrics.w1.sleepAvg, metrics.w2.sleepAvg, metrics.w3.sleepAvg]) != null ? +(bA([metrics.w1.sleepAvg, metrics.w2.sleepAvg, metrics.w3.sleepAvg])!.toFixed(1)) : null,
    week_sets: metrics.w0.sets, base_sets_pw: Math.round(avg([metrics.w1.sets, metrics.w2.sets, metrics.w3.sets]) ?? 0),
    week_run_km: metrics.w0.km, base_run_km_pw: +(avg([metrics.w1.km, metrics.w2.km, metrics.w3.km])?.toFixed(1) ?? '0'),
    week_sauna: metrics.w0.saunaCount, base_sauna_pw: +(avg([metrics.w1.saunaCount, metrics.w2.saunaCount, metrics.w3.saunaCount])?.toFixed(1) ?? '0'),
    muscle_tags: weekMuscleTags, hr_max: metrics.hrMax, z2_ceiling: metrics.z2Ceiling,
    today, day_of_week: metrics.todayDow, day_of_week_label: metrics.todayDowLabel, week_progress: +metrics.weekProgress.toFixed(2), early_week: metrics.earlyWeek,
    expected_run_km_to_date: metrics.expectedRunKmToDate, expected_sets_to_date: metrics.expectedSetsToDate, expected_strain_to_date: metrics.expectedStrainToDate, coach_signals: coachSignals,
    km_trend: [metrics.w3.km, metrics.w2.km, metrics.w1.km, metrics.w0.km], sets_trend: [metrics.w3.sets, metrics.w2.sets, metrics.w1.sets, metrics.w0.sets], strain_trend: [metrics.w3.strainAvg, metrics.w2.strainAvg, metrics.w1.strainAvg, metrics.w0.strainAvg],
    acwr: metrics.acwr, acwr_band: metrics.acwr != null ? metrics.acwrBand(metrics.acwr) : null, monotony: metrics.monotony, acute_load: metrics.acuteLoad != null ? +metrics.acuteLoad.toFixed(1) : null, chronic_load: metrics.chronicLoad != null ? +metrics.chronicLoad.toFixed(1) : null,
  };

  return parsed;
}
