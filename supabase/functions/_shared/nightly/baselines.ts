export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export const sampleSD = (xs: number[]): number | null => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  if (m == null) return null;
  const ss = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0);
  return Math.sqrt(ss / (xs.length - 1));
};

/**
 * Winsorized EWMA baseline (Baselines.swift)
 * halfLifeB=14 nights for center, halfLifeS=21 for spread.
 * Hard-rejects values >5σ from baseline (post-seed), Winsorizes at ±3σ.
 */
export function ewmaBaseline(
  values: number[],
  minVal: number,
  maxVal: number,
  floorSpread: number,
  halfLifeB = 14,
  halfLifeS = 21
): { center: number; spread: number; nValid: number } | null {
  const lb = 1 - Math.pow(0.5, 1 / halfLifeB);
  const ls = 1 - Math.pow(0.5, 1 / halfLifeS);
  const WINSOR_K = 3.0;
  const HARD_K = 5.0;
  const MIN_SEED = 4;
  let center: number | null = null;
  let spread = floorSpread;
  let nValid = 0;

  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    if (v < minVal || v > maxVal) continue;
    if (center === null) {
      center = v;
      nValid = 1;
      continue;
    }
    if (nValid >= MIN_SEED && Math.abs(v - center) > HARD_K * spread) continue;
    const clamped = Math.max(center - WINSOR_K * spread, Math.min(center + WINSOR_K * spread, v));
    center = lb * clamped + (1 - lb) * center;
    spread = Math.max(floorSpread, ls * Math.abs(v - center) + (1 - ls) * spread);
    nValid++;
  }
  return center !== null ? { center, spread, nValid } : null;
}
