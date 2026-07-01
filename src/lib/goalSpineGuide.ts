import { getTodayWarsaw } from './date';
import {
  weekGoalsAreEmpty,
  type GoalSpine,
  type WeeklyReviewRow,
} from './goalSpine';
import { isMonthlyHardGate, isMonthlySoftCue, monthLabel } from './monthReview';
import { longTermDeclarationsOk, primaryBhagLine } from './longTermBridge';

export type SpineGuideTarget = 'dzis' | 'tydzien' | 'projekty' | 'dashboard';

type SpineGuideAction =
  | { type: 'navigate'; target: SpineGuideTarget; label: string }
  | { type: 'plan_day'; label: string }
  | { type: 'focus_plan'; label: string }
  | { type: 'none' };

type SpineGuideStep = {
  id: string;
  label: string;
  status: 'done' | 'now' | 'pending';
};

export type DayWinState = {
  hasPlan: boolean;
  plannedCount: number;
  doneCount: number;
  nextTask: string | null;
  dayComplete: boolean;
  yesterdayReflectionNeeded: boolean;
};

export type SpineGuidance = {
  primaryCue: string;
  primaryAction: SpineGuideAction;
  steps: SpineGuideStep[];
  readyForDay: boolean;
  dayProgress: { done: number; total: number } | null;
};

export type SpineGuideContext = {
  weeklyReview: WeeklyReviewRow | null;
  weekReflectionOverdueDays: number | null;
  today?: string;
  day?: DayWinState;
};

type DailyWinLike = Record<string, unknown> | null | undefined;

export function dayWinStateFromRow(
  todayWin: DailyWinLike,
  yesterdayReflectionNeeded = false,
): DayWinState {
  if (!todayWin) {
    return {
      hasPlan: false,
      plannedCount: 0,
      doneCount: 0,
      nextTask: null,
      dayComplete: false,
      yesterdayReflectionNeeded,
    };
  }

  let plannedCount = 0;
  let doneCount = 0;
  let nextTask: string | null = null;

  for (let i = 1; i <= 5; i++) {
    const task = todayWin[`task_${i}`];
    const text = typeof task === 'string' ? task.trim() : '';
    if (!text) continue;
    plannedCount++;
    if (todayWin[`done_${i}`]) {
      doneCount++;
    } else if (!nextTask) {
      nextTask = text;
    }
  }

  const activeSlots = [1, 2, 3, 4, 5].filter((i) => {
    const t = todayWin[`task_${i}`];
    return typeof t === 'string' && t.trim().length > 0;
  });
  const dayComplete =
    activeSlots.length > 0 && activeSlots.every((i) => Boolean(todayWin[`done_${i}`]));

  return {
    hasPlan: plannedCount > 0,
    plannedCount,
    doneCount,
    nextTask,
    dayComplete,
    yesterdayReflectionNeeded,
  };
}

function truncate(text: string, max = 48): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function weekAnchorText(spine: GoalSpine): string | null {
  return (
    spine.week.intention?.trim() ||
    spine.week.cialo?.trim() ||
    spine.week.duch?.trim() ||
    spine.week.konto?.trim() ||
    spine.week.commitment?.trim() ||
    null
  );
}

function withSteps(steps: SpineGuideStep[], nowId: string): SpineGuideStep[] {
  return steps.map((s) => ({
    ...s,
    status: s.id === nowId ? 'now' : s.status === 'done' ? 'done' : 'pending',
  }));
}

function dayStepStatus(day: DayWinState): SpineGuideStep['status'] {
  if (day.dayComplete) return 'done';
  if (day.hasPlan || day.yesterdayReflectionNeeded) return 'now';
  return 'pending';
}

function deriveDayGuidance(spine: GoalSpine, day: DayWinState, baseSteps: SpineGuideStep[]): SpineGuidance {
  const anchor = weekAnchorText(spine);
  const steps = baseSteps.map((s) =>
    s.id === 'day' ? { ...s, status: dayStepStatus(day) } : s,
  );

  if (day.yesterdayReflectionNeeded && !day.hasPlan) {
    return {
      primaryCue: '30 sekund na wczoraj — potem system ułoży propozycję na dziś.',
      primaryAction: { type: 'focus_plan', label: 'Zacznij planowanie' },
      steps: withSteps(steps, 'day'),
      readyForDay: true,
      dayProgress: null,
    };
  }

  if (!day.hasPlan) {
    return {
      primaryCue: anchor
        ? `Zaplanuj 5 zwycięstw pod „${truncate(anchor)}” — propozycja z tygodnia, ty tylko poprawisz.`
        : '60 sekund: propozycja dnia z celów tygodnia — potem popraw i start.',
      primaryAction: { type: 'plan_day', label: 'Zaplanuj dzień' },
      steps: withSteps(steps, 'day'),
      readyForDay: true,
      dayProgress: null,
    };
  }

  if (!day.dayComplete) {
    const total = day.plannedCount;
    return {
      primaryCue: day.nextTask
        ? `${day.doneCount}/${total} — następne zwycięstwo: „${truncate(day.nextTask, 42)}”.`
        : `${day.doneCount}/${total} zwycięstw zrobione — domknij resztę.`,
      primaryAction: { type: 'focus_plan', label: 'Pokaż listę' },
      steps: withSteps(steps, 'day'),
      readyForDay: true,
      dayProgress: { done: day.doneCount, total },
    };
  }

  return {
    primaryCue: anchor
      ? `Dzień domknięty ✓ Jutro kolejny krok w stronę „${truncate(anchor)}”.`
      : 'Wszystkie zwycięstwa na dziś — dzień domknięty.',
    primaryAction: { type: 'none' },
    steps: steps.map((s) => (s.id === 'day' ? { ...s, status: 'done' as const } : s)),
    readyForDay: true,
    dayProgress: { done: day.doneCount, total: day.plannedCount },
  };
}

export function deriveSpineGuidance(
  spine: GoalSpine,
  ctx: SpineGuideContext,
): SpineGuidance {
  const today = ctx.today ?? getTodayWarsaw();
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
  const day = ctx.day ?? dayWinStateFromRow(null);

  const sprintGoalOk = Boolean(spine.sprint.goalText?.trim());
  const sprintCloseOk = Boolean(spine.sprintReview?.completed_at);
  const longTermOk = longTermDeclarationsOk(spine.longTerm);
  const monthOk = !spine.month.due || Boolean(spine.month.review?.completed_at);
  const weekGoalsOk = !weekGoalsAreEmpty(spine.week);
  const weekReflectionOk = Boolean(ctx.weeklyReview?.review_completed_at);

  const baseSteps: SpineGuideStep[] = [
    { id: 'long_term', label: 'Cele roczne / BHAG', status: longTermOk ? 'done' : 'pending' },
    { id: 'sprint', label: 'Cel sprintu (12 tyg.)', status: sprintGoalOk ? 'done' : 'pending' },
    ...(spine.sprint.isClosingWeek
      ? ([{ id: 'sprint_close', label: 'Zamknięcie sprintu', status: sprintCloseOk ? 'done' : 'pending' }] as SpineGuideStep[])
      : []),
    ...(spine.month.closingMonthStart
      ? ([{ id: 'month', label: 'Przegląd miesiąca', status: monthOk ? 'done' : 'pending' }] as SpineGuideStep[])
      : []),
    { id: 'week', label: 'Cele tygodnia', status: weekGoalsOk ? 'done' : 'pending' },
    { id: 'week_reflection', label: 'Refleksja tygodnia', status: weekReflectionOk ? 'done' : 'pending' },
    { id: 'day', label: '5 zwycięstw dziś', status: dayStepStatus(day) },
  ];

  if (!longTermOk) {
    const bhag = primaryBhagLine(spine.longTerm);
    return {
      primaryCue: bhag
        ? `Uzupełnij cele roczne — masz szkic, ale brakuje pełnego BHAG.`
        : 'Najpierw cele roczne (Ciało / Duch / Konto) — bez tego sprint nie ma kotwicy.',
      primaryAction: { type: 'navigate', target: 'projekty', label: 'Cele życiowe' },
      steps: withSteps(baseSteps, 'long_term'),
      readyForDay: false,
      dayProgress: null,
    };
  }

  if (spine.sprint.isClosingWeek && !sprintCloseOk) {
    return {
      primaryCue: 'Tydzień 12/12 — zamknij sprint w Tygodniu: agregat + cel na następne 12 tyg.',
      primaryAction: { type: 'navigate', target: 'tydzien', label: 'Zamknij sprint' },
      steps: withSteps(baseSteps, 'sprint_close'),
      readyForDay: false,
      dayProgress: null,
    };
  }

  if (!sprintGoalOk) {
    const bhag = primaryBhagLine(spine.longTerm);
    return {
      primaryCue: bhag
        ? `BHAG: „${bhag.slice(0, 60)}${bhag.length > 60 ? '…' : ''}” — ustaw cel sprintu (12 tyg.).`
        : 'Najpierw cel sprintu (12 tyg.) — bez horyzontu tydzień jest bez kotwicy.',
      primaryAction: { type: 'navigate', target: 'tydzien', label: 'Ustaw cel sprintu' },
      steps: withSteps(baseSteps, 'sprint'),
      readyForDay: false,
      dayProgress: null,
    };
  }

  if (spine.month.due && !monthOk && isMonthlyHardGate(today)) {
    const label = spine.month.closingMonthStart
      ? monthLabel(spine.month.closingMonthStart)
      : 'miesiąc';
    return {
      primaryCue: isSunday
        ? `Niedziela — najpierw zamknij ${label}, potem tydzień.`
        : `Przegląd miesiąca (${label}) — zrób to w Tygodniu, zanim ruszysz dalej.`,
      primaryAction: { type: 'navigate', target: 'tydzien', label: 'Przegląd miesiąca' },
      steps: withSteps(baseSteps, 'month'),
      readyForDay: false,
      dayProgress: null,
    };
  }

  if (!weekGoalsOk) {
    const fallback = spine.week.source === 'fallback';
    return {
      primaryCue: fallback
        ? 'Ten tydzień nie ma jeszcze celów — ustaw je w Tydzień (teraz widać poprzedni tydzień).'
        : 'Uzupełnij cele tego tygodnia: Ciało, Duch, Konto.',
      primaryAction: { type: 'navigate', target: 'tydzien', label: 'Idź do Tygodnia' },
      steps: withSteps(baseSteps, 'week'),
      readyForDay: false,
      dayProgress: null,
    };
  }

  if (isSunday && !weekReflectionOk) {
    return {
      primaryCue: 'Niedziela — zamknij refleksję tygodnia, zanim planujesz kolejny.',
      primaryAction: { type: 'navigate', target: 'tydzien', label: 'Refleksja w Tygodniu' },
      steps: withSteps(baseSteps, 'week_reflection'),
      readyForDay: false,
      dayProgress: null,
    };
  }

  if (!weekReflectionOk && ctx.weekReflectionOverdueDays !== null && ctx.weekReflectionOverdueDays > 14) {
    return {
      primaryCue: 'Dawno nie było refleksji tygodnia — 10 minut w zakładce Tydzień.',
      primaryAction: { type: 'navigate', target: 'tydzien', label: 'Otwórz Tydzień' },
      steps: withSteps(baseSteps, 'week_reflection'),
      readyForDay: false,
      dayProgress: null,
    };
  }

  const guidance = deriveDayGuidance(spine, day, baseSteps);

  if (spine.month.due && !monthOk && isMonthlySoftCue(today)) {
    const label = spine.month.closingMonthStart
      ? monthLabel(spine.month.closingMonthStart)
      : 'miesiąc';
    return {
      ...guidance,
      primaryCue: `Przegląd ${label} wciąż otwarty — 15 min w Tygodniu. ${guidance.primaryCue}`,
      steps: withSteps(baseSteps, 'month'),
      primaryAction:
        guidance.primaryAction.type === 'none'
          ? { type: 'navigate', target: 'tydzien', label: 'Przegląd miesiąca' }
          : guidance.primaryAction,
    };
  }

  return guidance;
}
