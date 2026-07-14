import { clamp } from './baselines.ts';

interface EwmaBaselineData {
  center: number;
  spread: number;
  nValid: number;
}

export interface RecoveryInput {
  sleep: number | null;
  sleepByDate: Record<string, number>;
  date: string;
  respToday: number | null;
  skinTempToday: number | null;
  hrvAvg: number | null;
  rhrAvg: number | null;
  sleepScore: number | null;
  readinessScore: number | null;
  hrvEwma: EwmaBaselineData | null;
  rhrEwma: EwmaBaselineData | null;
  sleepScoreEwma: EwmaBaselineData | null;
  respEwma: EwmaBaselineData | null;
  hrvBase: number | null;
  rhrBase: number | null;
  subjectiveScore: number | null;
  ageYears: number;
  sex: 'M' | 'F';
  steps: number | null;
  sleepTargetH?: number;
}

export interface RecoveryResult {
  sleepDebtH: number | null;
  recovery: number | null;
  zHrv: number | null;
  zRhr: number | null;
  zSleepScore: number | null;
  isSubjectiveFallback: boolean;
  recoveryConfidence: 'calibrating' | 'building' | 'solid';
  fitnessAge: number | null;
  bodyAge: number | null;
  vitalityScore: number | null;
}

export function computeRecoveryScore(input: RecoveryInput): RecoveryResult {
  const {
    sleep,
    sleepByDate,
    date,
    respToday,
    skinTempToday,
    hrvAvg,
    rhrAvg,
    sleepScore,
    readinessScore,
    hrvEwma,
    rhrEwma,
    sleepScoreEwma,
    respEwma,
    hrvBase,
    rhrBase,
    subjectiveScore,
    ageYears,
    sex,
    steps,
  } = input;

  // ── SLEEP DEBT (Strand SleepDebt.swift) 14-night rolling ledger ──
  // Target: sleepTargetH (or fallback 7.5h). Positive = nadwyżka snu, Negative = dług.
  const SLEEP_TARGET = input.sleepTargetH ?? 7.5;
  if (sleep != null) {
    sleepByDate[date] = Number(sleep);
  }
  const sleepDates14 = Object.keys(sleepByDate)
    .sort()
    .filter((d) => d <= date)
    .slice(-14);
  const sleepDebtH =
    sleepDates14.length >= 4
      ? Math.round(sleepDates14.reduce((acc, d) => acc + (sleepByDate[d] - SLEEP_TARGET), 0) * 10) / 10
      : null;

  // z-scores hoisted out of recovery block for VitalBands export
  const SIGMA = 1.4826; // MAD → pseudo-standard deviation
  let zHrv: number | null = null;
  let zRhr: number | null = null;
  let zSleepScore: number | null = null;
  let recovery: number | null = null;

  if (sleepScore != null && sleepScoreEwma != null && sleepScoreEwma.nValid >= 4) {
    zSleepScore = (Number(sleepScore) - sleepScoreEwma.center) / Math.max(SIGMA * sleepScoreEwma.spread, 1e-9);
    zSleepScore = Math.round(zSleepScore * 100) / 100;
  }

  if (hrvAvg != null && hrvEwma != null && hrvEwma.nValid >= 4) {
    const W_HRV = 0.55;
    const W_RHR = 0.20;
    const W_SLEEP = 0.15;
    const W_RESP = 0.05;
    const W_SKIN = 0.05;

    zHrv = (Number(hrvAvg) - hrvEwma.center) / Math.max(SIGMA * hrvEwma.spread, 1e-9);
    zRhr =
      rhrAvg != null && rhrEwma
        ? (rhrEwma.center - Number(rhrAvg)) / Math.max(SIGMA * rhrEwma.spread, 1e-9)
        : null;

    const sleepPerf = sleep != null ? Number(sleep) / (input.sleepTargetH ?? 8.0) : null;
    const zSleep = sleepPerf != null ? (sleepPerf - 0.85) / 0.12 : null;

    // Resp: wyższa wartość = gorzej (early illness signal), inwersja jak RHR
    const zResp =
      respToday != null && respEwma != null
        ? (respEwma.center - respToday) / Math.max(SIGMA * respEwma.spread, 1e-9)
        : null;

    // Skin temp: symetryczna kara — odchylenie w którąkolwiek stronę = gorzej (4.2: skinTempScaleC=1.0)
    const zSkin = skinTempToday != null ? -Math.abs(skinTempToday) / 1.0 : null;

    let zSum = zHrv * W_HRV;
    let wSum = W_HRV;

    if (zRhr != null) {
      zSum += zRhr * W_RHR;
      wSum += W_RHR;
    }
    if (zSleep != null) {
      zSum += zSleep * W_SLEEP;
      wSum += W_SLEEP;
    }
    if (zResp != null) {
      zSum += zResp * W_RESP;
      wSum += W_RESP;
    }
    if (zSkin != null) {
      zSum += zSkin * W_SKIN;
      wSum += W_SKIN;
    }

    // Logistic: K=1.6, Z0=-0.20 → Z=0 gives 58% (population average)
    const score = 100 / (1 + Math.exp(-1.6 * (zSum / wSum + 0.20)));
    recovery = clamp(Math.round(score), 0, 100);
  }

  // Cold-start fallback (< 4 valid baseline nights): use Oura readiness
  if (recovery === null && (readinessScore != null || sleep != null)) {
    let rec = readinessScore ?? 65;
    if (sleep != null) {
      if (Number(sleep) < 6) rec -= 12;
      else if (Number(sleep) < 7) rec -= 6;
    }
    recovery = clamp(Math.round(rec), 0, 100);
  }

  // Subjective recovery fallback when Oura is completely missing (e.g. ring uncharged)
  let isSubjectiveFallback = false;
  if (recovery === null && subjectiveScore !== null) {
    recovery = clamp(subjectiveScore * 10, 10, 100);
    isSubjectiveFallback = true;
  }

  // ── SCORE CONFIDENCE (PLAN_READINESS_NOOP.md 4.8) — szczere tiery pewności ──
  const recoveryConfidence: 'calibrating' | 'building' | 'solid' =
    recovery === null
      ? 'calibrating'
      : isSubjectiveFallback
      ? 'building'
      : (hrvEwma?.nValid ?? 0) >= 14
      ? 'solid'
      : 'building';

  // ── FITNESS AGE (4.16 Nes 2011 waist variant) ──
  const rhrToday = rhrAvg != null ? Number(rhrAvg) : null;
  const paiProxy = steps != null ? clamp(steps / 2000, 0, 10) : 5;
  const rhrC = sex === 'F' ? 0.192 : 0.155;
  const paiC = sex === 'F' ? 0.186 : 0.226;
  const ageC = sex === 'F' ? 0.289 : 0.296;
  const fitnessAge =
    rhrToday != null
      ? clamp(Math.round(ageYears + (rhrC * (rhrToday - 65) - paiC * (paiProxy - 5)) / ageC), 20, 90)
      : null;

  // ── VITALITY ENGINE (4.13 Gompertz: ln(2)/8 hazard doubling) ──
  const LN_HAZARD = Math.log(2) / 8; // ≈ 0.0866
  const normRHR = 60 + 0.15 * (ageYears - 25);
  const normHRV = 75 - 0.8 * (ageYears - 20);
  let vFactors = 0;
  let nVFactors = 0;

  if (rhrToday != null) {
    vFactors += 0.025 * (rhrToday - normRHR);
    nVFactors++;
  }
  if (hrvAvg != null) {
    vFactors += -0.012 * (Number(hrvAvg) - normHRV);
    nVFactors++;
  }
  if (sleep != null) {
    vFactors += -0.10 * clamp(Number(sleep) - 7.0, -2.5, 1.0);
    nVFactors++;
  }

  let bodyAge: number | null = null;
  let vitalityScore: number | null = null;
  if (nVFactors >= 2) {
    bodyAge = clamp(Math.round(ageYears + (0.75 * vFactors) / LN_HAZARD), 20, 90);
    vitalityScore = clamp(Math.round(50 + (ageYears - bodyAge) * 2.5), 0, 100);
  }

  return {
    sleepDebtH,
    recovery,
    zHrv,
    zRhr,
    zSleepScore,
    isSubjectiveFallback,
    recoveryConfidence,
    fitnessAge,
    bodyAge,
    vitalityScore,
  };
}
