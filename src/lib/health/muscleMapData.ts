import type { IExerciseData, Muscle } from 'react-body-highlighter';

/** Mapowanie tagów Vanguard → mięśnie react-body-highlighter (widok przód/tył). */
const ANTERIOR: Record<string, Muscle[]> = {
  klatka: ['chest'],
  plecy: ['upper-back'],
  barki: ['front-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  przedramiona: ['forearm'],
  brzuch: ['abs', 'obliques'],
  czworogłowe: ['quadriceps'],
  'dwugłowe ud': ['hamstring'],
  pośladki: ['gluteal'],
  łydki: ['calves'],
  plyo: ['quadriceps', 'calves'],
};

const POSTERIOR: Record<string, Muscle[]> = {
  klatka: ['trapezius'],
  plecy: ['upper-back', 'lower-back', 'trapezius'],
  barki: ['back-deltoids', 'trapezius'],
  biceps: ['forearm'],
  triceps: ['triceps'],
  przedramiona: ['forearm'],
  brzuch: ['lower-back'],
  czworogłowe: ['hamstring', 'gluteal'],
  'dwugłowe ud': ['hamstring'],
  pośladki: ['gluteal'],
  łydki: ['calves'],
  plyo: ['calves', 'gluteal'],
};

export const HEAT_SCALE = [
  'var(--color-theme-hex-164e63)',
  'var(--color-theme-hex-0e7490)',
  'var(--color-theme-hex-0891b2)',
  'var(--color-theme-hex-06b6d4)',
  'var(--color-theme-hex-22d3ee-coll-2)',
  'var(--color-theme-hex-2dd4bf-coll-2)',
  'var(--color-theme-hex-34d399)',
  'var(--color-theme-hex-4ade80-coll-2)',
  'var(--color-theme-hex-38bdf8)',
  'var(--color-theme-hex-7dd3fc)',
] as const;

export const BODY_BASE = 'var(--color-theme-hex-ba148163184022)';

function tagToRbMuscles(tag: string, view: 'anterior' | 'posterior'): Muscle[] {
  const map = view === 'anterior' ? ANTERIOR : POSTERIOR;
  return map[tag] ?? [];
}

export function buildHighlighterData(
  loadByTag: Record<string, number>,
  view: 'anterior' | 'posterior',
): IExerciseData[] {
  return Object.entries(loadByTag)
    .filter(([, load]) => load > 0)
    .flatMap(([tag, load]) => {
      const muscles = tagToRbMuscles(tag, view);
      if (!muscles.length) return [];
      return [{
        name: tag,
        muscles,
        frequency: Math.max(1, Math.min(HEAT_SCALE.length, Math.round(load))),
      }];
    });
}

/** Klik na SVG → tagi Vanguard (PL). */
export const RB_MUSCLE_TO_TAGS: Partial<Record<Muscle, string[]>> = {
  chest: ['klatka'],
  'upper-back': ['plecy'],
  'lower-back': ['plecy'],
  trapezius: ['plecy', 'barki'],
  'front-deltoids': ['barki'],
  'back-deltoids': ['barki'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearm: ['przedramiona'],
  abs: ['brzuch'],
  obliques: ['brzuch'],
  quadriceps: ['czworogłowe'],
  hamstring: ['dwugłowe ud'],
  gluteal: ['pośladki'],
  calves: ['łydki'],
};
