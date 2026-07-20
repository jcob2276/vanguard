import type { FinanceIncomeType } from './constants.ts';

export interface IncomeSourceRow {
  source_type: string;
  amount_monthly: number;
  is_active: boolean;
}

export interface IncomeBreakdown {
  baseMonthly: number;
  variableMonthly: number;
  passiveMonthly: number;
  totalMonthly: number;
}

export interface RunwayFloorMetrics {
  /** Miesiące płynności przy obecnych wydatkach (bez nowego dochodu). */
  liquidRunwayMonths: number;
  /** Miesiące do wyczerpania płynności, gdy wpływa tylko baza (UoZ). null = baza pokrywa wydatki. */
  runwayWithoutDealMonths: number | null;
  monthlyDeficitWithoutVariable: number;
  baseCoversExpenses: boolean;
}

const BASE_INCOME_TYPES = new Set<FinanceIncomeType>(['salary', 'other']);
const VARIABLE_INCOME_TYPES = new Set<FinanceIncomeType>(['commission', 'sales']);
const PASSIVE_INCOME_TYPES = new Set<FinanceIncomeType>(['interest', 'dividend', 'refund']);

function asIncomeType(value: string): FinanceIncomeType | null {
  if (BASE_INCOME_TYPES.has(value as FinanceIncomeType)) return value as FinanceIncomeType;
  if (VARIABLE_INCOME_TYPES.has(value as FinanceIncomeType)) return value as FinanceIncomeType;
  if (PASSIVE_INCOME_TYPES.has(value as FinanceIncomeType)) return value as FinanceIncomeType;
  return null;
}

export function computeIncomeBreakdown(sources: IncomeSourceRow[]): IncomeBreakdown {
  let baseMonthly = 0;
  let variableMonthly = 0;
  let passiveMonthly = 0;

  for (const source of sources) {
    if (!source.is_active) continue;
    const amount = Math.max(0, source.amount_monthly);
    const type = asIncomeType(source.source_type);
    if (!type) {
      baseMonthly += amount;
      continue;
    }
    if (BASE_INCOME_TYPES.has(type)) baseMonthly += amount;
    else if (VARIABLE_INCOME_TYPES.has(type)) variableMonthly += amount;
    else passiveMonthly += amount;
  }

  return {
    baseMonthly,
    variableMonthly,
    passiveMonthly,
    totalMonthly: baseMonthly + variableMonthly + passiveMonthly,
  };
}

export function computeRunwayFloor(
  liquid: number,
  monthlyExpenses: number,
  income: IncomeBreakdown,
): RunwayFloorMetrics {
  const expenses = Math.max(0, monthlyExpenses);
  const liquidRunwayMonths = expenses > 0 ? liquid / expenses : 0;
  const monthlyDeficitWithoutVariable = Math.max(0, expenses - income.baseMonthly - income.passiveMonthly);
  const baseCoversExpenses = monthlyDeficitWithoutVariable <= 0;

  const runwayWithoutDealMonths = baseCoversExpenses
    ? null
    : liquid / monthlyDeficitWithoutVariable;

  return {
    liquidRunwayMonths,
    runwayWithoutDealMonths,
    monthlyDeficitWithoutVariable,
    baseCoversExpenses,
  };
}

export function resolveEffectiveIncome(
  profileMonthlyIncome: number,
  breakdown: IncomeBreakdown,
): number {
  if (profileMonthlyIncome > 0) return profileMonthlyIncome;
  return breakdown.totalMonthly;
}
