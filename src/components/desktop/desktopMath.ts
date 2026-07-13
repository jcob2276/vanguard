import { getTodayWarsaw, shiftDateStr } from '../../lib/date';

export const daysBefore = (n: number) => shiftDateStr(getTodayWarsaw(), -n);

export const avg = (arr: number[]) =>
  arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : null;
