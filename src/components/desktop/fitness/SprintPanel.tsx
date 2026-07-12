import type { getSprintInfo } from '../../../lib/growth/sprintUtils';
import type { sprintMetrics } from '../desktopUtils';
import type { GoalsRow, SprintGoalRow } from '../shell/useDesktopData';

interface ProjectMetrics {
  doneInSprint: number;
  inProgress: number;
  blocked: number;
  activeProjects: number;
}

export interface SprintPanelProps {
  sprint: ReturnType<typeof getSprintInfo>;
  sprintGoal: SprintGoalRow | null;
  onSave: (goalText: string) => Promise<void>;
  metrics: ReturnType<typeof sprintMetrics>;
  prevMetrics: ReturnType<typeof sprintMetrics>;
  projectMetrics: ProjectMetrics;
  goals: GoalsRow | null;
  currentWeight: number | null;
  weight30ago: number | null;
}
