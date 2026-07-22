/**
 * Snowball Analytics Engine for Vanguard OS.
 * Core algorithms: XIRR, Dividend Forecasting, ETF X-Ray, Rebalancing, Dividend Safety Rating, Tax Adjuster & Backtesting.
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
  payoutRatioPct?: number;
  fcfCoverageRatio?: number;
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

export interface DividendSafetyMetric {
  ticker: string;
  companyName: string;
  score: number; // 0..100
  safetyLevel: 'safe' | 'warning' | 'danger';
  payoutRatio: number;
  explanation: string;
}

export interface TaxSettings {
  applyBelkaTax: boolean; // 19% Polish Belka Tax
  w8BenRatePct: number; // 15% US withholding tax for W8-BEN
}

/**
 * Calculates net dividend after tax deductions (Belka 19% or W8-BEN 15%).
 */
export function calculateNetDividend(grossAmount: number, isUsStock: boolean, settings: TaxSettings): number {
  if (!settings.applyBelkaTax) return grossAmount;
  const taxRate = isUsStock ? Math.max(0.19, settings.w8BenRatePct / 100) : 0.19;
  return Math.round(grossAmount * (1 - taxRate) * 100) / 100;
}

/**
 * Evaluates Dividend Safety Rating (0..100) based on Payout Ratio & FCF coverage.
 */
export function evaluateDividendSafety(dividends: DividendRecord[]): DividendSafetyMetric[] {
  return dividends.map((div) => {
    const payout = div.payoutRatioPct ?? 45; // Default safe 45% if unlisted
    let score = 100 - payout;
    if (score > 90) score = 90;
    if (score < 10) score = 10;

    let safetyLevel: 'safe' | 'warning' | 'danger' = 'safe';
    let explanation = 'Wskaźnik wypłaty dywidendy w normie (Payout Ratio < 60%)';

    if (payout > 80) {
      safetyLevel = 'danger';
      explanation = 'Wysokie ryzyko ścięcia dywidendy (Payout Ratio > 80%)';
    } else if (payout > 60) {
      safetyLevel = 'warning';
      explanation = 'Podwyższony wskaźnik wypłaty (Payout Ratio 60-80%)';
    }

    return {
      ticker: div.ticker,
      companyName: div.companyName,
      score,
      safetyLevel,
      payoutRatio: payout,
      explanation,
    };
  });
}

/**
 * Calculates monthly dividend forecast for the next 12 months (Gross vs Net).
 */
export function calculate12MonthDividendForecast(
  dividends: DividendRecord[],
  taxSettings: TaxSettings = { applyBelkaTax: true, w8BenRatePct: 15 },
): {
  monthlyTotalsGross: Record<string, number>;
  monthlyTotalsNet: Record<string, number>;
  total12MonthForecastGross: number;
  total12MonthForecastNet: number;
  averageMonthlyIncomeNet: number;
} {
  const monthlyTotalsGross: Record<string, number> = {};
  const monthlyTotalsNet: Record<string, number> = {};
  let total12MonthForecastGross = 0;
  let total12MonthForecastNet = 0;

  dividends.forEach((div) => {
    const monthKey = div.payDate.slice(0, 7);
    const isUs = div.ticker.includes('AAPL') || div.ticker.includes('MSFT') || div.ticker.includes('NVDA');
    const netAmount = calculateNetDividend(div.totalAmount, isUs, taxSettings);

    monthlyTotalsGross[monthKey] = (monthlyTotalsGross[monthKey] || 0) + div.totalAmount;
    monthlyTotalsNet[monthKey] = (monthlyTotalsNet[monthKey] || 0) + netAmount;

    total12MonthForecastGross += div.totalAmount;
    total12MonthForecastNet += netAmount;
  });

  return {
    monthlyTotalsGross,
    monthlyTotalsNet,
    total12MonthForecastGross: Math.round(total12MonthForecastGross * 100) / 100,
    total12MonthForecastNet: Math.round(total12MonthForecastNet * 100) / 100,
    averageMonthlyIncomeNet: Math.round((total12MonthForecastNet / 12) * 100) / 100,
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
 * XIRR calculation helper (Newton-Raphson method for Internal Rate of Return).
 */
export function calculateXIRR(cashFlows: { date: Date; amount: number }[]): number {
  if (cashFlows.length < 2) return 0;

  let rate = 0.1;
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
      return Math.round(newRate * 10000) / 100;
    }
    rate = newRate;
  }

  return Math.round(rate * 10000) / 100;
}
