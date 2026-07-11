import { clamp } from './baselines.ts';

const LEG_KW = ['przysiad', 'martwy', 'rdl', 'nog', 'leg', 'łydk', 'lydk', 'hip thrust', 'wykrok', 'lunge', 'calf', 'udo'];
const CNS_KW = ['martwy', 'przysiad', 'ohp', 'bench', 'wyciskanie', 'dip'];
const WELLNESS_KW = ['sauna', 'lodowata', 'zimny prysznic', 'cold', 'ice'];

const matches = (name: string, kws: string[]) => {
  const n = (name || '').toLowerCase();
  return kws.some((k) => n.includes(k));
};

interface OuraZonesData {
  z1_regen_min: number | null;
  z2_tlenowa_min: number | null;
  z3_tempo_min: number | null;
  z4_prog_min: number | null;
  z5_max_min: number | null;
}

interface StravaActivityData {
  perceived_exertion: number | null;
  has_pr: boolean | null;
}

interface ExerciseLogData {
  exercise_name: string;
  rpe: number | null;
  rir: number | null;
  reps: number | null;
}

export interface StrainInput {
  z: OuraZonesData | null;
  runs: StravaActivityData[];
  wsets: ExerciseLogData[];
  steps: number | null;
  kcal: number | null;
  carbs: number | null;
  protein: number | null;
  fuelingProvisional: boolean;
  weight: number;
}

export interface StrainResult {
  cardioRaw: number;
  maxRpe: number;
  hasPr: boolean;
  isRunDay: boolean;
  strengthPts: number;
  legPts: number;
  cnsPts: number;
  wellnessPts: number;
  stepsLoad: number;
  fuelingPenalty: number;
  fuelingScore: number | null;
  rawTotal: number;
  strain: number | null;
  strainConfidence: 'calibrating' | 'building' | 'solid';
}

export function computeStrainScore(input: StrainInput): StrainResult {
  const { z, runs, wsets, steps, kcal, carbs, protein, fuelingProvisional, weight } = input;

  // ── CARDIO LOAD (TRIMP-style ze stref Oura + bonus Strava) ──
  let cardioRaw = 0;
  if (z) {
    cardioRaw =
      (z.z1_regen_min || 0) * 0.5 +
      (z.z2_tlenowa_min || 0) * 1.0 +
      (z.z3_tempo_min || 0) * 2.0 +
      (z.z4_prog_min || 0) * 4.0 +
      (z.z5_max_min || 0) * 6.0;
  }
  const maxRpe = runs.reduce((m: number, r) => Math.max(m, r.perceived_exertion || 0), 0);
  const rpeBonus = maxRpe >= 8 ? 30 : maxRpe >= 6 ? 15 : 0;
  const prBonus = runs.some((r) => r.has_pr) ? 20 : 0;
  const isRunDay = runs.length > 0;
  cardioRaw += rpeBonus + prBonus;

  // ── STRENGTH LOAD ──
  let strengthPts = 0;
  let legPts = 0;
  let cnsPts = 0;
  let wellnessPts = 0;

  for (const set of wsets) {
    if (matches(set.exercise_name, WELLNESS_KW)) {
      // reps = minuty, weight = °C — 1.5 pkt/min, max 25 pkt per set
      wellnessPts += Math.min((set.reps || 0) * 1.5, 25);
      continue;
    }
    const isLeg = matches(set.exercise_name, LEG_KW);
    const isCns = matches(set.exercise_name, CNS_KW);
    const setRir = set.rir ?? set.rpe;
    const nearFailure = setRir != null && Number(setRir) <= 1;
    const pts = 3 + (isLeg ? 2 : 0) + (isCns ? 2 : 0) + (nearFailure ? 2 : 0);
    strengthPts += pts;
    if (isLeg) legPts += pts;
    if (isCns) cnsPts += pts;
  }

  // ── STEPS LOAD ──
  const stepsLoad = steps != null ? Math.min(steps / 500, 45) : 0;

  // ── FUELING ──
  const hadLoad = cardioRaw > 80 || strengthPts > 30;

  let fuelingPenalty = 0;
  // Dzień trwa — nie karzemy strain za "niedожywienie" jeszcze niezamkniętego dnia.
  if (hadLoad && !fuelingProvisional) {
    if (kcal != null) {
      if (kcal < 1600) fuelingPenalty += 30;
      else if (kcal < 2000) fuelingPenalty += 15;
    }
    if (isRunDay && carbs != null && carbs < 150) fuelingPenalty += 15;
    if (protein != null && protein / weight < 1.6) fuelingPenalty += 10;
  }

  let fuelingScore: number | null = null;
  if (kcal != null) {
    const tgtKcal = hadLoad ? 2600 : 2200;
    const tgtCarbs = hadLoad ? 225 : 150;
    const tgtProtein = weight * 1.8;
    const pPart = clamp((protein || 0) / tgtProtein, 0, 1) * 40;
    const cPart = clamp((carbs || 0) / tgtCarbs, 0, 1) * 30;
    const kPart = clamp(kcal / tgtKcal, 0, 1) * 30;
    fuelingScore = Math.round(pPart + cPart + kPart);
  }

  // ── STRAIN 0–21 (log-kompresja) ──
  const mentalPts = 0;
  const rawTotal = cardioRaw + strengthPts + wellnessPts + stepsLoad + fuelingPenalty + mentalPts;
  const hasAnyLoad = rawTotal > 0 || z != null;
  const strain = hasAnyLoad ? Math.round(21 * (1 - Math.exp(-rawTotal / 156)) * 10) / 10 : null;

  // Effort: solid wymaga realnych danych ze stref HR LUB zalogowanego treningu siłowego tego dnia.
  const hasZoneData =
    z != null &&
    (z.z1_regen_min != null ||
      z.z2_tlenowa_min != null ||
      z.z3_tempo_min != null ||
      z.z4_prog_min != null ||
      z.z5_max_min != null);

  const strainConfidence: 'calibrating' | 'building' | 'solid' =
    strain === null ? 'calibrating' : hasZoneData || wsets.length > 0 ? 'solid' : 'building';

  return {
    cardioRaw,
    maxRpe,
    hasPr: prBonus > 0,
    isRunDay,
    strengthPts,
    legPts,
    cnsPts,
    wellnessPts,
    stepsLoad,
    fuelingPenalty,
    fuelingScore,
    rawTotal,
    strain,
    strainConfidence,
  };
}
