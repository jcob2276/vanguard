import type { Prediction } from '../../../lib/predictionsApi';

export function formatStreamEntryDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function calculateMae(preds: Prediction[], multiplier = 1): string | null {
  if (preds.length === 0) return null;
  const errorSum = preds.reduce((acc, p) => acc + (p.error_value || 0), 0);
  return (errorSum / preds.length * multiplier).toFixed(multiplier === 100 ? 0 : 1);
}

export function calculateBrier(preds: Prediction[]): string | null {
  if (preds.length === 0) return null;
  const errorSum = preds.reduce((acc, p) => acc + (p.error_value || 0), 0);
  return (errorSum / preds.length).toFixed(2);
}
