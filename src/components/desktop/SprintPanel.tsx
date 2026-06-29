export interface SprintPanelProps {
  sprint: any;
  sprintGoal: any;
  onSave: (goalText: string) => Promise<void>;
  metrics: any;
  prevMetrics: any;
  projectMetrics: any;
  goals: any;
  currentWeight: number | null;
  weight30ago: number | null;
}
