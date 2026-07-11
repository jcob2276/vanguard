export function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l')
    .replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z');
}

export const EXERCISES = [
  // Klatka
  { name: 'Wyciskanie sztangi na ławce', tags: ['klatka', 'triceps', 'barki'] },
  { name: 'Wyciskanie płaskie', tags: ['klatka', 'triceps', 'barki'] },
  { name: 'Wyciskanie hantli na ławce', tags: ['klatka', 'triceps', 'barki'] },
  { name: 'Wyciskanie na skosie', tags: ['klatka', 'barki'] },
  { name: 'Wyciskanie skośne', tags: ['klatka', 'barki'] },
  { name: 'Rozpiętki', tags: ['klatka'] },
  { name: 'Pompki', tags: ['klatka', 'triceps'] },
  { name: 'Dipy', tags: ['triceps', 'klatka'] },
  { name: 'Cable crossover', tags: ['klatka'] },
  // Plecy
  { name: 'Martwy ciąg', tags: ['dwugłowe ud', 'pośladki', 'plecy'] },
  { name: 'Martwy ciąg rumuński', tags: ['dwugłowe ud', 'pośladki', 'plecy'] },
  { name: 'RDL', tags: ['dwugłowe ud', 'pośladki', 'plecy'] },
  { name: 'Podciąganie nachwytem', tags: ['plecy', 'biceps'] },
  { name: 'Podciąganie podchwytem', tags: ['biceps', 'plecy'] },
  { name: 'Lat Pulldown', tags: ['plecy', 'biceps'] },
  { name: 'Wiosłowanie sztangą', tags: ['plecy', 'biceps'] },
  { name: 'Wiosłowanie hantlem', tags: ['plecy', 'biceps'] },
  { name: 'Wiosłowanie jedną ręką', tags: ['plecy', 'biceps'] },
  { name: 'Ściąganie drążka', tags: ['plecy', 'biceps'] },
  { name: 'Face pull', tags: ['plecy', 'barki'] },
  { name: 'Odwrotne rozpiętki', tags: ['barki'] },
  { name: 'Leaning cable lateral raise', tags: ['barki'] },
  { name: 'Wznosy bokiem dropset', tags: ['barki'] },
  { name: 'Seal row', tags: ['plecy'] },
  { name: 'Chest-supported row', tags: ['plecy', 'biceps'] },
  // Barki
  { name: 'OHP sztangą', tags: ['barki', 'triceps'] },
  { name: 'OHP hantlami', tags: ['barki', 'triceps'] },
  { name: 'Unoszenie boczne', tags: ['barki'] },
  { name: 'Unoszenie przednie', tags: ['barki'] },
  { name: 'Arnold press', tags: ['barki'] },
  // Biceps
  { name: 'Uginanie ze sztangą', tags: ['biceps', 'przedramiona'] },
  { name: 'Uginanie sztangi stojąc', tags: ['biceps'] },
  { name: 'Uginanie z hantlami', tags: ['biceps'] },
  { name: 'Uginanie hantli (ławka skośna)', tags: ['biceps'] },
  { name: 'Uginanie młotkowe', tags: ['biceps', 'przedramiona'] },
  { name: 'Uginanie na modlitewniku', tags: ['biceps'] },
  { name: 'Uginanie na lince', tags: ['biceps'] },
  // Triceps
  { name: 'Wyciskanie wąskim chwytem', tags: ['triceps', 'klatka'] },
  { name: 'Pushdown na lince', tags: ['triceps'] },
  { name: 'French press', tags: ['triceps'] },
  { name: 'Skull crushers', tags: ['triceps'] },
  { name: 'Overhead triceps extension', tags: ['triceps'] },
  { name: 'Overh. triceps ext. (linka)', tags: ['triceps'] },
  { name: 'Prostowanie łokci (wyciąg)', tags: ['triceps'] },
  // Nogi
  { name: 'Przysiad ze sztangą', tags: ['czworogłowe', 'pośladki', 'dwugłowe ud'] },
  { name: 'Bułgarski przysiad', tags: ['czworogłowe', 'pośladki'] },
  { name: 'Hack squat', tags: ['czworogłowe'] },
  { name: 'Leg press', tags: ['czworogłowe', 'pośladki'] },
  { name: 'Wykroki', tags: ['czworogłowe', 'pośladki'] },
  { name: 'Prostowanie nóg', tags: ['czworogłowe'] },
  { name: 'Zginanie nóg', tags: ['dwugłowe ud'] },
  { name: 'Leg Curl', tags: ['dwugłowe ud'] },
  { name: 'Hip thrust', tags: ['pośladki', 'dwugłowe ud'] },
  { name: 'Wspięcia na łydki', tags: ['łydki'] },
  { name: 'Wspięcia na palce', tags: ['łydki'] },
  { name: 'Good morning', tags: ['dwugłowe ud', 'pośladki', 'plecy'] },
  // Plajometria / moc reaktywna (pod biegacza)
  { name: 'Box jump', tags: ['plyo', 'czworogłowe', 'pośladki'] },
  { name: 'Box jump continuous', tags: ['plyo', 'czworogłowe', 'pośladki'] },
  { name: 'Depth jump', tags: ['plyo', 'czworogłowe', 'łydki'] },
  { name: 'Single-leg hop', tags: ['plyo', 'łydki', 'pośladki'] },
  { name: 'Single-leg box jump', tags: ['plyo', 'czworogłowe', 'pośladki'] },
  { name: 'Bounding', tags: ['plyo', 'pośladki', 'dwugłowe ud'] },
  { name: 'Split squat jump', tags: ['plyo', 'czworogłowe', 'pośladki'] },
  { name: 'Lateral bound', tags: ['plyo', 'pośladki', 'czworogłowe'] },
  { name: 'Tuck jump', tags: ['plyo', 'czworogłowe', 'łydki'] },
  { name: 'Pogo hop', tags: ['plyo', 'łydki'] },
  { name: 'Pogo hop jednonóż', tags: ['plyo', 'łydki'] },
  { name: 'Skater', tags: ['plyo', 'pośladki', 'czworogłowe'] },
  { name: 'Broad jump', tags: ['plyo', 'pośladki', 'dwugłowe ud'] },
  { name: 'Box jump lateral', tags: ['plyo', 'czworogłowe', 'pośladki'] },
  { name: 'Box step-off', tags: ['plyo', 'czworogłowe', 'łydki'] },
  { name: 'Alternating jump lunge', tags: ['plyo', 'czworogłowe', 'pośladki'] },
  { name: 'Skip A/B drill', tags: ['plyo', 'łydki', 'czworogłowe'] },
  // Brzuch
  { name: 'Plank', tags: ['brzuch'] },
  { name: 'Crunch', tags: ['brzuch'] },
  { name: 'Hanging leg raise', tags: ['brzuch'] },
  { name: 'Ab rollout', tags: ['brzuch'] },
  { name: 'Ab wheel rollout', tags: ['brzuch'] },
  { name: 'Dragon flag', tags: ['brzuch'] },
  // Cardio
  { name: 'Bieżnia', tags: ['cardio'] },
  { name: 'Rower stacjonarny', tags: ['cardio', 'nogi'] },
  { name: 'Wioślarze (ergometr)', tags: ['cardio', 'plecy'] },
  { name: 'Kettlebell swing', tags: ['pośladki', 'plecy', 'cardio'] },
  // Wellness
  { name: 'Sauna', tags: ['wellness'] },
  { name: 'Lodowata kąpiel', tags: ['wellness'] },
  { name: 'Zimny prysznic', tags: ['wellness'] },
  { name: 'Stretching', tags: ['wellness'] },
  { name: 'Foam rolling', tags: ['wellness'] },
];

// Exercise name → tags lookup (normalized keys)
const EXERCISE_MAP = new Map(
  EXERCISES.map(e => [normalize(e.name), e.tags])
);

export const MUSCLE_TAGS = [
  'klatka',
  'plecy',
  'barki',
  'biceps',
  'triceps',
  'brzuch',
  'czworogłowe',
  'dwugłowe ud',
  'pośladki',
  'łydki',
  'przedramiona',
];

export * from './exerciseStimulus'

/**
 * Effective-reps decay: a set far from failure (high RIR) stimulates muscle
 * less than one taken close to failure, even at identical kg×reps. No RIR
 * logged → assume the set counted (don't punish missing data).
 */
export function rirEffectiveness(rir: number | null | undefined): number {
  if (rir == null || Number.isNaN(rir)) return 1;
  if (rir <= 1) return 1;
  if (rir <= 2) return 0.9;
  if (rir <= 4) return 0.7;
  if (rir <= 6) return 0.45;
  return 0.25;
}

const TAG_COLOR: Record<string, string> = {
  klatka:        'bg-blue-500/15 text-blue-300 border-blue-500/25',
  plecy:         'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  barki:         'bg-violet-500/15 text-violet-300 border-violet-500/25',
  biceps:        'bg-orange-500/15 text-orange-300 border-orange-500/25',
  triceps:       'bg-rose-500/15 text-rose-300 border-rose-500/25',
  czworogłowe:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  'dwugłowe ud': 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  pośladki:      'bg-pink-500/15 text-pink-300 border-pink-500/25',
  nogi:          'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  brzuch:        'bg-teal-500/15 text-teal-300 border-teal-500/25',
  łydki:         'bg-slate-400/15 text-slate-300 border-slate-400/25',
  przedramiona:  'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  cardio:        'bg-red-500/15 text-red-300 border-red-500/25',
  wellness:      'bg-teal-400/15 text-teal-300 border-teal-400/25',
  plyo:          'bg-lime-500/15 text-lime-300 border-lime-500/25',
};

export function tagClass(tag: string): string {
  return TAG_COLOR[tag] ?? 'bg-white/10 text-white/50 border-white/15';
}

// Find tags for a given exercise name (fuzzy, normalized)
export function tagsForExercise(name: string): string[] {
  const key = normalize(name.trim());
  if (EXERCISE_MAP.has(key)) return EXERCISE_MAP.get(key) || [];
  // Partial match fallback
  for (const [k, tags] of EXERCISE_MAP) {
    if (k.includes(key) || key.includes(k)) return tags;
  }
  return [];
}
