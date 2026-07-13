import { createContext, useContext } from 'react';
import { useProjectsData, ProjectRow, GoalKpiRow, DreamRow } from '../useProjectsData';
import { useProjectHandlers } from '../useProjectHandlers';
import { PillarId, ProjectStats } from '../projectUtils';
import { ProjectCheckpoint } from '../../../lib/projects/projects';

export type PillarFilter = PillarId | 'all';

type ProjectsData = ReturnType<typeof useProjectsData>;

export interface ProjectsContextType {
  // states & loading
  projects: ProjectRow[];
  sections: ProjectsData['sections'];
  items: ProjectsData['items'];
  checkpoints: ProjectCheckpoint[];
  dreams: DreamRow[];
  lifeGoals: ProjectsData['lifeGoals'];
  kpis: GoalKpiRow[];
  parentSkills: { id: string; label: string }[];
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  busy: boolean;
  expandedId: string | null;
  setExpandedId: React.Dispatch<React.SetStateAction<string | null>>;
  editingProjectId: string | null;
  setEditingProjectId: (id: string | null) => void;
  editForm: { name: string; goal: string; deadline: string; color: string; primary_skill_id: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ name: string; goal: string; deadline: string; color: string; primary_skill_id: string }>>;
  newTask: { projectId: string; title: string; recurrence: string } | null;
  setNewTask: React.Dispatch<React.SetStateAction<{ projectId: string; title: string; recurrence: string } | null>>;
  newCheckpoint: { projectId: string; title: string; due_date: string } | null;
  setNewCheckpoint: React.Dispatch<React.SetStateAction<{ projectId: string; title: string; due_date: string } | null>>;
  editingKpiId: string | null;
  setEditingKpiId: (id: string | null) => void;
  retroProject: ProjectRow | null;
  setRetroProject: (p: ProjectRow | null) => void;
  retroForm: { good: string; improve: string; rating: number };
  setRetroForm: React.Dispatch<React.SetStateAction<{ good: string; improve: string; rating: number }>>;
  setItems: ProjectsData['setItems'];
  setSections: ProjectsData['setSections'];
  run: ProjectsData['run'];

  // handlers
  handlers: ReturnType<typeof useProjectHandlers>;

  // filter & modal states
  pillarFilter: PillarFilter;
  setPillarFilter: React.Dispatch<React.SetStateAction<PillarFilter>>;
  pausedOpen: boolean;
  setPausedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  doneOpen: boolean;
  setDoneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showForm: boolean;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  form: { name: string; goal: string; deadline: string; color: string; dream_id: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; goal: string; deadline: string; color: string; dream_id: string }>>;
  goalCreateOpen: boolean;
  setGoalCreateOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // derived data
  dreamById: Record<string, DreamRow>;
  stats: Record<string, ProjectStats>;
  checkpointsByProject: Record<string, ProjectCheckpoint[]>;
  kpisByProject: Record<string, GoalKpiRow[]>;
  projectPillar: (project: ProjectRow) => PillarId | null;
  activeFiltered: ProjectRow[];
  pausedFiltered: ProjectRow[];
  doneFiltered: ProjectRow[];
  activeProjects: ProjectRow[];
  directionalGoalCount: number;
  focusProject: ProjectRow | null;
  userId: string;
}

export const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function useProjectsContext() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjectsContext must be used within a ProjectsProvider');
  }
  return context;
}
