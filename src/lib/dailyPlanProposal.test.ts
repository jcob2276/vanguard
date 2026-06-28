import { describe, expect, it } from 'vitest';
import { buildDailyPlanProposal, type DirectionContextData } from './dailyPlanProposal';

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
  focus: { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
  weekCheckpointsDone: 0,
  weekCheckpointsDue: 1,
  skills: [],
});

describe('buildDailyPlanProposal', () => {
  it('prioritizes overdue checkpoints then MUST then week goals', () => {
    const slots = buildDailyPlanProposal(baseCtx());
    expect(slots[0].task).toBe('Plan treningowy');
    expect(slots[0].checkpointId).toBe('cp1');
    expect(slots[1].task).toBe('Nagraj pitch');
    expect(slots[1].pinId).toBe('pin1');
    expect(slots[2].task).toBe('Siłownia 2x');
    expect(slots[3].task).toBe('Oddzwoń do klienta');
    expect(slots[3].todoId).toBe('t1');
  });
});
