import { ProjectCheckpoint } from '../../lib/projects/projects';
import { TodoItemRow } from '../../lib/todo/todo';
import {
  colorOf, PILLAR_META, PillarId, ProjectStats, ProjectRow, GoalKpiRow,
  calculateHealthScore, getHealthLevel, HEALTH_COLORS, getNextAction, getProjectMomentum
} from './projectUtils';
import ProjectCardExpanded from './ProjectCardExpanded';
import ProjectCardCollapsed from './ProjectCardCollapsed';

const MOMENTUM_META = {
  accelerating: { label: '↑ Momentum', cls: 'text-emerald-500 bg-emerald-500/10' },
  steady:       { label: '→ Steady',   cls: 'text-blue-500 bg-blue-500/10' },
  slipping:     { label: '↓ Slipuje',  cls: 'text-amber-500 bg-amber-500/10' },
  stalled:      { label: '✕ Stale',   cls: 'text-rose-500 bg-rose-500/10' },
};

interface ProjectCardProps {
  project: ProjectRow;
  s: ProjectStats;
  isExpanded: boolean;
  setExpandedId: (updater: (prev: string | null) => string | null) => void;
  projectPillar: (project: ProjectRow) => PillarId | null;
  projectCheckpoints: ProjectCheckpoint[];
  doneCheckpoints: number;
  busy: boolean;
  kpisByProject: Record<string, GoalKpiRow[]>;

  editingProjectId: string | null;
  editForm: { name: string; goal: string; deadline: string; color: string; primary_skill_id: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ name: string; goal: string; deadline: string; color: string; primary_skill_id: string }>>;
  startEditProject: (project: ProjectRow) => void;
  setEditingProjectId: (id: string | null) => void;
  handleSaveProject: (project: ProjectRow) => void;

  newCheckpoint: { projectId: string; title: string; due_date: string } | null;
  setNewCheckpoint: React.Dispatch<React.SetStateAction<{ projectId: string; title: string; due_date: string } | null>>;
  handleAddCheckpoint: (projectId: string) => void;
  handleToggleCheckpoint: (checkpoint: ProjectCheckpoint) => void;
  deleteCheckpoint: (id: string) => void;

  editingKpiId: string | null;
  setEditingKpiId: (id: string | null) => void;
  handleUpdateKpiValue: (kpiId: string, raw: string) => void;

  handleToggleTask: (item: TodoItemRow) => void;
  newTask: { projectId: string; title: string; recurrence: string } | null;
  setNewTask: React.Dispatch<React.SetStateAction<{ projectId: string; title: string; recurrence: string } | null>>;
  handleAddTask: (project: ProjectRow, section: { id: string } | null) => void;

  handleStatusCycle: (project: ProjectRow) => void;
  updateProjectStatus: (project: ProjectRow, status: string) => void;
  handleDelete: (id: string) => void;
  userId: string;
  parentSkills: { id: string; label: string }[];
}

export default function ProjectCard({
  project, s, isExpanded, setExpandedId, projectPillar,
  projectCheckpoints, doneCheckpoints, busy, kpisByProject,
  editingProjectId, editForm, setEditForm, startEditProject,
  setEditingProjectId, handleSaveProject,
  newCheckpoint, setNewCheckpoint, handleAddCheckpoint,
  handleToggleCheckpoint, deleteCheckpoint,
  editingKpiId, setEditingKpiId, handleUpdateKpiValue,
  handleToggleTask, newTask, setNewTask, handleAddTask,
  handleStatusCycle, updateProjectStatus, handleDelete, userId, parentSkills,
}: ProjectCardProps) {
  const col = colorOf(project.color);
  const pillar = projectPillar(project);
  const pm = pillar ? PILLAR_META[pillar] : null;
  const kpis = kpisByProject[project.id] ?? [];
  const healthScore = calculateHealthScore(project, s, kpis);
  const healthLevel = getHealthLevel(healthScore);
  const healthColors = HEALTH_COLORS[healthLevel];
  const momentum = getProjectMomentum(s);
  const nextAction = getNextAction(s.openItems);
  const momentumMeta = MOMENTUM_META[momentum];

  // Checkpoint mini-timeline (show up to 5)
  const visibleCps = projectCheckpoints.slice(0, 5);

  return (
    <div
      className={`rounded-[22px] border bg-surface overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.10)] ${
        healthLevel === 'critical' && project.status === 'active'
          ? 'border-rose-500/30 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]'
          : 'border-border-custom shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)]'
      }`}
    >
      {/* Color accent strip */}
      <div className={`h-0.5 w-full ${col.bar} opacity-70`} />

      {/* Collapsed Card header */}
      <ProjectCardCollapsed
        project={project}
        s={s}
        isExpanded={isExpanded}
        setExpandedId={setExpandedId}
        col={col}
        pm={pm}
        momentumMeta={momentumMeta}
        healthScore={healthScore}
        kpis={kpis}
        editingKpiId={editingKpiId}
        setEditingKpiId={setEditingKpiId}
        handleUpdateKpiValue={handleUpdateKpiValue}
        visibleCps={visibleCps}
        doneCheckpoints={doneCheckpoints}
        projectCheckpoints={projectCheckpoints}
        nextAction={nextAction}
        userId={userId}
      />

      {/* ── EXPANDED SECTION ── */}
      {isExpanded && (
        <ProjectCardExpanded
          project={project}
          s={s}
          col={col}
          healthScore={healthScore}
          healthColors={healthColors}
          nextAction={nextAction}
          projectCheckpoints={projectCheckpoints}
          doneCheckpoints={doneCheckpoints}
          busy={busy}
          editingProjectId={editingProjectId}
          editForm={editForm}
          setEditForm={setEditForm}
          startEditProject={startEditProject}
          setEditingProjectId={setEditingProjectId}
          handleSaveProject={handleSaveProject}
          newCheckpoint={newCheckpoint}
          setNewCheckpoint={setNewCheckpoint}
          handleAddCheckpoint={handleAddCheckpoint}
          handleToggleCheckpoint={handleToggleCheckpoint}
          deleteCheckpoint={deleteCheckpoint}
          handleToggleTask={handleToggleTask}
          newTask={newTask}
          setNewTask={setNewTask}
          handleAddTask={handleAddTask}
          handleStatusCycle={handleStatusCycle}
          updateProjectStatus={updateProjectStatus}
          handleDelete={handleDelete}
          userId={userId}
          parentSkills={parentSkills}
        />
      )}
    </div>
  );
}
