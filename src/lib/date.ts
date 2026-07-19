export * from '@vanguard/domain';
import { TIMEZONE } from '@vanguard/domain';

export function formatDayLabel(dateStr: string, todayStr: string, yesterdayStr?: string, padZero = false): string {
  if (dateStr === todayStr) return 'Dziś';
  if (yesterdayStr && dateStr === yesterdayStr) return 'Wczoraj';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const [, m, d] = parts;
  return padZero ? `${d}.${m}` : `${parseInt(d)}.${parseInt(m)}`;
}

export function formatDashboardDate(): string {
  return new Date().toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIMEZONE,
  });
}

export function formatShortDateWarsaw(date: Date | string | number): string {
  return new Date(date).toLocaleDateString('pl-PL', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatLongDateWarsaw(date: Date | string | number): string {
  return new Date(date).toLocaleDateString('pl-PL', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
