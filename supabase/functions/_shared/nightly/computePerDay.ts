import { clamp } from './baselines.ts';
import { computeReadiness, type ReadinessDay } from './readiness.ts';
import { computeRecoveryScore } from './recovery_score.ts';
import { computeStrainScore } from './strain_score.ts';
import { estimateCaffeineMg } from '../caffeineEstimate.ts';
import { HEALTH_THRESHOLDS } from '@vanguard/domain';

const ILLNESS_KEYS = /chorob|illness|unwell|sick|przezi|grypa|flu/i;

export function buildIllnessDates(behaviorData: any[]) {
  const illnessDates = new Map<string, number>();
  for (const row of behaviorData) {
    if (ILLNESS_KEYS.test(row.behavior_key)) {
      const severity = Number(row.value) || 1;
      const penalty = severity >= 3 ? 18 : severity >= 2 ? 10 : 5;
      illnessDates.set(row.date, penalty);
    }
  }
  return illnessDates;
}

export function computePerDay(opts: {
  date: string;
  todayWarsaw: string;
  now: Date;
  zones: any; enh: any; summ: any; nutr: any;
  workouts: any; strava: any; recon: any; food: any;
  baseByDate: any; respByDate: any; skinTempByDate: any;
  sleepByDate: Record<string, number>;
  strainHistRunning: Array<{ date: string; strain_score: number | null }>;
  illnessDates: Map<string, number>;
  weight: number; sex: string; ageYears: number;
  algoVersion: number; uid: string;
  getBaselinesForDate: (d: string) => any;
  sleepTargetH?: number;
}) {
  const { date, todayWarsaw, now, zones, enh, summ, nutr, workouts, strava, recon, food,
    baseByDate, respByDate, skinTempByDate, sleepByDate, strainHistRunning, illnessDates,
    weight, sex, ageYears, algoVersion, uid, getBaselinesForDate, sleepTargetH } = opts;

  const { hrvEwma, rhrEwma, sleepScoreEwma, respEwma, hrvBase, rhrBase } = getBaselinesForDate(date);
  const fuelingProvisional = date === todayWarsaw;
  const z = zones[date]?.[0] || null;
  const e = enh[date]?.[0] || null;
  const s = summ[date]?.[0] || null;
  const n = nutr[date]?.[0] || null;
  const wsets = (workouts[date] || []).flatMap((w: any) => w.exercise_logs || []);
  const runs = strava[date] || [];
  const recRow = recon[date]?.[0] || null;
  const subjectiveScore = recRow?.day_score != null ? Number(recRow.day_score) : null;

  const kcal = n?.calories ?? null;
  const carbs = n?.carbs != null ? Number(n.carbs) : null;
  const protein = n?.protein != null ? Number(n.protein) : null;
  const sleep = s?.total_sleep_hours ?? null;
  const respToday = respByDate[date] ?? null;
  const skinTempToday = skinTempByDate[date] ?? null;

  const strainScoreResult = computeStrainScore({ z, runs, wsets, steps: e?.steps ?? null, kcal, carbs, protein, fuelingProvisional, weight });
  const recoveryScoreResult = computeRecoveryScore({ sleep, sleepByDate, date, respToday, skinTempToday, hrvAvg: s?.hrv_avg ?? null, rhrAvg: s?.rhr_avg ?? null, sleepScore: s?.sleep_score ?? null, readinessScore: s?.readiness_score ?? null, hrvEwma, rhrEwma, sleepScoreEwma, respEwma, hrvBase, rhrBase, subjectiveScore, ageYears, sex: (sex === 'F' || sex === 'M') ? sex : 'M', steps: e?.steps ?? null, sleepTargetH });

  let recovery = recoveryScoreResult.recovery;
  const strain = strainScoreResult.strain;
  const fuelingScore = strainScoreResult.fuelingScore;
  const hadLoad = strainScoreResult.cardioRaw > 80 || strainScoreResult.strengthPts > 30;

  // Status
  let status = 'yellow';
  if ((recovery != null && recovery < HEALTH_THRESHOLDS.RECOVERY_YELLOW) || (strain != null && strain > 15 && recovery != null && recovery < HEALTH_THRESHOLDS.RECOVERY_HIGH_STRAIN_ALERT) || (fuelingScore != null && fuelingScore < 40 && hadLoad && !fuelingProvisional)) status = 'red';
  else if (recovery != null && recovery >= HEALTH_THRESHOLDS.RECOVERY_GREEN && (strain == null || strain < 14)) status = 'green';

  // Limiter
  const mentalLoad: number | null = null;
  let limiter = 'recovery_ok';
  if (hadLoad && kcal != null && kcal < 1700 && !fuelingProvisional) limiter = 'calories';
  else if (strainScoreResult.isRunDay && carbs != null && carbs < 150 && !fuelingProvisional) limiter = 'carbs';
  else if (sleep != null && sleep < 6.0) limiter = 'sleep';
  else if (strain != null && strain > 15 && recovery != null && recovery < HEALTH_THRESHOLDS.RECOVERY_LIMITER) limiter = strainScoreResult.cardioRaw >= strainScoreResult.strengthPts ? 'cardio_load' : 'strength_load';
  else if (mentalLoad != null && mentalLoad >= 7) limiter = 'mental_load';
  else if (sleep != null && sleep < 6.8) limiter = 'sleep';
  else if (kcal != null && kcal < 1500 && !fuelingProvisional) limiter = 'calories';

  // Illness override
  const illnessPenalty = illnessDates.get(date) ?? 0;
  const isIll = illnessPenalty > 0;
  if (isIll) { if (recovery != null) recovery = clamp(recovery - illnessPenalty, 0, 100); limiter = 'illness'; status = status === 'green' ? 'yellow' : 'red'; }

  // Explanation
  const parts: string[] = [];
  if (strainScoreResult.isRunDay) parts.push('bieg');
  if (strainScoreResult.strengthPts > 0) parts.push('siłownia');
  if (e?.steps != null && e.steps >= 12000) parts.push(`${Math.round(e.steps / 1000)}k kroków`);
  if (kcal != null) parts.push(`${kcal} kcal`);
  const ctx = parts.join(' + ') || 'dzień regeneracyjny';
  const limiterPL: Record<string, string> = { sleep: 'głównym ograniczeniem jest sen', calories: 'za mało kalorii względem obciążenia', carbs: 'za mało węgli w dzień biegowy', cardio_load: 'wysoki koszt sercowo-naczyniowy', strength_load: 'ciężka sesja siłowa', mental_load: 'wysokie obciążenie mentalne', recovery_ok: 'regeneracja OK', illness: 'choroba/infekcja — ogranicz obciążenie' };
  const explanation = `${ctx}. Strain ${strain ?? '—'}/21, recovery ${recovery ?? '—'} — ${limiterPL[limiter]}.` + (isIll ? ' ⚠ choroba zalogowana.' : '') + (fuelingProvisional ? ' (fueling jeszcze niepełny)' : '');

  // Readiness level
  const strainByDate: Record<string, number | null> = {};
  for (const row of strainHistRunning) strainByDate[row.date] = row.strain_score == null ? null : Number(row.strain_score);
  strainByDate[date] = strain;

  const readinessDates = new Set<string>([...Object.keys(baseByDate), ...Object.keys(respByDate), ...Object.keys(strainByDate), date]);
  const readinessDays: ReadinessDay[] = [...readinessDates].filter((d) => d <= date).map((d) => ({
    date: d,
    hrv: d === date && s?.hrv_avg != null ? Number(s.hrv_avg) : baseByDate[d]?.hrv_avg != null ? Number(baseByDate[d].hrv_avg) : null,
    rhr: d === date && s?.rhr_avg != null ? Number(s.rhr_avg) : baseByDate[d]?.rhr_avg != null ? Number(baseByDate[d].rhr_avg) : null,
    respRate: respByDate[d] ?? null,
    strain: strainByDate[d] ?? null,
  }));
  const readiness = computeReadiness(readinessDays, date);

  // Caffeine decay
  const refTs = date === todayWarsaw ? now.getTime() : new Date(date + 'T22:00:00').getTime();
  let caffeineActiveMg = 0;
  for (const entry of food[date] || []) {
    const mg = estimateCaffeineMg(entry.name);
    if (mg === 0 || !entry.logged_at) continue;
    const hoursElapsed = (refTs - new Date(entry.logged_at).getTime()) / 3600000;
    if (hoursElapsed < 0 || hoursElapsed > 24) continue;
    caffeineActiveMg += mg * Math.pow(0.5, hoursElapsed / 5.5);
  }
  caffeineActiveMg = Math.round(caffeineActiveMg);
  const caffeineAlert = caffeineActiveMg > 25;
  const hydrationGoalMl = (sex === 'F' ? 2700 : 3700) + Math.round((strain ?? 0) / 21 * 700);

  return {
    row: {
      user_id: uid, date, strain_score: strain, recovery_score: recovery, fueling_score: fuelingScore,
      mental_load_score: mentalLoad, daily_status: status, main_limiter: limiter,
      fueling_provisional: fuelingProvisional, readiness_level: readiness.level, explanation,
      algo_version: algoVersion,
      cardio_load: Math.round(strainScoreResult.cardioRaw * 10) / 10,
      strength_load: strainScoreResult.strengthPts, leg_load: strainScoreResult.legPts,
      cns_load: strainScoreResult.cnsPts, steps_load: Math.round(strainScoreResult.stepsLoad * 10) / 10,
      fueling_penalty: strainScoreResult.fuelingPenalty,
      components: {
        zones: z || null, raw_total: Math.round(strainScoreResult.rawTotal * 10) / 10,
        run_rpe: strainScoreResult.maxRpe || null, pr: strainScoreResult.hasPr || null,
        weight, kcal, carbs, protein, steps: e?.steps ?? null, sleep_h: sleep,
        hrv_base: hrvEwma ? Math.round(hrvEwma.center) : hrvBase ? Math.round(hrvBase) : null,
        rhr_base: rhrEwma ? Math.round(rhrEwma.center) : rhrBase ? Math.round(rhrBase) : null,
        hrv_ewma_nValid: hrvEwma?.nValid ?? null,
        resp_base: respEwma ? Math.round(respEwma.center * 10) / 10 : null,
        resp_today: respToday, skin_temp_dev_today: skinTempToday,
        readiness_signals: readiness.signals,
        recovery_confidence: recoveryScoreResult.recoveryConfidence,
        strain_confidence: strainScoreResult.strainConfidence,
        wellness_load: strainScoreResult.wellnessPts > 0 ? Math.round(strainScoreResult.wellnessPts * 10) / 10 : null,
        caffeine_active_mg: caffeineActiveMg > 0 ? caffeineActiveMg : null, caffeine_alert: caffeineAlert || null,
        hydration_goal_ml: hydrationGoalMl,
        fitness_age: recoveryScoreResult.fitnessAge, body_age: recoveryScoreResult.bodyAge,
        vitality_score: recoveryScoreResult.vitalityScore, sleep_debt_h: recoveryScoreResult.sleepDebtH,
        hrv_z: recoveryScoreResult.zHrv != null ? Math.round(recoveryScoreResult.zHrv * 100) / 100 : null,
        rhr_z: recoveryScoreResult.zRhr != null ? Math.round(recoveryScoreResult.zRhr * 100) / 100 : null,
        sleep_score_today: s?.sleep_score != null ? Number(s.sleep_score) : null,
        sleep_z: recoveryScoreResult.zSleepScore,
      },
      updated_at: new Date().toISOString(),
    },
    strain,
  };
}
