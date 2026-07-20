export interface SafeToSpendInput {
  liquid: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyTargetMonths: number;
  spentThisMonth: number;
  daysLeftInMonth: number;
}

export interface SafeToSpendResult {
  safeToday: number;
  safeThisMonth: number;
  dailyBudget: number;
  emergencyBlocked: boolean;
  breakdown: {
    freeCashFlow: number;
    emergencyReserve: number;
    afterReserve: number;
    remainingMonth: number;
  };
}

export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const emergencyReserve = input.monthlyExpenses * input.emergencyTargetMonths;
  const freeCashFlow = input.monthlyIncome - input.monthlyExpenses;
  const emergencyBlocked = input.liquid < emergencyReserve;
  const afterReserve = Math.max(0, input.liquid - emergencyReserve);

  const remainingMonth = Math.max(0, freeCashFlow - input.spentThisMonth);
  const safeThisMonth = emergencyBlocked ? remainingMonth * 0.25 : remainingMonth;
  const daysLeft = Math.max(1, input.daysLeftInMonth);
  const safeToday = Math.max(0, safeThisMonth / daysLeft);
  const dailyBudget = freeCashFlow > 0 ? freeCashFlow / 30.44 : 0;

  return {
    safeToday,
    safeThisMonth,
    dailyBudget,
    emergencyBlocked,
    breakdown: {
      freeCashFlow,
      emergencyReserve,
      afterReserve,
      remainingMonth,
    },
  };
}
