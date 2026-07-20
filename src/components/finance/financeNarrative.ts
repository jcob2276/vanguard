import { formatMonths, formatPln } from '../../lib/finance/formatMoney';
import type { FinanceMetrics } from './useFinanceMetrics';

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

export function buildTodayHeadline(metrics: FinanceMetrics): string {
  return formatPln(metrics.safeToSpend.safeToday);
}

export function buildTodayContext(metrics: FinanceMetrics): string {
  const { safeToSpend, runway, incomeBreakdown, effectiveExpenses } = metrics;

  if (safeToSpend.emergencyBlocked) {
    return `Budujesz poduszkę — na dziś liczę ostrożniej. W tym miesiącu zostało około ${formatPln(safeToSpend.safeThisMonth)}.`;
  }

  const monthTail = `W tym miesiącu zostało około ${formatPln(safeToSpend.safeThisMonth)}.`;

  if (runway.baseCoversExpenses) {
    return `Przy samym UoZ (${formatPln(incomeBreakdown.baseMonthly)}/mies.) wydatki około ${formatPln(effectiveExpenses)} się spinają. ${monthTail}`;
  }

  const runwayText = formatMonths(runway.runwayWithoutDealMonths ?? 0);
  return `Bez prowizji masz rezerwę na około ${runwayText}. ${monthTail}`;
}

export function buildNetWorthLine(metrics: FinanceMetrics): string {
  const { netWorth, liquid } = metrics;
  return `Majątek ${formatPln(netWorth)} · ${formatPln(liquid)} od ręki`;
}

export interface WaterfallLine {
  label: string;
  amount: number;
  kind: 'in' | 'out' | 'result' | 'muted';
}

export function buildMonthWaterfall(metrics: FinanceMetrics): WaterfallLine[] {
  const { effectiveIncome, billsMonthly, subsMonthly, spentThisMonth, safeToSpend } = metrics;
  const fixed = billsMonthly + subsMonthly;
  const lines: WaterfallLine[] = [
    { label: 'Dochód', amount: effectiveIncome, kind: 'in' },
  ];
  if (billsMonthly > 0) lines.push({ label: 'Rachunki', amount: -billsMonthly, kind: 'out' });
  if (subsMonthly > 0) lines.push({ label: 'Subskrypcje', amount: -subsMonthly, kind: 'out' });
  if (spentThisMonth > 0) lines.push({ label: 'Już wydane', amount: -spentThisMonth, kind: 'muted' });
  lines.push({ label: 'Zostało w miesiącu', amount: safeToSpend.safeThisMonth, kind: 'result' });
  if (fixed === 0 && spentThisMonth === 0 && effectiveIncome === 0) return [];
  return lines;
}

export function buildPurchaseVerdict(amount: number, days: number): string {
  if (amount <= 0) return '';
  if (days < 1) return `${formatPln(amount)} — mniej niż dzień wolności.`;
  if (days < 7) return `${formatPln(amount)} to około ${days.toFixed(1)} dni wolności.`;
  if (days < 30) return `${formatPln(amount)} to około ${days.toFixed(0)} dni wolności.`;
  return `${formatPln(amount)} to około ${days.toFixed(0)} dni wolności.`;
}
