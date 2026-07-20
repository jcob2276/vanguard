export type CashflowEventKind = 'bill' | 'subscription' | 'income' | 'expense';

export interface CashflowEventInput {
  kind: CashflowEventKind;
  name: string;
  amount: number;
  day: number;
}

export interface CashflowDay {
  day: number;
  events: CashflowEventInput[];
  net: number;
}

export interface CashflowMonthSummary {
  days: CashflowDay[];
  totalIn: number;
  totalOut: number;
  net: number;
  projectedEndBalance: number;
}

function clampDay(day: number, daysInMonth: number): number {
  return Math.min(Math.max(1, Math.round(day)), daysInMonth);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildCashflowMonth(
  year: number,
  month: number,
  events: CashflowEventInput[],
  startingBalance: number,
): CashflowMonthSummary {
  const dim = daysInMonth(year, month);
  const byDay = new Map<number, CashflowEventInput[]>();

  for (const event of events) {
    const day = clampDay(event.day, dim);
    const list = byDay.get(day) ?? [];
    list.push(event);
    byDay.set(day, list);
  }

  const days: CashflowDay[] = [];
  let totalIn = 0;
  let totalOut = 0;

  for (let day = 1; day <= dim; day++) {
    const dayEvents = byDay.get(day) ?? [];
    let net = 0;
    for (const e of dayEvents) {
      if (e.kind === 'income') {
        net += e.amount;
        totalIn += e.amount;
      } else {
        net -= e.amount;
        totalOut += e.amount;
      }
    }
    days.push({ day, events: dayEvents, net });
  }

  return {
    days,
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    projectedEndBalance: startingBalance + totalIn - totalOut,
  };
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y, month: m };
}
