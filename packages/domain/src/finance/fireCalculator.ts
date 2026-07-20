export interface FireInputs {
  monthlyExpenses: number;
  monthlyIncome: number;
  currentSavings: number;
  expectedReturnPct: number;
  inflationPct: number;
  safeWithdrawalRatePct: number;
  /** Years until traditional retirement for Coast FIRE (optional). */
  yearsToRetirement?: number;
}

export interface FireResults {
  fireNumber: number;
  leanFire: number;
  fatFire: number;
  coastFire: number;
  baristaFire: number;
  yearsToFire: number | null;
  monthsToFire: number | null;
  monthlySavings: number;
  savingsRatePct: number;
  runwayMonths: number;
  progressPct: number;
  realReturnPct: number;
  freedomDaysForAmount: (amount: number) => number;
  freedomMonthsForAmount: (amount: number) => number;
}

export interface FinancialScoreInputs {
  runwayMonths: number;
  emergencyTargetMonths: number;
  savingsRatePct: number;
  fireProgressPct: number;
  monthlyCashFlow: number;
}

export interface ScenarioResult {
  label: string;
  yearsToFire: number | null;
  fireNumber: number;
}

function monthlyRateFromAnnual(annualPct: number): number {
  if (annualPct <= -100) return 0;
  return (1 + annualPct / 100) ** (1 / 12) - 1;
}

function monthsToReachTarget(
  present: number,
  monthlyContribution: number,
  target: number,
  monthlyRate: number,
  maxMonths = 12 * 80,
): number | null {
  if (target <= 0) return 0;
  if (present >= target) return 0;
  if (monthlyContribution <= 0 && monthlyRate <= 0) return null;

  let balance = present;
  for (let m = 1; m <= maxMonths; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (balance >= target) return m;
  }
  return null;
}

export function computeRealReturnPct(nominalPct: number, inflationPct: number): number {
  return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
}

export function computeFireMetrics(input: FireInputs): FireResults {
  const monthlyExpenses = Math.max(0, input.monthlyExpenses);
  const monthlyIncome = Math.max(0, input.monthlyIncome);
  const currentSavings = Math.max(0, input.currentSavings);
  const swr = Math.max(0.1, input.safeWithdrawalRatePct) / 100;
  const annualExpenses = monthlyExpenses * 12;
  const fireNumber = annualExpenses / swr;
  const leanFire = fireNumber * 0.7;
  const fatFire = fireNumber * 1.5;
  const baristaFire = fireNumber * 0.5;

  const realReturnPct = computeRealReturnPct(input.expectedReturnPct, input.inflationPct);
  const monthlyRate = monthlyRateFromAnnual(input.expectedReturnPct);
  const yearsToRetirement = input.yearsToRetirement ?? 20;
  const coastFire = yearsToRetirement > 0
    ? fireNumber / (1 + realReturnPct / 100) ** yearsToRetirement
    : fireNumber;

  const monthlySavings = Math.max(0, monthlyIncome - monthlyExpenses);
  const savingsRatePct = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const runwayMonths = monthlyExpenses > 0 ? currentSavings / monthlyExpenses : 0;
  const progressPct = fireNumber > 0 ? Math.min(100, (currentSavings / fireNumber) * 100) : 0;
  const monthsToFire = monthsToReachTarget(currentSavings, monthlySavings, fireNumber, monthlyRate);

  const dailyBurn = monthlyExpenses / 30.44;
  const freedomDaysForAmount = (amount: number) => (dailyBurn > 0 ? amount / dailyBurn : 0);
  const freedomMonthsForAmount = (amount: number) => (monthlyExpenses > 0 ? amount / monthlyExpenses : 0);

  return {
    fireNumber,
    leanFire,
    fatFire,
    coastFire,
    baristaFire,
    yearsToFire: monthsToFire != null ? monthsToFire / 12 : null,
    monthsToFire,
    monthlySavings,
    savingsRatePct,
    runwayMonths,
    progressPct,
    realReturnPct,
    freedomDaysForAmount,
    freedomMonthsForAmount,
  };
}

export function computeFinancialScore(input: FinancialScoreInputs): number {
  const emergencyRatio = input.emergencyTargetMonths > 0
    ? Math.min(1, input.runwayMonths / input.emergencyTargetMonths)
    : 0;
  const savingsScore = Math.min(1, input.savingsRatePct / 30);
  const fireScore = Math.min(1, input.fireProgressPct / 100);
  const cashFlowScore = input.monthlyCashFlow >= 0 ? 1 : 0;

  const raw = emergencyRatio * 25 + savingsScore * 25 + fireScore * 25 + cashFlowScore * 25;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function computeScenarios(
  base: FireInputs,
  scenarios: { label: string; patch: Partial<FireInputs> }[],
): ScenarioResult[] {
  return scenarios.map(({ label, patch }) => {
    const merged = { ...base, ...patch };
    const metrics = computeFireMetrics(merged);
    return { label, yearsToFire: metrics.yearsToFire, fireNumber: metrics.fireNumber };
  });
}

/** Monthly contribution needed to hit FIRE in N years. */
export function monthlyContributionForTarget(
  present: number,
  target: number,
  years: number,
  expectedReturnPct: number,
): number {
  const months = Math.max(1, Math.round(years * 12));
  const r = monthlyRateFromAnnual(expectedReturnPct);
  if (target <= present) return 0;
  if (r <= 0) return (target - present) / months;
  const factor = ((1 + r) ** months - 1) / r;
  const futureValueOfPresent = present * (1 + r) ** months;
  const gap = target - futureValueOfPresent;
  return gap <= 0 ? 0 : gap / factor;
}
