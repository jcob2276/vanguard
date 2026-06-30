import { describe, expect, it } from 'vitest';

import {

  dayWinStateFromRow,

  deriveSpineGuidance,

  type SpineGuideContext,

} from './goalSpineGuide';

import type { GoalSpine } from './goalSpine';



const baseSpine = (): GoalSpine => ({

  weekStart: '2026-06-23',

  sprint: {

    personalYear: 2026,

    sprintNumber: 2,

    weekInSprint: 3,

    dayInSprint: 14,

    daysLeft: 70,

    pct: 17,

    sprintStart: '2026-06-01',

    sprintEnd: '2026-08-23',

    prevStart: null,

    prevEnd: null,

    goalText: 'Zbudować pipeline',

    label: 'Sprint 2',

    isClosingWeek: false,

  },

  week: {

    intention: null,

    commitment: null,

    cialo: 'Siłka 3x',

    duch: null,

    konto: null,

    weekStart: '2026-06-23',

    source: 'week',

    fallbackWeekStart: null,

  },

  longTerm: { declarations: null, projects: [] },

  kpiReview: null,

  sprintReview: null,

});



const readyCtx = (day?: SpineGuideContext['day']): SpineGuideContext => ({

  weeklyReview: { review_completed_at: '2026-06-22T10:00:00Z' } as SpineGuideContext['weeklyReview'],

  weekReflectionOverdueDays: 3,

  today: '2026-06-25',

  day: day ?? dayWinStateFromRow(null),

});



describe('deriveSpineGuidance', () => {

  it('prompts sprint goal when missing', () => {

    const spine = baseSpine();

    spine.sprint.goalText = null;

    const g = deriveSpineGuidance(spine, readyCtx());

    expect(g.readyForDay).toBe(false);

    expect(g.primaryAction).toEqual({

      type: 'navigate',

      target: 'dashboard',

      label: 'Ustaw cel sprintu',

    });

  });



  it('prompts plan day when stack ready and no plan', () => {

    const g = deriveSpineGuidance(baseSpine(), readyCtx());

    expect(g.readyForDay).toBe(true);

    expect(g.primaryCue).toContain('Siłka');

    expect(g.primaryAction).toEqual({ type: 'plan_day', label: 'Zaplanuj dzień' });

  });



  it('shows progress when day in flight', () => {

    const day = dayWinStateFromRow({

      task_1: 'Trening',

      done_1: true,

      task_2: 'Outreach',

      done_2: false,

    });

    const g = deriveSpineGuidance(baseSpine(), readyCtx(day));

    expect(g.primaryAction.type).toBe('focus_plan');

    expect(g.dayProgress).toEqual({ done: 1, total: 2 });

    expect(g.primaryCue).toContain('Outreach');

  });



  it('prompts sprint close on week 12', () => {

    const spine = baseSpine();

    spine.sprint.isClosingWeek = true;

    spine.sprint.weekInSprint = 12;

    const g = deriveSpineGuidance(spine, readyCtx());

    expect(g.primaryAction).toMatchObject({ type: 'navigate', target: 'dashboard' });

    expect(g.steps.some((s) => s.id === 'sprint_close' && s.status === 'now')).toBe(true);

  });



  it('does not nag about week reflection when it was recently completed for a prior week', () => {
    const g = deriveSpineGuidance(baseSpine(), {
      ...readyCtx(),
      weeklyReview: null,
      weekReflectionOverdueDays: 3,
    });
    expect(g.primaryCue).not.toContain('refleksji tygodnia');
  });



  it('marks day complete', () => {

    const day = dayWinStateFromRow({

      task_1: 'A',

      done_1: true,

      task_2: 'B',

      done_2: true,

    });

    const g = deriveSpineGuidance(baseSpine(), readyCtx(day));

    expect(g.primaryAction.type).toBe('none');

    expect(g.primaryCue).toContain('domknięty');

    expect(g.steps.find((s) => s.id === 'day')?.status).toBe('done');

  });

});



describe('dayWinStateFromRow', () => {

  it('detects yesterday gate', () => {

    const d = dayWinStateFromRow(null, true);

    expect(d.yesterdayReflectionNeeded).toBe(true);

    expect(d.hasPlan).toBe(false);

  });

});


