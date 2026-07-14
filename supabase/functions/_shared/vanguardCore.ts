/**
 * VANGUARD CORE 2.0 - Unified Behavioral Engine (Deno/Supabase Shared version)
 *
 * Jedyne źródło prawdy dla klasyfikacji stanu i obliczania baseline.
 * Sprowadzona do _shared/ aby backend i frontend współdzieliły te same reguły z-score.
 */

import { zScore, mean, stdDev } from './stats.ts';
import {
  generateActiveSignature, translateBiometrics, formatBaselineContext,
  detectLagCorrelations, evaluateIdentityVault, getEpisodeForDate, calculateGoalAlignment,
} from './vanguardCoreMethods.ts';

function getWarsawDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
}

function getWarsawDateMinusDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const VANGUARD_STATES = {
  LOCKED_IN:   'LOCKED_IN',
  MOMENTUM:    'MOMENTUM',
  RECOVERY:    'RECOVERY',
  CHAOS:       'CHAOS',
  AVOIDANCE:   'AVOIDANCE',
  CONSUMING:   'CONSUMING',
  CALIBRATING: 'CALIBRATING',
};

export function computeSignals(oura: any = null, todayWin: any = null, nutrition: any = null, lastTrainingDate: string | null = null, expectedDate: string = getWarsawDateString(new Date())) {
  const sleep = oura?.total_sleep_hours ?? null;
  const hrv = oura?.hrv_avg ?? null;
  const rhr = oura?.rhr_avg ?? null;
  const readiness = oura?.readiness_score ?? null;

  let completedTasks = 0;
  let timePenalty = 0;
  if (todayWin) {
    for (let i = 1; i <= 5; i++) {
      if (todayWin[`done_${i}`]) {
        completedTasks++;
        const completedAt = todayWin[`completed_at_${i}`];
        if (completedAt) {
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }).formatToParts(new Date(completedAt));
          const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
          if (hour >= 21) timePenalty += 0.1;
          if (hour >= 23) timePenalty += 0.15;
        }
      }
    }
  }

  const executionRatio = Math.max(0, (completedTasks / 5) - timePenalty);
  const proteinGoal = Number(nutrition?.protein_floor_g) || Number(nutrition?.protein_target) || 150;
  const proteinConsumed = nutrition?.protein || 0;
  const proteinRatio = Math.min(proteinConsumed / proteinGoal, 1.2);

  let trainingRatio = 0;
  if (lastTrainingDate) {
    const daysSince = Math.floor((new Date(`${expectedDate}T12:00:00`).getTime() - new Date(`${lastTrainingDate}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 1) trainingRatio = 1.0;
    else if (daysSince === 2) trainingRatio = 0.8;
    else if (daysSince === 3) trainingRatio = 0.5;
    else trainingRatio = 0.2;
  }

  return {
    screen_time_min: null, fragmentation: null, dopamine_load: null, overlap_factor: 1.0,
    sleep, hrv, rhr, readiness,
    execution_ratio: parseFloat(executionRatio.toFixed(2)),
    daily_rpe: todayWin?.daily_rpe || 5,
    protein_ratio: parseFloat(proteinRatio.toFixed(2)), protein_grams: proteinConsumed,
    training_ratio: trainingRatio,
    confidence: {
      digital: 0.0, biometrics: sleep != null ? 0.9 : 0.2, execution: todayWin != null ? 1.0 : 0.5,
      nutrition: nutrition != null ? 1.0 : 0.0, training: lastTrainingDate != null ? 1.0 : 0.0,
      is_stale: sleep != null && oura?.date !== expectedDate,
    },
  };
}

export class VanguardCore {
  private userId: string;
  private db: any;

  constructor(userId: string, db: any) {
    this.userId = userId;
    this.db = db;
  }

  _zScore(value: number | null, mean: number, stdDev: number): number { return zScore(value, mean, stdDev); }
  _mean(arr: number[]): number { return mean(arr); }
  _stdDev(arr: number[], avg: number): number { return stdDev(arr, avg); }

  async getPersonalBaseline() {
    const todayStr = getWarsawDateString(new Date());
    const ninetyDaysAgo = getWarsawDateMinusDays(todayStr, 90);

    const { data: history, error: historyErr } = await this.db
      .from('vanguard_daily_aggregates')
      .select('sleep_hours, hrv_avg, fragmentation_index, dopamine_load_index, screen_time_min, execution_score')
      .eq('user_id', this.userId).gte('date', ninetyDaysAgo).order('date', { ascending: false });

    if (historyErr) console.error('[vanguardCore] getPersonalBaseline query failed:', historyErr.message);

    const extract = (key: string) => (history || []).map((d: any) => d[key]).filter((v: any) => v != null);
    const sleepArr = extract('sleep_hours');
    const hrvArr = extract('hrv_avg');
    const fragArr = extract('fragmentation_index');
    const dopArr = extract('dopamine_load_index');
    const stArr = extract('screen_time_min');
    const execArr = extract('execution_score');
    const sampleSize = Math.max(sleepArr.length, execArr.length, hrvArr.length);

    if (sampleSize < 5) {
      return { means: { sleep: 7.5, hrv: 40, fragmentation: 1.0, dopamine_load: 1.0, screen_time: 300, execution: 0.6 }, stdDevs: { sleep: 0.8, hrv: 8, fragmentation: 0.4, dopamine_load: 0.4, screen_time: 80, execution: 0.2 }, sampleSize, calibrating: true };
    }

    const sleepMean = this._mean(sleepArr), hrvMean = this._mean(hrvArr), fragMean = this._mean(fragArr);
    const dopMean = this._mean(dopArr), stMean = this._mean(stArr), execMean = this._mean(execArr);

    return {
      means: { sleep: sleepMean, hrv: hrvMean, fragmentation: fragMean, dopamine_load: dopMean, screen_time: stMean, execution: execMean },
      stdDevs: { sleep: Math.max(this._stdDev(sleepArr, sleepMean), 0.3), hrv: Math.max(this._stdDev(hrvArr, hrvMean), 3), fragmentation: Math.max(this._stdDev(fragArr, fragMean), 0.1), dopamine_load: Math.max(this._stdDev(dopArr, dopMean), 0.1), screen_time: Math.max(this._stdDev(stArr, stMean), 30), execution: Math.max(this._stdDev(execArr, execMean), 0.1) },
      sampleSize, calibrating: false,
    };
  }

  calculateStabilityScore(current: any, baseline: any): number {
    const bl = baseline;
    const executionScore = (current.execution_ratio || 0) * 35;
    const trainingScore = (current.training_ratio || 0) * 20;
    const proteinScore = (current.protein_ratio || 0) * 15;
    const zSleep = this._zScore(current.sleep, bl.means.sleep, bl.stdDevs.sleep);
    const sleepScore = Math.max(0, Math.min(20, (zSleep + 2) * 5.0));
    const zHrv = this._zScore(current.hrv, bl.means.hrv, bl.stdDevs.hrv);
    const hrvScore = Math.max(0, Math.min(10, (zHrv + 2) * 2.5));
    let balanceModifier = 1.0;
    if (current.daily_rpe >= 8 && (current.sleep < 6.5 || current.hrv < bl.means.hrv)) balanceModifier = 0.8;
    return Math.round((executionScore + trainingScore + proteinScore + sleepScore + hrvScore) * balanceModifier);
  }

  async determineState(currentSignals: any, baseline?: any): Promise<{ state: string, score: number }> {
    const bl = baseline || await this.getPersonalBaseline();
    if (bl.calibrating) return { state: VANGUARD_STATES.CALIBRATING, score: 50 };
    if (currentSignals.confidence.is_stale) return { state: 'STALE_DATA', score: 0 };

    const HARD_LIMITS = { sleep_critical: 5.5, sleep_recovery: 6.2, readiness_critical: 55, hrv_floor_ratio: 0.5 };

    if (currentSignals.sleep != null && currentSignals.sleep < HARD_LIMITS.sleep_critical) return { state: VANGUARD_STATES.CHAOS, score: this.calculateStabilityScore(currentSignals, bl) };
    if (currentSignals.readiness != null && currentSignals.readiness < HARD_LIMITS.readiness_critical) return { state: VANGUARD_STATES.RECOVERY, score: this.calculateStabilityScore(currentSignals, bl) };
    if (currentSignals.hrv != null && bl.means.hrv && currentSignals.hrv < (bl.means.hrv * HARD_LIMITS.hrv_floor_ratio)) return { state: VANGUARD_STATES.RECOVERY, score: this.calculateStabilityScore(currentSignals, bl) };
    if (currentSignals.sleep != null && currentSignals.sleep < HARD_LIMITS.sleep_recovery) return { state: VANGUARD_STATES.RECOVERY, score: this.calculateStabilityScore(currentSignals, bl) };

    const stabilityScore = this.calculateStabilityScore(currentSignals, bl);
    const zSleep = this._zScore(currentSignals.sleep, bl.means.sleep, bl.stdDevs.sleep);
    const zHrv = this._zScore(currentSignals.hrv, bl.means.hrv, bl.stdDevs.hrv);
    const biologicalScore = (zSleep + zHrv) / 2;
    const exec = currentSignals.execution_ratio ?? 0;

    let state: string;
    if (biologicalScore < -2.0 && exec < 0.4)       state = VANGUARD_STATES.CHAOS;
    else if (biologicalScore < -1.0 && exec < 0.2)  state = VANGUARD_STATES.RECOVERY;
    else if (exec === 1.0 && biologicalScore >= 0)   state = VANGUARD_STATES.LOCKED_IN;
    else if (exec >= 0.8)                            state = VANGUARD_STATES.MOMENTUM;
    else if (biologicalScore >= -0.5 && exec < 0.4) state = VANGUARD_STATES.AVOIDANCE;
    else if (exec >= 0.4 && biologicalScore >= -0.5) state = VANGUARD_STATES.MOMENTUM;
    else                                             state = VANGUARD_STATES.RECOVERY;

    return { state, score: stabilityScore };
  }

  generateActiveSignature(footprint: any[] = [], metrics: any = {}) { return generateActiveSignature(footprint, metrics); }
  static translateBiometrics(oura: any, baselineMeans?: any) { return translateBiometrics(oura, baselineMeans); }
  formatBaselineContext(baseline: any, current: any) { return formatBaselineContext(baseline, current); }
  detectLagCorrelations(history: any[]) { return detectLagCorrelations(history); }
  async saveDailyAggregate(data: any) { const { error } = await this.db.from('vanguard_daily_aggregates').upsert({ user_id: this.userId, date: getWarsawDateString(new Date()), ...data }); return !error; }
  async evaluateIdentityVault(query: string | null = null) { return evaluateIdentityVault(this.db, this.userId); }
  async getEpisodeForDate(date: string) { return getEpisodeForDate(this.db, this.userId, date); }
  calculateGoalAlignment(todayWin: any) { return calculateGoalAlignment(todayWin); }
}
