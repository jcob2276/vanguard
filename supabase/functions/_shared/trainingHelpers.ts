export function epley(weight: number, reps: number): number | null {
  if (!weight || !reps || reps <= 0) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function avg(arr: number[]): number | null {
  const valid = arr.filter(v => v != null && !isNaN(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function fmtPace(sec: number, distM: number): string {
  if (!sec || !distM) return '—';
  const spk = sec / (distM / 1000);
  return `${Math.floor(spk / 60)}:${String(Math.round(spk % 60)).padStart(2, '0')} /km`;
}

function pct(curr: number | null, base: number | null): string {
  if (curr == null || base == null || base === 0) return '';
  const p = ((curr - base) / base) * 100;
  return ` (${p > 0 ? '+' : ''}${p.toFixed(0)}%)`;
}

export function fmt(v: number | null, dec = 1, suffix = ''): string {
  return v != null ? `${v.toFixed(dec)}${suffix}` : '—';
}

export const ACTIVITY_KW = /saun|rower|spacer|stretch|masaż|foam|mobility/i;
export const SAUNA_KW = /saun/i;
export const PATTERN_RULES: Array<{ key: string; label: string; re: RegExp; priority: number }> = [
  { key: 'calf', label: 'łydka / Achilles', re: /łyd|lydk|calf|wspię|wspiec|palce|soleus|achill/i, priority: 10 },
  { key: 'tibialis', label: 'tibialis / stopa', re: /tibialis|piszczel|stop|foot|toe|palc/i, priority: 9 },
  { key: 'single_leg', label: 'single-leg stabilizacja', re: /single.?leg|bułgar|bulgar|wykrok|lunge|step.?up|split squat|jednonóż|jednonoz/i, priority: 10 },
  { key: 'plyo', label: 'plajometria / moc reaktywna', re: /plyo|plajo|skok|jump|bound|pogo|depth jump|box jump|tuck jump|skip a\/b/i, priority: 10 },
  { key: 'hinge', label: 'hinge / posterior chain', re: /martwy|deadlift|rdl|hip thrust|good morning|pull through|hinge|dwugłow|hamstring/i, priority: 9 },
  { key: 'squat', label: 'squat / kolano', re: /przysiad|squat|leg press|hack|front squat|goblet/i, priority: 7 },
  { key: 'pull', label: 'pull / plecy', re: /wios|row|podciąg|podciag|pull.?up|ściąg|sciag|lat|face pull|rear delt/i, priority: 6 },
  { key: 'push', label: 'push / klatka-barki', re: /wycisk|bench|ohp|press|dip|pomp|push.?up/i, priority: 6 },
  { key: 'core', label: 'core / antyrotacja', re: /plank|dead bug|pallof|core|brzuch|farmer|carry|side plank/i, priority: 8 },
];

export const LEG_PATTERN_KEYS = new Set(['calf', 'tibialis', 'single_leg', 'hinge', 'squat', 'plyo']);
export const EXERCISE_LIBRARY: Record<string, Array<{ name: string; setsReps: string; intensity: number | null; fallbackLoad: string; goal: string }>> = {
  calf: [
    { name: 'Wspięcia na palce stojąc', setsReps: '4×8-10', intensity: 0.78, fallbackLoad: 'RPE 7-8', goal: 'Achilles/łydka: ciężki bodziec siłowo-ścięgnisty' },
    { name: 'Wspięcia siedząc', setsReps: '3×12-15', intensity: null, fallbackLoad: 'RPE 8', goal: 'soleus pod ekonomię biegu' },
  ],
  tibialis: [
    { name: 'Tibialis raise', setsReps: '3×15-20', intensity: null, fallbackLoad: 'RPE 7', goal: 'piszczelowy/stopa: balans dla łydki' },
  ],
  single_leg: [
    { name: 'Single-leg RDL', setsReps: '3×8 na nogę', intensity: null, fallbackLoad: 'BW+lekki ciężar, RPE 7', goal: 'miednica, hamstring, kontrola kolana' },
    { name: 'Bulgarian split squat', setsReps: '3×8 na nogę', intensity: null, fallbackLoad: 'RPE 7-8', goal: 'single-leg siła + hipertrofia bez dużego axial load' },
  ],
  hinge: [
    { name: 'Martwy ciąg', setsReps: '3×5', intensity: 0.84, fallbackLoad: 'RPE 7-8', goal: 'posterior chain i siła biodra' },
    { name: 'RDL', setsReps: '3×6-8', intensity: 0.72, fallbackLoad: 'RPE 7', goal: 'hamstring hipertrofia + kontrola ekscentryczna' },
  ],
  squat: [
    { name: 'Przysiad', setsReps: '3×5', intensity: 0.80, fallbackLoad: 'RPE 7', goal: 'quad/glute strength bez zajechania nóg' },
  ],
  pull: [
    { name: 'Wiosłowanie sztangą', setsReps: '4×8', intensity: 0.72, fallbackLoad: 'RPE 8', goal: 'plecy, postawa, równowaga dla pressingu' },
    { name: 'Podciąganie', setsReps: '4×6-8', intensity: null, fallbackLoad: 'BW lub BW+dodatkowy ciężar RPE 8', goal: 'pionowy pull i sylwetka' },
  ],
  push: [
    { name: 'Wyciskanie płaskie', setsReps: '3×5', intensity: 0.84, fallbackLoad: 'RPE 7-8', goal: 'siła góry bez nadmiernej objętości' },
    { name: 'Dips', setsReps: '3×8', intensity: null, fallbackLoad: 'BW/BW+ciężar RPE 8', goal: 'klatka/triceps, bodziec sylwetkowy' },
  ],
  core: [
    { name: 'Pallof press', setsReps: '3×10/strona', intensity: null, fallbackLoad: 'RPE 7', goal: 'antyrotacja pod kontrolę miednicy' },
    { name: 'Plank boczny', setsReps: '3×30-45s/strona', intensity: null, fallbackLoad: 'BW', goal: 'core boczny i stabilizacja' },
  ],
  plyo: [
    { name: 'Box jump', setsReps: '3×5', intensity: null, fallbackLoad: 'pełny reset między skokami, jakość > liczba', goal: 'moc reaktywna i ekonomia biegu' },
    { name: 'Single-leg hop', setsReps: '3×6 na nogę', intensity: null, fallbackLoad: 'kontrolowane lądowanie, RPE 7', goal: 'sprężystość łydki/Achillesa pod bieganie' },
  ],
};

export function classifyRun(a: any): string {
  const wt = Number(a.workout_type);
  if (wt === 1) return 'Wyścig';
  if (wt === 2) return 'Długi bieg';
  if (wt === 3) return 'Trening/Interwały';
  const name = (a.name || '').toLowerCase();
  if (/długi|long/i.test(name)) return 'Długi bieg';
  if (/tempo/i.test(name)) return 'Tempo';
  if (/interw|interval/i.test(name)) return 'Interwały';
  if (/z2|regenera|easy|spokojn|aerob|tlenow/i.test(name)) return 'Z2/Easy';
  if (/tr3|trening 3|workout/i.test(name)) return 'Trening/Interwały';
  return 'Bieg';
}

export function fmtGcZones(zones: any): string {
  if (!Array.isArray(zones) || !zones.length) return '';
  return zones.map((z: any, i: number) => {
    const mins = z.secsInZone != null ? Math.round(z.secsInZone / 60) : null;
    return mins != null && mins > 0 ? `Z${i + 1}:${mins}min` : null;
  }).filter(Boolean).join(' ');
}

export function weekOf(date: string, now: Date, warsaw: (d: Date) => string): number {
  const today = warsaw(now);
  const daysAgo = Math.floor((new Date(today + 'T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / 864e5);
  if (daysAgo < 7) return 0;
  if (daysAgo < 14) return 1;
  if (daysAgo < 21) return 2;
  return 3;
}

export function isoDow(date: string): number {
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  return day === 0 ? 7 : day;
}

export const DOW_PL: Record<number, string> = {
  1: 'poniedziałek',
  2: 'wtorek',
  3: 'środa',
  4: 'czwartek',
  5: 'piątek',
  6: 'sobota',
  7: 'niedziela',
};

export function dayDiff(from: string | null, to: string): number | null {
  if (!from) return null;
  return Math.floor((new Date(to + 'T12:00:00Z').getTime() - new Date(from + 'T12:00:00Z').getTime()) / 864e5);
}

export function exercisePatterns(name: string, tags: string[] = []): string[] {
  const hay = `${name || ''} ${tags.join(' ')}`.toLowerCase();
  return PATTERN_RULES.filter(r => r.re.test(hay)).map(r => r.key);
}

export function classifyFatigue(patterns: string[], rir: number | null, sets: number): 'low' | 'medium' | 'high' {
  const leg = patterns.some(p => LEG_PATTERN_KEYS.has(p));
  if (leg && (sets >= 6 || (rir != null && rir <= 1.5))) return 'high';
  if (leg || sets >= 4 || (rir != null && rir <= 2)) return 'medium';
  return 'low';
}

function roundTo2_5(v: number): number {
  return Math.round(v / 2.5) * 2.5;
}

export function loadHint(name: string, intensity: number | null, allTimeE1rm: Record<string, number>, fallback: string): string {
  if (intensity == null) return fallback;
  const exact = allTimeE1rm[name];
  const fuzzyEntry = Object.entries(allTimeE1rm).find(([k]) => k.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(k.toLowerCase()));
  const e1rm = exact ?? fuzzyEntry?.[1];
  return e1rm ? `${roundTo2_5(e1rm * intensity)}kg` : fallback;
}
