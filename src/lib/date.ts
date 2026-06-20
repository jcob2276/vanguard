const WARSAW_TZ = 'Europe/Warsaw';

export function getTodayWarsaw(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: WARSAW_TZ });
}

export function formatWarsawDate(date: Date | string | number): string {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: WARSAW_TZ });
}
