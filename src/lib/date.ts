const WARSAW_TZ = 'Europe/Warsaw';

export function getTodayWarsaw(): string {
  return formatWarsawDate(new Date());
}

export function formatWarsawDate(date: Date | string | number): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: WARSAW_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Ignore formatting error and fallback
  }

  try {
    const raw = new Date(date).toLocaleDateString('en-CA', { timeZone: WARSAW_TZ });
    return raw.replace(/[^\d-/]/g, '').replace(/\//g, '-');
  } catch (e) {
    return '';
  }
}
