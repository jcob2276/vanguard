/**
 * Snowball Analytics Engine for Vanguard OS.
 * Core algorithms: XIRR (Internal Rate of Return), Dividend Forecasting, ETF X-Ray Aggregator, Rebalancing.
 */

export interface DividendRecord {
  id: string;
  ticker: string;
  companyName: string;
  amountPerShare: number;
  sharesCount: number;
  totalAmount: number;
  currency: string;
  exDate: string; // YYYY-MM-DD
  payDate: string; // YYYY-MM-DD
  status: 'expected' | 'received';
}

export interface HoldingTarget {
  id: string;
  ticker: string;
  name: string;
  assetCategory: 'stocks' | 'etf' | 'crypto' | 'bonds' | 'cash';
  targetPct: number;
}

export interface RebalanceRecommendation {
  ticker: string;
  name: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  differencePct: number;
  recommendedActionValue: number; // Positive = Buy, Negative = Sell
  actionType: 'buy' | 'sell' | 'hold';
}

export interface EtfXrayHolding {
  symbol: string;
  companyName: string;
  weightPct: number;
  directSharesValue: number;
  indirectEtfValue: number;
  totalEffectiveValue: number;
}

/**
 * Calculates monthly dividend forecast for the next 12 months.
 */
export function calculate12MonthDividendForecast(dividends: DividendRecord[]): {
  monthlyTotals: Record<string, number>; // YYYY-MM -> total
  total12MonthForecast: number;
  averageMonthlyIncome: number;
} {
  const monthlyTotals: Record<string, number> = {};
  let total12MonthForecast = 0;

  dividends.forEach((div) => {
    const monthKey = div.payDate.slice(0, 7); // YYYY-MM
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + div.totalAmount;
    total12MonthForecast += div.totalAmount;
  });

  const averageMonthlyIncome = Math.round((total12MonthForecast / 12) * 100) / 100;

  return {
    monthlyTotals,
    total12MonthForecast: Math.round(total12MonthForecast * 100) / 100,
    averageMonthlyIncome,
  };
}

/**
 * Calculates Portfolio Rebalancing actions.
 */
export function calculatePortfolioRebalance(
  currentHoldings: { ticker: string; name: string; currentValue: number }[],
  targets: HoldingTarget[],
): RebalanceRecommendation[] {
  const totalPortfolioValue = currentHoldings.reduce((acc, h) => acc + h.currentValue, 0);
  if (totalPortfolioValue <= 0) return [];

  const recommendations: RebalanceRecommendation[] = [];

  targets.forEach((target) => {
    const match = currentHoldings.find((h) => h.ticker.toLowerCase() === target.ticker.toLowerCase());
    const currentValue = match ? match.currentValue : 0;
    const currentPct = Math.round((currentValue / totalPortfolioValue) * 10000) / 100;
    const differencePct = Math.round((target.targetPct - currentPct) * 100) / 100;
    const targetValue = (target.targetPct / 100) * totalPortfolioValue;
    const recommendedActionValue = Math.round((targetValue - currentValue) * 100) / 100;

    let actionType: 'buy' | 'sell' | 'hold' = 'hold';
    if (recommendedActionValue > 10) actionType = 'buy';
    else if (recommendedActionValue < -10) actionType = 'sell';

    recommendations.push({
      ticker: target.ticker,
      name: target.name || match?.name || target.ticker,
      currentValue,
      currentPct,
      targetPct: target.targetPct,
      differencePct,
      recommendedActionValue,
      actionType,
    });
  });

  return recommendations;
}

/**
 * Simple XIRR calculation helper (Newton-Raphson method for Internal Rate of Return).
 */
export function calculateXIRR(cashFlows: { date: Date; amount: number }[]): number {
  if (cashFlows.length < 2) return 0;

  let rate = 0.1; // Initial guess 10%
  const maxIterations = 100;
  const precision = 0.0001;
  const firstDate = cashFlows[0].date;

  for (let i = 0; i < maxIterations; i++) {
    let fValue = 0;
    let fDerivative = 0;

    for (const flow of cashFlows) {
      const dayDiff = (flow.date.getTime() - firstDate.getTime()) / (1000 * 3600 * 24);
      const yearFraction = dayDiff / 365.0;

      fValue += flow.amount / Math.pow(1 + rate, yearFraction);
      fDerivative -= (yearFraction * flow.amount) / Math.pow(1 + rate, yearFraction + 1);
    }

    if (Math.abs(fDerivative) < 1e-10) break;
    const newRate = rate - fValue / fDerivative;

    if (Math.abs(newRate - rate) < precision) {
      return Math.round(newRate * 10000) / 100; // Returns percentage, e.g. 12.45
    }
    rate = newRate;
  }

  return Math.round(rate * 10000) / 100;
}
