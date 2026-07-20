export interface MortgageInput {
  principal: number;
  annualRatePct: number;
  years: number;
  extraMonthly?: number;
}

export interface MortgageResult {
  monthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
  monthsToPayoff: number;
  interestSaved: number;
}

export function computeMortgage(input: MortgageInput): MortgageResult {
  const principal = Math.max(0, input.principal);
  const months = Math.max(1, Math.round(input.years * 12));
  const r = input.annualRatePct / 100 / 12;
  const extra = input.extraMonthly ?? 0;

  const basePayment = r > 0
    ? (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1)
    : principal / months;

  let balance = principal;
  let totalInterest = 0;
  let paidMonths = 0;
  const maxMonths = months * 2;

  while (balance > 0.01 && paidMonths < maxMonths) {
    const interest = balance * r;
    const payment = Math.min(basePayment + extra, balance + interest);
    totalInterest += interest;
    balance = balance + interest - payment;
    paidMonths++;
  }

  const baseline = computeBaselineInterest(principal, r, months, basePayment);

  return {
    monthlyPayment: Math.round(basePayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round((principal + totalInterest) * 100) / 100,
    monthsToPayoff: paidMonths,
    interestSaved: Math.round(Math.max(0, baseline - totalInterest) * 100) / 100,
  };
}

function computeBaselineInterest(principal: number, r: number, months: number, payment: number): number {
  let balance = principal;
  let interest = 0;
  for (let m = 0; m < months && balance > 0; m++) {
    const i = balance * r;
    interest += i;
    balance = balance + i - payment;
  }
  return interest;
}
