/**
 * Marker bridge + optimal ranges adapted from getbased (AGPL-3.0).
 * @see https://github.com/elkimek/get-based
 */

export type OptimalRange = {
  optimalMin: number | null;
  optimalMax: number | null;
};

export type MarkerBridgeEntry = {
  path: string;
  canonicalUnit: string;
  toCanonical: (value: number, unit: string | null) => number;
};

const byFactor = (factor: number) => (v: number) => v / factor;

/** Vanguard `medical_lab_results.marker_key` → getbased dot path + unit normalization */
export const VANGUARD_MARKER_BRIDGE: Record<string, MarkerBridgeEntry> = {
  glucose: {
    path: 'biochemistry.glucose',
    canonicalUnit: 'mmol/l',
    toCanonical: byFactor(18.018),
  },
  testosterone_total: {
    path: 'hormones.testosterone',
    canonicalUnit: 'nmol/l',
    toCanonical: (v, unit) => {
      const u = (unit || '').toLowerCase();
      if (u.includes('ng/ml')) return (v * 100) / 28.818;
      if (u.includes('ng/dl')) return v / 28.818;
      return v;
    },
  },
  ferritin: {
    path: 'iron.ferritin',
    canonicalUnit: 'µg/l',
    toCanonical: (v) => v,
  },
  cholesterol_total: {
    path: 'lipids.cholesterol',
    canonicalUnit: 'mmol/l',
    toCanonical: byFactor(38.67),
  },
  triglycerides: {
    path: 'lipids.triglycerides',
    canonicalUnit: 'mmol/l',
    toCanonical: byFactor(88.57),
  },
  hdl_cholesterol: {
    path: 'lipids.hdl',
    canonicalUnit: 'mmol/l',
    toCanonical: byFactor(38.67),
  },
  ldl_cholesterol_calculated: {
    path: 'lipids.ldl',
    canonicalUnit: 'mmol/l',
    toCanonical: byFactor(38.67),
  },
  non_hdl_cholesterol: {
    path: 'lipids.nonHdl',
    canonicalUnit: 'mmol/l',
    toCanonical: byFactor(38.67),
  },
  magnesium_serum: {
    path: 'electrolytes.magnesium',
    canonicalUnit: 'mmol/l',
    toCanonical: byFactor(2.431),
  },
  tsh: {
    path: 'thyroid.tsh',
    canonicalUnit: 'mU/l',
    toCanonical: (v) => v,
  },
  vitamin_d_25oh: {
    path: 'vitamins.vitaminD',
    canonicalUnit: 'nmol/l',
    toCanonical: byFactor(0.4006),
  },
  hemoglobin: {
    path: 'hematology.hemoglobin',
    canonicalUnit: 'g/l',
    toCanonical: byFactor(0.1),
  },
  mcv: {
    path: 'hematology.mcv',
    canonicalUnit: 'fL',
    toCanonical: (v) => v,
  },
  mch: {
    path: 'hematology.mch',
    canonicalUnit: 'pg',
    toCanonical: (v) => v,
  },
};

/** Subset of getbased OPTIMAL_RANGES (male defaults) for bridged markers */
export const GETBASED_OPTIMAL: Record<string, OptimalRange> = {
  'biochemistry.glucose': { optimalMin: 4.0, optimalMax: 5.0 },
  'hormones.testosterone': { optimalMin: 15.0, optimalMax: 25.0 },
  'iron.ferritin': { optimalMin: 40, optimalMax: 200 },
  'lipids.cholesterol': { optimalMin: 3.9, optimalMax: 5.2 },
  'lipids.triglycerides': { optimalMin: 0.45, optimalMax: 1.0 },
  'lipids.hdl': { optimalMin: 1.5, optimalMax: 2.1 },
  'lipids.ldl': { optimalMin: 1.2, optimalMax: 2.6 },
  'lipids.nonHdl': { optimalMin: 1.8, optimalMax: 2.6 },
  'electrolytes.magnesium': { optimalMin: 0.85, optimalMax: 0.95 },
  'thyroid.tsh': { optimalMin: 1.0, optimalMax: 2.5 },
  'vitamins.vitaminD': { optimalMin: 100.0, optimalMax: 200.0 },
  'hematology.hemoglobin': { optimalMin: 140, optimalMax: 170 },
  'hematology.mcv': { optimalMin: 85, optimalMax: 92 },
};

export function bridgeForMarkerKey(markerKey: string): MarkerBridgeEntry | null {
  return VANGUARD_MARKER_BRIDGE[markerKey] ?? null;
}

export function optimalForMarkerKey(markerKey: string): OptimalRange | null {
  const bridge = bridgeForMarkerKey(markerKey);
  if (!bridge) return null;
  return GETBASED_OPTIMAL[bridge.path] ?? null;
}

export function toCanonicalValue(markerKey: string, value: number, unit: string | null): number | null {
  const bridge = bridgeForMarkerKey(markerKey);
  if (!bridge) return null;
  return bridge.toCanonical(value, unit);
}

export type OptimalStatus = 'in' | 'below' | 'above' | 'unknown';

export function optimalStatus(markerKey: string, value: number, unit: string | null): OptimalStatus {
  const opt = optimalForMarkerKey(markerKey);
  const bridge = bridgeForMarkerKey(markerKey);
  if (!opt || !bridge) return 'unknown';
  const cv = bridge.toCanonical(value, unit);
  if (opt.optimalMin != null && cv < opt.optimalMin) return 'below';
  if (opt.optimalMax != null && cv > opt.optimalMax) return 'above';
  if (opt.optimalMin != null || opt.optimalMax != null) return 'in';
  return 'unknown';
}

export function formatOptimalRange(markerKey: string): string | null {
  const opt = optimalForMarkerKey(markerKey);
  const bridge = bridgeForMarkerKey(markerKey);
  if (!opt || !bridge) return null;
  const { optimalMin, optimalMax } = opt;
  const u = bridge.canonicalUnit;
  if (optimalMin != null && optimalMax != null) return `${optimalMin}–${optimalMax} ${u}`;
  if (optimalMin != null) return `≥ ${optimalMin} ${u}`;
  if (optimalMax != null) return `≤ ${optimalMax} ${u}`;
  return null;
}
