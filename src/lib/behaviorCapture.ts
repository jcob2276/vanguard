/** Kanoniczna mapa: co logować gdzie (SSOT dla UI i agentów). */

export type BehaviorCaptureStore =
  | 'vanguard_stream'
  | 'habit_logs'
  | 'workout_sessions'
  | 'behavior_log'
  | 'daily_food_entries'
  | 'supplement_logs'
  | 'derived';

export type BehaviorCaptureEntry = {
  id: string;
  label: string;
  store: BehaviorCaptureStore;
  logVia: string;
  usedBy: string;
  note?: string;
  deprecated?: boolean;
};

export const BEHAVIOR_CAPTURE_ENTRIES: BehaviorCaptureEntry[] = [
  {
    id: 'stream_free',
    label: 'Dowolny opis dnia, tarcie, kontekst',
    store: 'vanguard_stream',
    logVia: 'Telegram (wiadomość), głos, BlockTimer, PowerList ✓',
    usedBy: 'friction_events (auto-classify), Oracle, reconciliation',
  },
  {
    id: 'habits_custom',
    label: 'Nawyki dzienne (w tym Lenie)',
    store: 'habit_logs',
    logVia: 'Desktop → Nawyki, Telegram `/lenie`',
    usedBy: 'Regularność (fitness), /korealcje, panel Lenie',
    note: 'Lenie = ten sam nawyk „unikać” w habits/habit_logs — nie osobna tabela.',
  },
  {
    id: 'training',
    label: 'Trening siłowy / cardio ręczne',
    store: 'workout_sessions',
    logVia: 'App → Zaloguj trening (T), quick capture',
    usedBy: 'Strain, fitness (siła, obciążenie), heatmapa',
  },
  {
    id: 'wellness',
    label: 'Sauna, lodowata, stretching',
    store: 'workout_sessions',
    logVia: 'App → Sauna / wellness w loggerze',
    usedBy: 'Regeneracja (fitness), strain wellness, korelacje',
    note: 'Nie behavior_log — sesja wellness w exercise_logs.',
  },
  {
    id: 'confounders',
    label: 'Alkohol, stres, choroba, podróż',
    store: 'behavior_log',
    logVia: 'Desktop → Sygnały dnia (poniżej)',
    usedBy: 'Illness signal, strain override, /korealcje, behavior-effects',
  },
  {
    id: 'food',
    label: 'Posiłki, kawa, makra',
    store: 'daily_food_entries',
    logVia: 'App → Posiłki, Telegram posiłek',
    usedBy: 'Strain (fueling), korelacje kofeiny/snu',
  },
  {
    id: 'supplements',
    label: 'Suplementy',
    store: 'supplement_logs',
    logVia: 'Telegram `/sup`',
    usedBy: 'Korelacje suplementów',
  },
  {
    id: 'friction',
    label: 'Friction / wzorce',
    store: 'derived',
    logVia: 'Nie loguj ręcznie',
    usedBy: 'Analityka — powstaje ze streamu przez auto-classify',
    note: 'Potwierdzaj w review friction, nie twórz równoległego wpisu.',
  },
  {
    id: 'daily_habits_legacy',
    label: 'daily_habits (stretch, protein_170g…)',
    store: 'derived',
    logVia: 'Brak UI — legacy',
    usedBy: 'Tylko stare dane w korelacjach',
    deprecated: true,
    note: 'Nowe nawyki → habits/habit_logs. Nie używaj daily_habits.',
  },
];

/** Confoundery zapisywane w behavior_log — klucze zgodne z correlationSeries / illness. */
export const BEHAVIOR_CONFOUNDERS = [
  { key: 'alkohol', label: 'Alkohol', icon: '🍺' },
  { key: 'stres', label: 'Stres', icon: '⚡' },
  { key: 'choroba', label: 'Choroba / infekcja', icon: '🤒' },
  { key: 'podroz', label: 'Podróż / zmiana strefy', icon: '✈️' },
] as const;

export type BehaviorConfounderKey = (typeof BEHAVIOR_CONFOUNDERS)[number]['key'];

export function storeLabel(store: BehaviorCaptureStore): string {
  switch (store) {
    case 'vanguard_stream':
      return 'stream';
    case 'habit_logs':
      return 'habit_logs';
    case 'workout_sessions':
      return 'workout_sessions';
    case 'behavior_log':
      return 'behavior_log';
    case 'daily_food_entries':
      return 'posiłki';
    case 'supplement_logs':
      return 'suplementy';
    default:
      return 'pochodne';
  }
}
