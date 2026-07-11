import { normalize } from './exercises'

const TAG_SET_WEIGHTS = [1, 0.55, 0.35, 0.25]

const STIMULUS_PROFILES: Array<{ patterns: string[]; stimulus: Record<string, { direct?: number; indirect?: number }> }> = [
  {
    patterns: ['wyciskanie plaskie', 'wyciskanie sztangi na lawce', 'wyciskanie hantli na lawce', 'bench'],
    stimulus: {
      klatka: { direct: 1 },
      triceps: { indirect: 0.35 },
      barki: { indirect: 0.25 },
    },
  },
  {
    patterns: ['wyciskanie na skosie', 'wyciskanie skosne', 'incline'],
    stimulus: {
      klatka: { direct: 1 },
      barki: { indirect: 0.45 },
      triceps: { indirect: 0.25 },
    },
  },
  {
    patterns: ['pompki', 'push-up', 'pushup'],
    stimulus: {
      klatka: { direct: 0.85 },
      triceps: { indirect: 0.45 },
    },
  },
  {
    patterns: ['dips', 'dipy'],
    stimulus: {
      triceps: { direct: 1 },
      klatka: { indirect: 0.45 },
      barki: { indirect: 0.15 },
    },
  },
  {
    patterns: ['ohp', 'overhead press', 'wyciskanie zolnierskie'],
    stimulus: {
      barki: { direct: 1 },
      triceps: { indirect: 0.45 },
    },
  },
  {
    patterns: ['wyciskanie waskim', 'close-grip', 'cg bench'],
    stimulus: {
      triceps: { direct: 1 },
      klatka: { indirect: 0.45 },
      barki: { indirect: 0.2 },
    },
  },
  {
    patterns: ['pushdown', 'french press', 'skull crusher', 'overhead triceps', 'overh triceps', 'triceps ext', 'prostowanie lokci'],
    stimulus: {
      triceps: { direct: 1 },
    },
  },
  {
    patterns: ['podciaganie podchwytem', 'chin-up', 'chin up', 'chin ups', 'chinup'],
    stimulus: {
      biceps: { direct: 1 },
      plecy: { indirect: 0.5 },
    },
  },
  {
    patterns: ['podciaganie', 'sciaganie drazka', 'lat pulldown', 'pull-up', 'pullup'],
    stimulus: {
      plecy: { direct: 1 },
      biceps: { indirect: 0.45 },
    },
  },
  {
    patterns: ['wioslowanie', 'seal row', 'chest-supported row'],
    stimulus: {
      plecy: { direct: 1 },
      biceps: { indirect: 0.45 },
    },
  },
  {
    patterns: ['face pull'],
    stimulus: {
      barki: { direct: 0.75 },
      plecy: { indirect: 0.45 },
    },
  },
  {
    patterns: ['unoszenie boczne', 'wznosy bokiem', 'lateral raise'],
    stimulus: {
      barki: { direct: 1 },
    },
  },
  {
    patterns: ['odwrotne rozpietki', 'reverse fly', 'rear delt'],
    stimulus: {
      barki: { direct: 1 },
    },
  },
  {
    patterns: ['martwy ciag rumunski', 'rdl'],
    stimulus: {
      'dwugłowe ud': { direct: 1 },
      pośladki: { direct: 0.7 },
      plecy: { indirect: 0.35 },
    },
  },
  {
    patterns: ['martwy ciag', 'deadlift'],
    stimulus: {
      pośladki: { direct: 0.85 },
      'dwugłowe ud': { direct: 0.75 },
      plecy: { indirect: 0.6 },
    },
  },
  {
    patterns: ['przysiad', 'squat', 'leg press', 'wykroki'],
    stimulus: {
      czworogłowe: { direct: 1 },
      pośladki: { indirect: 0.55 },
      'dwugłowe ud': { indirect: 0.25 },
    },
  },
  {
    patterns: ['prostowanie nog'],
    stimulus: {
      czworogłowe: { direct: 1 },
    },
  },
  {
    patterns: ['zginanie nog', 'leg curl'],
    stimulus: {
      'dwugłowe ud': { direct: 1 },
    },
  },
  {
    patterns: ['hip thrust'],
    stimulus: {
      pośladki: { direct: 1 },
      'dwugłowe ud': { indirect: 0.35 },
    },
  },
  {
    patterns: ['wspiecia na lydki', 'wspiecia na palce', 'calf'],
    stimulus: {
      łydki: { direct: 1 },
    },
  },
  {
    patterns: ['ab wheel', 'ab rollout'],
    stimulus: {
      brzuch: { direct: 1 },
    },
  },
  {
    patterns: ['uginanie', 'biceps curl', 'hammer curl'],
    stimulus: {
      biceps: { direct: 1 },
      przedramiona: { indirect: 0.25 },
    },
  },
  {
    patterns: ['box jump', 'depth jump', 'split squat jump', 'tuck jump'],
    stimulus: {
      czworogłowe: { direct: 1 },
      pośladki: { indirect: 0.55 },
    },
  },
  {
    patterns: ['single-leg hop', 'single-leg box jump', 'pogo hop', 'bounding', 'lateral bound', 'skip a/b'],
    stimulus: {
      łydki: { direct: 1 },
      pośladki: { indirect: 0.45 },
    },
  },
]

export function stimulusForExercise(name: string, fallbackTags: string[] = []): Record<string, { direct?: number; indirect?: number }> {
  const key = normalize(String(name || ''))
  const profile = STIMULUS_PROFILES.find((p) => p.patterns.some((pattern) => key.includes(normalize(pattern))))
  if (profile) return profile.stimulus as Record<string, { direct?: number; indirect?: number }>

  return fallbackTags.reduce<Record<string, { direct?: number; indirect?: number }>>((acc, tag, index) => {
    if (index === 0) acc[tag] = { direct: 1 }
    else acc[tag] = { indirect: TAG_SET_WEIGHTS[index] ?? 0.25 }
    return acc
  }, {})
}
