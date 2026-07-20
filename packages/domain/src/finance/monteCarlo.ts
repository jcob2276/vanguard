import type { FireInputs } from './fireCalculator.ts';
import { computeFireMetrics } from './fireCalculator.ts';

export interface MonteCarloInput {
  currentSavings: number;
  monthlyContribution: number;
  fireTarget: number;
  expectedReturnPct: number;
  volatilityPct?: number;
  maxYears?: number;
  simulations?: number;
}

export interface MonteCarloResult {
  successProbability: number;
  medianYearsToFire: number | null;
  yearlyMedian: number[];
  yearlyP10: number[];
  yearlyP90: number[];
}

function randomNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulatePath(
  start: number,
  monthlyContribution: number,
  fireTarget: number,
  monthlyMean: number,
  monthlyVol: number,
  months: number,
): { success: boolean; monthsToFire: number | null; yearly: number[] } {
  let balance = start;
  let monthsToFire: number | null = null;
  const yearly: number[] = [balance];

  for (let m = 1; m <= months; m++) {
    const monthlyReturn = monthlyMean + monthlyVol * randomNormal();
    balance = balance * (1 + monthlyReturn) + monthlyContribution;
    if (monthsToFire == null && balance >= fireTarget) monthsToFire = m;
    if (m % 12 === 0) yearly.push(balance);
  }

  return { success: balance >= fireTarget, monthsToFire, yearly };
}

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const simulations = input.simulations ?? 400;
  const maxYears = input.maxYears ?? 40;
  const months = maxYears * 12;
  const vol = (input.volatilityPct ?? 15) / 100;
  const annualMean = input.expectedReturnPct / 100;
  const monthlyMean = (1 + annualMean) ** (1 / 12) - 1;
  const monthlyVol = vol / Math.sqrt(12);

  let successes = 0;
  const yearsToFireList: number[] = [];
  const pathsByYear: number[][] = Array.from({ length: maxYears + 1 }, () => []);

  for (let i = 0; i < simulations; i++) {
    const path = simulatePath(
      input.currentSavings,
      input.monthlyContribution,
      input.fireTarget,
      monthlyMean,
      monthlyVol,
      months,
    );
    if (path.success) successes++;
    if (path.monthsToFire != null) yearsToFireList.push(path.monthsToFire / 12);
    path.yearly.forEach((v, y) => pathsByYear[y]?.push(v));
  }

  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(p * (sorted.length - 1));
    return sorted[idx] ?? 0;
  };

  yearsToFireList.sort((a, b) => a - b);
  const medianYearsToFire = yearsToFireList.length > 0
    ? yearsToFireList[Math.floor(yearsToFireList.length / 2)]
    : null;

  return {
    successProbability: successes / simulations,
    medianYearsToFire,
    yearlyMedian: pathsByYear.map((arr) => percentile(arr, 0.5)),
    yearlyP10: pathsByYear.map((arr) => percentile(arr, 0.1)),
    yearlyP90: pathsByYear.map((arr) => percentile(arr, 0.9)),
  };
}

export function monteCarloFromFireInput(input: FireInputs, simulations?: number): MonteCarloResult {
  const fire = computeFireMetrics(input);
  return runMonteCarlo({
    currentSavings: input.currentSavings,
    monthlyContribution: fire.monthlySavings,
    fireTarget: fire.fireNumber,
    expectedReturnPct: input.expectedReturnPct,
    simulations,
  });
}
