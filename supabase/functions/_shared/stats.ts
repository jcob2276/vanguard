export * from '@vanguard/domain';

export function zScore(value: number | null, mean: number, stdDev: number): number {
  if (value == null || stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}
