import { describe, expect, it } from 'vitest';
import {
  buildDailyPlanProposal,
  defaultPillarProject,
  kpiSlotHint,
  suggestDailyKpiTarget,
  type DirectionContextData,
  type PillarProjectBinding,
} from './dailyPlanProposal';

const pillarBindings: PillarProjectBinding[] = [
  {
    pillar: 'cialo',
    projectId: 'p-gym',
    kpis: [{ id: 'k1', name: 'Treningi', current: 0, target: 3 }],
  },
];

const baseCtx = (): DirectionContextData => ({
  weekStart: '2026-06-23',
  weekGoals: { intention: null, commitment: null, cialo: 'Siłownia 2x', duch: null, konto: null },
  checkpoints: {
    all: [],
    overdue: [
      {
        id: 'cp1',
        project_id: 'p1',
        title: 'Plan treningowy',
        due_date: '2026-06-20',
        status: 'open',
        project: { id: 'p1', name: 'BF', color: 'emerald', pillar: 'cialo' },
        daysLate: 3,
        daysLeft: 0,
        isOverdue: true,
      },
    ],
    upcoming: [],
  },
  mustPins: [],
  openMustPins: [{ id: 'pin1', title: 'Nagraj pitch', projectId: 'p2', done: false, slot: 'must' }],
  urgentTodos: [{ id: 't1', title: 'Oddzwoń do klienta', priority: 'urgent', due_date: null, projectId: 'p2', projectName: 'Sprzedaż' }],
  activeProjects: [],
  powerListStats: { daysLogged: 0, daysWithWins: 0, tasksDone: 0, tasksSet: 0 },
  sprintGoal: null,
  sprintLabel: null,
  sprintFocusProjectIds: [],
  monthTheme: null,
  monthLabel: null,
  bhagLine: null,
  focus: { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
  weekCheckpointsDone: 0,
  weekCheckpointsDue: 1,
  skills: [],
});

describe('buildDailyPlanProposal', () => {
  it('prioritizes MUST then week goals then overdue then urgent', () => {
    const slots = buildDailyPlanProposal(baseCtx(), pillarBindings);
    expect(slots[0].task).toBe('Nagraj pitch');
    expect(slots[0].pinId).toBe('pin1');
    expect(slots[1].task).toBe('Siłownia 2x');
    expect(slots[1].projectId).toBe('p-gym');
    expect(slots[1].targetValue).toBe('1');
    expect(slots[2].task).toBe('Plan treningowy');
    expect(slots[2].checkpointId).toBe('cp1');
    expect(slots[3].task).toBe('Oddzwoń do klienta');
    expect(slots[3].todoId).toBe('t1');
  });

  it('suggests daily KPI chunk from weekly target', () => {
    expect(suggestDailyKpiTarget([{ id: 'k1', name: 'Diale', current: 0, target: 20 }])).toBe('4');
    expect(suggestDailyKpiTarget([{ id: 'k1', name: 'A', current: 0, target: 3 }])).toBe('1');
    expect(suggestDailyKpiTarget([])).toBeNull();
  });
});

describe('kpiSlotHint', () => {
  it('describes auto rollup for single KPI', () => {
    const h = kpiSlotHint([{ id: 'k1', name: 'Outreach', current: 0, target: 20 }]);
    expect(h.autoTarget).toBe('4');
    expect(h.rollupReady).toBe(true);
    expect(h.message).toContain('Outreach');
  });

  it('picks largest-gap KPI on multi-KPI projects', () => {
    const h = kpiSlotHint([
      { id: 'k1', name: 'A', current: 0, target: 10 },
      { id: 'k2', name: 'B', current: 0, target: 5 },
    ]);
    expect(h.autoTarget).toBe('2');
    expect(h.rollupReady).toBe(true);
    expect(h.message).toContain('A');
  });
});

describe('defaultPillarProject', () => {
  it('returns first binding for pillar', () => {
    expect(defaultPillarProject('cialo', pillarBindings)?.projectId).toBe('p-gym');
    expect(defaultPillarProject('duch', pillarBindings)).toBeNull();
  });
  it('prefers sprint focus project', () => {
    const bindings: PillarProjectBinding[] = [
      { pillar: 'konto', projectId: 'p-a', kpis: [] },
      { pillar: 'konto', projectId: 'p-b', kpis: [] },
    ];
    expect(defaultPillarProject('konto', bindings, ['p-b'])?.projectId).toBe('p-b');
  });
});
