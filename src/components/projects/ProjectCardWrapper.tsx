import { Dispatch, SetStateAction } from 'react';
import ProjectCard from './ProjectCard';
import { ProjectStats, ProjectRow, GoalKpiRow, PillarId } from './projectUtils';
import { ProjectCheckpoint } from '../../lib/projects/projects';
import { TodoItemRow } from '../../lib/todo/todo';

interface ProjectCardWrapperProps {
  project: ProjectRow;
  expandedId: string | null;
  setExpandedId: (fn: (prev: string | null) => string | null) => void;
  stats: Record<string, ProjectStats>;
  checkpointsByProject: Record<string, ProjectCheckpoint[]>;
  kpisByProject: Record<string, GoalKpiRow[]>;
  busy: boolean;
  // edit project
  editingProjectId: string | null;
  editForm: { name: string; goal: string; deadline: string; color: string; primary_skill_id: string };
  setEditForm: Dispatch<SetStateAction<{ name: string; goal: string; deadline: string; color: string; primary_skill_id: string }>>;
  startEditProject: (project: ProjectRow) => void;
  setEditingProjectId: (id: string | null) => void;
  handleSaveProject: (project: ProjectRow) => void;
  // checkpoints
  newCheckpoint: { projectId: string; title: string; due_date: string } | null;
  setNewCheckpoint: Dispatch<SetStateAction<{ projectId: string; title: string; due_date: string } | null>>;
  handleAddCheckpoint: (projectId: string) => void;
  handleToggleCheckpoint: (cp: ProjectCheckpoint) => void;
  deleteCheckpoint: (id: string) => void;
  // kpis
  editingKpiId: string | null;
  setEditingKpiId: (id: string | null) => void;
  handleUpdateKpiValue: (kpiId: string, raw: string) => void;
  // tasks
  handleToggleTask: (item: TodoItemRow) => void;
  newTask: { projectId: string; title: string; recurrence: string } | null;
  setNewTask: Dispatch<SetStateAction<{ projectId: string; title: string; recurrence: string } | null>>;
  handleAddTask: (project: ProjectRow, section: { id: string } | null) => void;
  // status
  handleStatusCycle: (project: ProjectRow) => void;
  updateProjectStatus: (project: ProjectRow, status: string) => void;
  handleDelete: (id: string) => void;
  // misc
  userId: string;
  parentSkills: { id: string; label: string }[];
  projectPillar: (project: ProjectRow) => PillarId | null;
}

export function ProjectCardWrapper({ project, expandedId, setExpandedId, stats, checkpointsByProject, kpisByProject, busy, editingProjectId, editForm, setEditForm, startEditProject, setEditingProjectId, handleSaveProject, newCheckpoint, setNewCheckpoint, handleAddCheckpoint, handleToggleCheckpoint, deleteCheckpoint, editingKpiId, setEditingKpiId, handleUpdateKpiValue, handleToggleTask, newTask, setNewTask, handleAddTask, handleStatusCycle, updateProjectStatus, handleDelete, userId, parentSkills, projectPillar }: ProjectCardWrapperProps) {
  const s = stats[project.id];
  const isExpanded = expandedId === project.id;
  const projectCheckpoints = checkpointsByProject[project.id] ?? [];
  const doneCheckpoints = projectCheckpoints.filter(cp => cp.status === 'done').length;

  return (
    <ProjectCard
      key={project.id}
      project={project}
      s={s}
      isExpanded={isExpanded}
      setExpandedId={setExpandedId}
      projectPillar={projectPillar}
      projectCheckpoints={projectCheckpoints}
      doneCheckpoints={doneCheckpoints}
      busy={busy}
      kpisByProject={kpisByProject}
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
      editingKpiId={editingKpiId}
      setEditingKpiId={setEditingKpiId}
      handleUpdateKpiValue={handleUpdateKpiValue}
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
  );
}
