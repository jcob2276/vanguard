import { mean, sampleSD } from './baselines.ts';

export type ReadinessLevel = 'primed' | 'balanced' | 'strained' | 'rundown' | 'insufficient';
type SignalFlag = 'good' | 'neutral' | 'watch' | 'bad';

export interface ReadinessSignal {
  key: string;
  flag: SignalFlag;
  detail: string;
}

export interface ReadinessDay {
  date: string;
  hrv: number | null;
  rhr: number | null;
  respRate: number | null;
  strain: number | null;
}

export function computeReadiness(
  days: ReadinessDay[],
  today: string
): { level: ReadinessLevel; signals: ReadinessSignal[] } {
  const BASELINE_WINDOW = 30;
  const MIN_BASELINE = 7;
  const ACUTE_WINDOW = 7;
  const CHRONIC_WINDOW = 28;
  const MIN_CHRONIC = 14;

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.find((d) => d.date === today) ?? sorted[sorted.length - 1];
  if (!latest) return { level: 'insufficient', signals: [] };

  const history = sorted.filter((d) => d.date < latest.date);
  const signals: ReadinessSignal[] = [];

  const zSignal = (
    val: number | null,
    baseline: number[],
    higherBetter: boolean,
    key: string,
    [good, neutral, watch, bad]: [string, string, string, string]
  ) => {
    if (val == null || baseline.length < MIN_BASELINE) return;
    const m = mean(baseline);
    const sd = sampleSD(baseline);
    if (m == null || sd == null || sd <= 0) return;
    const z = (higherBetter ? val - m : m - val) / sd;
    const flag: SignalFlag = z >= 0.5 ? 'good' : z >= -0.5 ? 'neutral' : z >= -1.0 ? 'watch' : 'bad';
    signals.push({
      key,
      flag,
      detail: flag === 'good' ? good : flag === 'neutral' ? neutral : flag === 'watch' ? watch : bad,
    });
  };

  zSignal(
    latest.hrv,
    history.slice(-BASELINE_WINDOW).map((d) => d.hrv).filter((v): v is number => v != null),
    true,
    'hrv',
    [
      'powyżej baseline — dobrze zregenerowany',
      'w normalnym zakresie',
      'lekko poniżej baseline',
      'wyraźnie poniżej — zmęczenie autonomiczne',
    ]
  );

  zSignal(
    latest.rhr,
    history.slice(-BASELINE_WINDOW).map((d) => d.rhr).filter((v): v is number => v != null),
    false,
    'rhr',
    [
      'poniżej lub na poziomie baseline',
      'w normalnym zakresie',
      'lekko powyżej baseline',
      'podwyższony — przetrenowanie lub choroba',
    ]
  );

  const respBase = history.slice(-BASELINE_WINDOW).map((d) => d.respRate).filter((v): v is number => v != null);
  const respSD = sampleSD(respBase);
  const respMean = mean(respBase);
  if (latest.respRate != null && respBase.length >= MIN_BASELINE && respSD != null && respSD > 0 && respMean != null) {
    const z = (latest.respRate - respMean) / respSD;
    if (z >= 1.5) {
      signals.push({ key: 'respRate', flag: 'bad', detail: 'oddech powyżej baseline — możliwy wczesny sygnał choroby' });
    } else if (z >= 1.0) {
      signals.push({ key: 'respRate', flag: 'watch', detail: 'oddech lekko powyżej baseline' });
    }
  }

  const strainVals = sorted
    .map((d) => d.strain)
    .filter((v): v is number => v != null && Number.isFinite(v));

  if (strainVals.length >= MIN_CHRONIC) {
    const acute = mean(strainVals.slice(-ACUTE_WINDOW))!;
    const chronic = mean(strainVals.slice(-CHRONIC_WINDOW))!;
    if (chronic > 0) {
      const ratio = acute / chronic;
      const pr = ratio.toFixed(2);
      if (ratio < 0.8) {
        signals.push({ key: 'acwr', flag: 'watch', detail: `load spada (ACWR ${pr}) — przestrzeń do budowania` });
      } else if (ratio < 1.3) {
        signals.push({ key: 'acwr', flag: 'good', detail: `load w sweet spot (ACWR ${pr})` });
      } else if (ratio < 1.5) {
        signals.push({ key: 'acwr', flag: 'watch', detail: `load rośnie szybko (ACWR ${pr}) — obserwuj` });
      } else {
        signals.push({ key: 'acwr', flag: 'bad', detail: `SPIKE (ACWR ${pr}) — ryzyko kontuzji` });
      }
    }
    const week = strainVals.slice(-ACUTE_WINDOW);
    const wm = mean(week);
    const wSD = sampleSD(week);
    if (week.length >= 4 && wm != null && wSD != null) {
      if (wSD > 0 && wm / wSD >= 2.0) {
        signals.push({ key: 'monotony', flag: 'watch', detail: 'niska zmienność — zbyt podobny bodziec każdego dnia' });
      }
    }
  }

  if (!history.length || !signals.length) return { level: 'insufficient', signals };
  const bad = signals.filter((s) => s.flag === 'bad').length;
  const recovDown = signals.some((s) => ['hrv', 'rhr', 'respRate'].includes(s.key) && s.flag === 'bad');
  const loadHigh = signals.some((s) => s.key === 'acwr' && s.flag === 'bad');
  const good = signals.filter((s) => s.flag === 'good').length;
  const watch = signals.filter((s) => s.flag === 'watch').length;

  let level: ReadinessLevel;
  if (bad >= 2 || (recovDown && loadHigh)) level = 'rundown';
  else if (recovDown || loadHigh || bad >= 1) level = 'strained';
  else if (good >= 2 && watch === 0) level = 'primed';
  else level = 'balanced';

  return { level, signals };
}
