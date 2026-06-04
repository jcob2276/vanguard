export function normalize(s) {
  return s.toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l')
    .replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z');
}

export const EXERCISES = [
  // Klatka
  { name: 'Wyciskanie sztangi na ławce', tags: ['klatka', 'triceps', 'barki'] },
  { name: 'Wyciskanie hantli na ławce', tags: ['klatka', 'triceps', 'barki'] },
  { name: 'Wyciskanie na skosie', tags: ['klatka', 'barki'] },
  { name: 'Rozpiętki', tags: ['klatka'] },
  { name: 'Pompki', tags: ['klatka', 'triceps'] },
  { name: 'Dips', tags: ['klatka', 'triceps'] },
  { name: 'Cable crossover', tags: ['klatka'] },
  // Plecy
  { name: 'Martwy ciąg', tags: ['plecy', 'nogi', 'pośladki'] },
  { name: 'Martwy ciąg rumuński', tags: ['dwugłowe ud', 'pośladki', 'plecy'] },
  { name: 'Podciąganie', tags: ['plecy', 'biceps'] },
  { name: 'Wiosłowanie sztangą', tags: ['plecy', 'biceps'] },
  { name: 'Wiosłowanie hantlem', tags: ['plecy', 'biceps'] },
  { name: 'Ściąganie drążka', tags: ['plecy', 'biceps'] },
  { name: 'Face pull', tags: ['plecy', 'barki'] },
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
  { name: 'Uginanie z hantlami', tags: ['biceps'] },
  { name: 'Uginanie młotkowe', tags: ['biceps', 'przedramiona'] },
  { name: 'Uginanie na modlitewniku', tags: ['biceps'] },
  { name: 'Uginanie na lince', tags: ['biceps'] },
  // Triceps
  { name: 'Wyciskanie wąskim chwytem', tags: ['triceps', 'klatka'] },
  { name: 'Pushdown na lince', tags: ['triceps'] },
  { name: 'French press', tags: ['triceps'] },
  { name: 'Skull crushers', tags: ['triceps'] },
  { name: 'Overhead triceps extension', tags: ['triceps'] },
  // Nogi
  { name: 'Przysiad ze sztangą', tags: ['czworogłowe', 'pośladki', 'dwugłowe ud'] },
  { name: 'Bułgarski przysiad', tags: ['czworogłowe', 'pośladki'] },
  { name: 'Hack squat', tags: ['czworogłowe'] },
  { name: 'Leg press', tags: ['czworogłowe', 'pośladki'] },
  { name: 'Wykroki', tags: ['czworogłowe', 'pośladki'] },
  { name: 'Prostowanie nóg', tags: ['czworogłowe'] },
  { name: 'Zginanie nóg', tags: ['dwugłowe ud'] },
  { name: 'Hip thrust', tags: ['pośladki', 'dwugłowe ud'] },
  { name: 'Wspięcia na łydki', tags: ['łydki'] },
  { name: 'Good morning', tags: ['dwugłowe ud', 'pośladki', 'plecy'] },
  // Brzuch
  { name: 'Plank', tags: ['brzuch'] },
  { name: 'Crunch', tags: ['brzuch'] },
  { name: 'Hanging leg raise', tags: ['brzuch'] },
  { name: 'Ab rollout', tags: ['brzuch'] },
  { name: 'Dragon flag', tags: ['brzuch'] },
  // Cardio
  { name: 'Bieżnia', tags: ['cardio'] },
  { name: 'Rower stacjonarny', tags: ['cardio', 'nogi'] },
  { name: 'Wioślarze (ergometr)', tags: ['cardio', 'plecy'] },
  { name: 'Kettlebell swing', tags: ['pośladki', 'plecy', 'cardio'] },
];

// Exercise name → tags lookup (normalized keys)
export const EXERCISE_MAP = new Map(
  EXERCISES.map(e => [normalize(e.name), e.tags])
);

export const ALL_TAGS = [...new Set(EXERCISES.flatMap(e => e.tags))].sort();

export const TAG_COLOR = {
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
};

export function tagClass(tag) {
  return TAG_COLOR[tag] ?? 'bg-white/10 text-white/50 border-white/15';
}

// Find tags for a given exercise name (fuzzy, normalized)
export function tagsForExercise(name) {
  const key = normalize(name.trim());
  if (EXERCISE_MAP.has(key)) return EXERCISE_MAP.get(key);
  // Partial match fallback
  for (const [k, tags] of EXERCISE_MAP) {
    if (k.includes(key) || key.includes(k)) return tags;
  }
  return [];
}
