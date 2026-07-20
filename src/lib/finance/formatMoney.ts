export function formatPln(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatMonths(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 mies.';
  if (value < 12) return `${value.toFixed(1)} mies.`;
  const years = value / 12;
  return `${years.toFixed(1)} lat`;
}

export function formatYears(value: number | null): string {
  if (value == null) return '—';
  if (value < 1) return `${Math.round(value * 12)} mies.`;
  return `${value.toFixed(1)} lat`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}
