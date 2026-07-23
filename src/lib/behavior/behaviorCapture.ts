/** Confounders stored in behavior_log; keys match correlationSeries and illness analysis. */
export const BEHAVIOR_CONFOUNDERS = [
  { key: 'alkohol', label: 'Alkohol', icon: '🍺' },
  { key: 'stres', label: 'Stres', icon: '⚡' },
  { key: 'choroba', label: 'Choroba / infekcja', icon: '🤒' },
  { key: 'podroz', label: 'Podróż / zmiana strefy', icon: '✈️' },
] as const;

export type BehaviorConfounderKey = (typeof BEHAVIOR_CONFOUNDERS)[number]['key'];
