import { addDays, format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { DirectionContextData } from './dailyPlanProposal';
import type { ScheduleViewData, ScheduleItem } from '../types/schedule';
import { getTodayWarsaw } from './date';
import { sweepPastEventsInState } from '../types/schedule';
import { formatSprintWeekBridge } from './goalSpine';
import { formatSprintFromLongTerm } from './longTermBridge';

export const SCHEDULE_STORAGE_KEY = 'vanguard_schedule_view';

export function loadOracleScheduleOverride(): ScheduleViewData | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as ScheduleViewData;
    return sweepPastEventsInState(state, new Date());
  } catch {
    return null;
  }
}

function dayLabel(dayDate: string, today: string): string {
  const tomorrow = format(addDays(parseISO(today), 1), 'yyyy-MM-dd');
  if (dayDate === today) return 'DZIŚ';
  if (dayDate === tomorrow) return 'JUTRO';
  return format(parseISO(dayDate + 'T12:00:00'), 'EEE d MMM', { locale: pl }).toUpperCase();
}

export function buildMagazineFromDirection(ctx: DirectionContextData): ScheduleViewData {
  const today = getTodayWarsaw();
  const editorialIntro =
    ctx.weekGoals.intention?.trim() ||
    ctx.weekGoals.commitment?.trim() ||
    '';
  const weekStep = ctx.weekGoals.intention?.trim() || ctx.weekGoals.commitment?.trim() || null;
  const sprintWeekBridge = formatSprintWeekBridge(ctx.sprintGoal, weekStep);
  const longTermBridge = formatSprintFromLongTerm(ctx.bhagLine ?? null, ctx.sprintGoal);

  const heroPin = ctx.openMustPins[0] ?? ctx.mustPins.find((p) => !p.done);
  const heroTodo = ctx.urgentTodos[0];
  const hero = heroPin
    ? {
        cardId: heroPin.id,
        title: heroPin.title,
        description: 'MUST tygodnia',
        priority: 1,
      }
    : heroTodo
      ? {
          cardId: heroTodo.id,
          title: heroTodo.title,
          description: heroTodo.projectName ?? 'Pilne zadanie',
          startTime: heroTodo.due_date ?? undefined,
          priority: 2,
        }
      : ctx.sprintGoal
        ? {
            cardId: 'sprint',
            title: ctx.sprintGoal,
            description: ctx.sprintLabel ?? 'Sprint',
            priority: 3,
          }
        : undefined;

  const quoteBlocks: ScheduleViewData['quoteBlocks'] = [];
  if (ctx.weekGoals.cialo) quoteBlocks.push({ title: 'Ciało', content: ctx.weekGoals.cialo, priority: 'normal' });
  if (ctx.weekGoals.duch) quoteBlocks.push({ title: 'Duch', content: ctx.weekGoals.duch, priority: 'normal' });
  if (ctx.weekGoals.konto) quoteBlocks.push({ title: 'Konto', content: ctx.weekGoals.konto, priority: 'normal' });

  const itemsByDay = new Map<string, ScheduleItem[]>();

  const pushItem = (dayDate: string, item: ScheduleItem) => {
    if (!itemsByDay.has(dayDate)) itemsByDay.set(dayDate, []);
    itemsByDay.get(dayDate)!.push(item);
  };

  for (const cp of ctx.checkpoints.upcoming.slice(0, 12)) {
    pushItem(cp.due_date, {
      id: `cp-${cp.id}`,
      kind: 'event',
      title: cp.title,
      dueAt: cp.due_date,
      color: cp.project.color ?? undefined,
      sourceFact: cp.project.name,
    });
  }

  for (const todo of ctx.urgentTodos.slice(0, 10)) {
    const dayDate = todo.due_date ?? today;
    pushItem(dayDate, {
      id: `todo-${todo.id}`,
      kind: 'todo',
      title: todo.title,
      dueAt: todo.due_date ?? undefined,
      sourceFact: todo.projectName ?? undefined,
    });
  }

  for (let i = 0; i < 7; i++) {
    const d = format(addDays(parseISO(today + 'T12:00:00'), i), 'yyyy-MM-dd');
    if (!itemsByDay.has(d)) itemsByDay.set(d, []);
  }

  const timeline = [...itemsByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)
    .map(([dayDate, items]) => ({
      dayLabel: dayLabel(dayDate, today),
      dayDate,
      items: items.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '')),
    }))
    .filter((day) => day.items.length > 0 || day.dayDate === today);

  return {
    id: `direction-${ctx.weekStart}`,
    generatedAt: new Date().toISOString(),
    hero,
    editorialIntro,
    monthTheme: ctx.monthTheme ?? undefined,
    monthThemeLabel: ctx.monthLabel ?? undefined,
    sprintWeekBridge: sprintWeekBridge ?? undefined,
    longTermBridge: longTermBridge ?? undefined,
    quoteBlocks: quoteBlocks.slice(0, 2),
    timeline,
    completed: [],
  };
}

/** Direction-first magazine; Oracle localStorage overrides hero/editorial/timeline merge. */
export function mergeMagazineView(
  direction: DirectionContextData,
  oracleOverride: ScheduleViewData | null,
): ScheduleViewData {
  const base = buildMagazineFromDirection(direction);
  if (!oracleOverride) return base;

  const mergedTimeline = oracleOverride.timeline?.length
    ? oracleOverride.timeline
    : base.timeline;

  return sweepPastEventsInState(
    {
      ...base,
      hero: oracleOverride.hero ?? base.hero,
      editorialIntro: oracleOverride.editorialIntro || base.editorialIntro,
      quoteBlocks: oracleOverride.quoteBlocks?.length ? oracleOverride.quoteBlocks : base.quoteBlocks,
      timeline: mergedTimeline,
      completed: oracleOverride.completed ?? [],
      generatedAt: oracleOverride.generatedAt || base.generatedAt,
      id: oracleOverride.id || base.id,
    },
    new Date(),
  );
}
