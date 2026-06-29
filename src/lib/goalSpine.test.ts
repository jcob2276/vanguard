import { describe, expect, it } from 'vitest';
import {
  isSprintClosingWeek,
  resolveWeekGoals,
  strategicGapsFromSpine,
  weekGoalsAreEmpty,
  weekGoalsFromReview,
  type GoalSpine,
} from './goalSpine';

describe('goalSpine week goals', () => {
  it('uses current week row when populated', () => {
    const result = resolveWeekGoals(
      '2026-06-23',
      {
        week_start: '2026-06-23',
        week_intention: 'Kontakt',
        week_commitment: null,
        week_goal_cialo: 'Siłka',
        week_goal_duch: null,
        week_goal_konto: null,
      },
      null,
    );
    expect(result.source).toBe('week');
    expect(result.cialo).toBe('Siłka');
    expect(result.fallbackWeekStart).toBeNull();
  });

  it('falls back when current week empty and fallback provided', () => {
    const result = resolveWeekGoals(
      '2026-06-23',
      {
        week_start: '2026-06-23',
        week_intention: null,
        week_commitment: null,
        week_goal_cialo: null,
        week_goal_duch: null,
        week_goal_konto: null,
      },
      {
        week_start: '2026-06-16',
        week_intention: null,
        week_commitment: null,
        week_goal_cialo: 'Poprzedni tydzień',
        week_goal_duch: null,
        week_goal_konto: null,
      },
    );
    expect(result.source).toBe('fallback');
    expect(result.cialo).toBe('Poprzedni tydzień');
    expect(result.fallbackWeekStart).toBe('2026-06-16');
  });

  it('empty when no rows', () => {
    const goals = weekGoalsFromReview(null);
    expect(weekGoalsAreEmpty(goals)).toBe(true);
    const result = resolveWeekGoals('2026-06-23', null, null);
    expect(result.source).toBe('empty');
  });

  it('strategic gaps from spine projects and declarations', () => {
    const spine: GoalSpine = {
      weekStart: '2026-06-23',
      sprint: { weekInSprint: 3, isClosingWeek: false } as GoalSpine['sprint'],
      week: { intention: null, commitment: null, cialo: null, duch: null, konto: null, weekStart: '2026-06-23', source: 'empty', fallbackWeekStart: null },
      kpiReview: null,
      sprintReview: null,
      longTerm: {
        declarations: { goal_cialo: 'BHAG ciało', goal_duch: null, goal_konto: null, date_cialo: null, date_duch: null, date_konto: null, bhag_pillar: null },
        projects: [
          {
            id: 'duch',
            goalKey: 'goal_duch',
            dateKey: 'date_duch',
            label: 'Duch',
            title: 'Projekt bez KPI',
            icon: {} as never,
            card: '',
            text: '',
            badge: '',
            source: 'project',
            projectId: 'p1',
            kpis: [],
          },
        ],
      },
    };
    const gaps = strategicGapsFromSpine(
      spine,
      [{ id: 'd1', title: 'Sen marzeń' }],
      new Set(),
    );
    expect(gaps.projects_without_kpi).toEqual(['Projekt bez KPI']);
    expect(gaps.pillars_with_declaration_no_active_project).toEqual(['cialo']);
    expect(gaps.dreams_without_active_project).toEqual(['Sen marzeń']);
  });

  it('detects sprint closing week', () => {
    expect(isSprintClosingWeek({ weekInSprint: 12 })).toBe(true);
    expect(isSprintClosingWeek({ weekInSprint: 11 })).toBe(false);
  });
});
