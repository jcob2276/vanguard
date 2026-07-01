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
  '#164e63',
  '#0e7490',
  '#0891b2',
  '#06b6d4',
  '#22d3ee',
  '#2dd4bf',
  '#34d399',
  '#4ade80',
  '#38bdf8',
  '#7dd3fc',
] as const;

export const BODY_BASE = 'rgba(148, 163, 184, 0.22)';

export function tagToRbMuscles(tag: string, view: 'anterior' | 'posterior'): Muscle[] {
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
