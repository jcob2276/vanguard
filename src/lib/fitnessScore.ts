/** Hybrydowy fitness score — maxy z decay + metryki ciała względem profilu użytkownika. */

export function epley1rm(weight: number, reps: number): number | null {
  if (!weight || weight <= 0 || !reps || reps <= 0) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Pełna waga do ~18 mies., potem liniowy spadek; po 36 mies. PR nie liczy się. */
export function prDecayWeight(daysAgo: number): number {
  if (daysAgo < 0 || !Number.isFinite(daysAgo)) return 0;
  if (daysAgo <= 548) return 1; // ~18 mies.
  if (daysAgo >= 1095) return 0; // 3 lata — poza oknem
  return Math.max(0, 1 - (daysAgo - 548) / (1095 - 548));
}

type SessionLike = {
  date: string;
  exercise_logs?: Array<{
    exercise_name?: string | null;
    weight?: number | null;
    reps?: number | null;
    muscle_tags?: string[] | null;
  }> | null;
};

export type DecayedLiftPR = {
  label: string;
  kg: number;
  rawKg: number;
  date: string;
  daysAgo: number;
  decay: number;
};

const BENCH_PATTERNS = [/wycisk/i, /\bbench\b/i];
const SQUAT_PATTERNS = [/przysiad/i, /\bsquat\b/i, /leg press/i];
const DEAD_PATTERNS = [/martwy/i, /\bdeadlift\b/i, /\brdl\b/i, /rumun/i];

function isBenchName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes('wąsk') || n.includes('wask') || n.includes('close-grip')) return false;
  if (n.includes('wycisk')) return true;
  return /\bbench\b/.test(n);
}

function matchesLift(name: string, patterns: RegExp[], kind?: 'bench'): boolean {
  const n = name.toLowerCase();
  if (n.includes('sauna') || n.includes('lodowata')) return false;
  if (kind === 'bench') return isBenchName(name);
  return patterns.some((p) => p.test(n));
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function bestFromSessions(
  sessions: SessionLike[],
  patterns: RegExp[],
  label: string,
  today: string,
): DecayedLiftPR | null {
  let best: DecayedLiftPR | null = null;

  for (const session of sessions) {
    for (const log of session.exercise_logs ?? []) {
      const name = log.exercise_name || '';
      if (!matchesLift(name, patterns, label === 'wycisk' ? 'bench' : undefined)) continue;
      const w = Number(log.weight);
      const r = Number(log.reps);
      if (!w || w <= 0 || !r || r <= 0) continue;
      const est = r <= 5 ? w : (epley1rm(w, r) ?? w);
      const daysAgo = daysBetween(session.date, today);
      const decay = prDecayWeight(daysAgo);
      if (decay <= 0) continue;
      const effective = est * decay;
      if (!best || effective > best.kg) {
        best = { label, kg: effective, rawKg: est, date: session.date, daysAgo, decay };
      }
    }
  }
  return best;
}

export function extractLiftPRs(sessions: SessionLike[], today: string) {
  const nonWellness = sessions.filter(
    (s) => !(s.exercise_logs ?? []).every((l) => (l.muscle_tags ?? []).includes('wellness')),
  );
  return {
    bench: bestFromSessions(nonWellness, BENCH_PATTERNS, 'wycisk', today),
    squat: bestFromSessions(nonWellness, SQUAT_PATTERNS, 'przysiad', today),
    deadlift: bestFromSessions(nonWellness, DEAD_PATTERNS, 'martwy', today),
  };
}

/** Mapa ratio względem masy ciała → 0–10 (względem siebie + typowe widełki hybrydy). */
function ratioToPoints(ratio: number, low: number, mid: number, high: number): number {
  if (ratio <= 0) return 0;
  if (ratio <= low) return Math.max(1, (ratio / low) * 4);
  if (ratio <= mid) return 4 + ((ratio - low) / (mid - low)) * 3;
  if (ratio <= high) return 7 + ((ratio - mid) / (high - mid)) * 2.5;
  return Math.min(10, 9.5 + (ratio - high) * 0.5);
}

export function strengthCapacityScore(
  prs: ReturnType<typeof extractLiftPRs>,
  bodyWeightKg: number | null,
): { score: number; detail: string } {
  if (!bodyWeightKg || bodyWeightKg <= 0) {
    const any = [prs.bench, prs.squat, prs.deadlift].filter(Boolean) as DecayedLiftPR[];
    if (!any.length) return { score: 0, detail: 'Brak zarejestrowanych maxów siłowych.' };
    const avgKg = any.reduce((s, p) => s + p.kg, 0) / any.length;
    const score = Math.min(10, Math.max(1, avgKg / 12));
    return {
      score: Math.round(score * 10) / 10,
      detail: `Maxy (z decay): ${any.map((p) => `${p.label} ${p.rawKg.toFixed(0)} kg`).join(', ')} — brak masy ciała do ratio.`,
    };
  }

  const parts: string[] = [];
  const ratios: number[] = [];
  if (prs.bench) {
    ratios.push(ratioToPoints(prs.bench.kg / bodyWeightKg, 0.75, 1.0, 1.3));
    parts.push(
      `wycisk ${prs.bench.rawKg.toFixed(0)} kg (${(prs.bench.kg / bodyWeightKg).toFixed(2)}×BW${prs.bench.decay < 1 ? `, decay ${Math.round(prs.bench.decay * 100)}%` : ''})`,
    );
  }
  if (prs.squat) {
    ratios.push(ratioToPoints(prs.squat.kg / bodyWeightKg, 1.0, 1.5, 2.0));
    parts.push(`przysiad ${prs.squat.rawKg.toFixed(0)} kg (${(prs.squat.kg / bodyWeightKg).toFixed(2)}×BW)`);
  }
  if (prs.deadlift) {
    ratios.push(ratioToPoints(prs.deadlift.kg / bodyWeightKg, 1.2, 1.8, 2.4));
    parts.push(`martwy ${prs.deadlift.rawKg.toFixed(0)} kg (${(prs.deadlift.kg / bodyWeightKg).toFixed(2)}×BW)`);
  }

  if (!ratios.length) {
    return { score: 0, detail: 'Brak maxów w logu (wycisk / przysiad / martwy).' };
  }

  const score = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 10) / 10;
  const total = [prs.bench, prs.squat, prs.deadlift]
    .filter(Boolean)
    .reduce((s, p) => s + (p as DecayedLiftPR).kg, 0);
  const totalRatio = total / bodyWeightKg;
  parts.push(`trójbój ~${total.toFixed(0)} kg (${totalRatio.toFixed(2)}×BW z decay)`);

  return {
    score: Math.min(10, Math.max(1, score)),
    detail: parts.join(' · ') + '. PR starsze niż ~3 lata nie wchodzą.',
  };
}

export function cooperBestKm(strava: Array<{ best_efforts?: unknown; distance?: number; moving_time?: number; sport_type?: string }>): number | null {
  let best: number | null = null;
  for (const a of strava) {
    const efforts = (a.best_efforts ?? []) as Array<{ name?: string; distance?: number }>;
    for (const e of efforts) {
      const name = (e.name || '').toLowerCase();
      if (name.includes('cooper') || name.includes('12 min') || name.includes('12min')) {
        const km = (e.distance || 0) / 1000;
        if (km > 0 && (best == null || km > best)) best = km;
      }
    }
    const sport = a.sport_type || '';
    if (['Run', 'TrailRun', 'VirtualRun'].includes(sport)) {
      const min = (a.moving_time || 0) / 60;
      if (min >= 11.5 && min <= 12.5 && a.distance) {
        const km = a.distance / 1000;
        if (km > 0 && (best == null || km > best)) best = km;
      }
    }
  }
  return best != null ? Math.round(best * 100) / 100 : null;
}

export function cooperToPoints(km: number | null): { score: number; detail: string } {
  if (km == null || km <= 0) {
    return { score: 0, detail: 'Brak testu Coopera / 12 min w Strava.' };
  }
  const score = Math.min(10, Math.max(1, 2 + km * 2.8));
  return {
    score: Math.round(score * 10) / 10,
    detail: `Cooper / 12 min: ${km.toFixed(2)} km → ${score.toFixed(1)} pkt (2,0 km ≈ 4/10, 2,6 km ≈ 7/10).`,
  };
}

export type BodyRow = {
  date?: string;
  weight?: number | null;
  waist?: number | null;
  neck?: number | null;
  hips?: number | null;
  body_fat?: number | null;
};

function navyBf(waistCm: number, neckCm: number, heightCm: number): number | null {
  const diff = waistCm - neckCm;
  if (diff <= 0 || heightCm <= 0) return null;
  const bf = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
  if (!Number.isFinite(bf)) return null;
  return Math.max(3, Math.min(50, Math.round(bf * 10) / 10));
}

export function bodyCompositionBonus(body: BodyRow[], heightCm: number | null): { score: number; detail: string } {
  const latest = [...body].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))[0] as
    | (BodyRow & { date?: string })
    | undefined;
  if (!latest?.weight || !heightCm) {
    return { score: 0, detail: 'Brak masy ciała / wzrostu do BMI i BF%.' };
  }

  const w = latest.weight;
  const bmi = w / Math.pow(heightCm / 100, 2);
  const waist = latest.waist ?? null;
  const neck = latest.neck ?? null;
  const hips = latest.hips ?? null;
  const whr = waist && hips ? waist / hips : null;
  const bf = waist && neck ? navyBf(waist, neck, heightCm) : latest.body_fat ?? null;

  let pts = 0;
  const parts: string[] = [];

  if (bmi >= 20 && bmi <= 25) {
    pts += 2;
    parts.push(`BMI ${bmi.toFixed(1)} OK`);
  } else if (bmi >= 18.5 && bmi < 20) {
    pts += 1.2;
    parts.push(`BMI ${bmi.toFixed(1)} lekko nisko`);
  } else if (bmi > 25 && bmi <= 28) {
    pts += 1;
    parts.push(`BMI ${bmi.toFixed(1)} podwyższone`);
  } else {
    parts.push(`BMI ${bmi.toFixed(1)}`);
  }

  if (whr != null) {
    if (whr < 0.9) {
      pts += 1.5;
      parts.push(`WHR ${whr.toFixed(2)} OK`);
    } else {
      pts += 0.5;
      parts.push(`WHR ${whr.toFixed(2)}`);
    }
  }

  if (bf != null) {
    if (bf <= 15) {
      pts += 2;
      parts.push(`BF ~${bf}% athletic`);
    } else if (bf <= 20) {
      pts += 1.5;
      parts.push(`BF ~${bf}%`);
    } else if (bf <= 25) {
      pts += 0.8;
      parts.push(`BF ~${bf}%`);
    } else {
      parts.push(`BF ~${bf}%`);
    }
  }

  return {
    score: Math.min(4, Math.round(pts * 10) / 10),
    detail: parts.join(' · '),
  };
}
