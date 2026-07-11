import { AlertTriangle, Edit3, Plus, Save, Trash2, CalendarDays, Flag, Check, Repeat2, X, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ProjectCheckpoint } from '../../lib/projects/projects';
import { TodoItemRow } from '../../lib/todo/todo';
import {
  COLORS, PILLAR_META, STATUS_LABEL, PillarId, ProjectStats, ProjectRow, GoalKpiRow,
  calculateHealthScore, getHealthLevel, HEALTH_COLORS, getNextAction, getProjectMomentum
} from './projectUtils';
import ProjectEvidenceStrip from './ProjectEvidenceStrip';

const RECURRENCE_CYCLE = ['', 'daily', 'weekly', 'monthly'] as const;
const RECURRENCE_LABEL: Record<string, string> = { '': 'Jednorazowe', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' };

interface ProjectCardExpandedProps {
  project: ProjectRow;
  s: ProjectStats;
  col: ReturnType<typeof import('./projectUtils').colorOf>;
  pillar: PillarId | null;
  kpis: GoalKpiRow[];
  healthScore: number;
  healthLevel: 'critical' | 'at-risk' | 'ok' | 'great';
  healthColors: { bg: string; text: string };
  momentum: string;
  momentumMeta: { label: string; cls: string };
  nextAction: string | null;
  visibleCps: ProjectCheckpoint[];
  projectCheckpoints: ProjectCheckpoint[];
  doneCheckpoints: number;
  busy: boolean;

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
  editingKpiId__inline: string | null;
  setEditingKpiId__inline: (id: string | null) => void;
  handleUpdateKpiValue__inline: (kpiId: string, raw: string) => void;
}

export default function ProjectCardExpanded({
  project, s, col, pillar, kpis, healthScore, healthLevel, healthColors,
  momentum, momentumMeta, nextAction, visibleCps, projectCheckpoints, doneCheckpoints, busy,
  editingProjectId, editForm, setEditForm, startEditProject, setEditingProjectId, handleSaveProject,
  newCheckpoint, setNewCheckpoint, handleAddCheckpoint, handleToggleCheckpoint, deleteCheckpoint,
  editingKpiId, setEditingKpiId, handleUpdateKpiValue,
  handleToggleTask, newTask, setNewTask, handleAddTask,
  handleStatusCycle, updateProjectStatus, handleDelete, userId, parentSkills,
}: ProjectCardExpandedProps) {
  return (
    <div className="border-t border-border-custom/30 px-4 pb-4 pt-3 space-y-3">

      {/* Project metadata / edit form */}
      <div className="rounded-[14px] border border-border-custom/50 bg-surface-solid/30 p-3">
        {editingProjectId === project.id ? (
          <div className="space-y-3">
            <input
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-transparent text-[14px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
              placeholder="Nazwa projektu"
            />
            <textarea
              value={editForm.goal}
              onChange={e => setEditForm(f => ({ ...f, goal: e.target.value }))}
              rows={2}
              className="w-full resize-none rounded-[10px] border border-border-custom/50 bg-background/60 px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-primary/30"
              placeholder="Cel / opis projektu... (kim staję się realizując ten cel?)"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={editForm.deadline}
                onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))}
                className="min-w-0 flex-1 rounded-[10px] border border-border-custom/50 bg-background/60 px-3 py-2 text-[12px] font-medium text-text-secondary outline-none focus:border-primary/30"
              />
              <div className="flex gap-1">
                {COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setEditForm(f => ({ ...f, color: c.id }))}
                    className={`h-6 w-6 rounded-full ${c.dot} transition-transform ${editForm.color === c.id ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface ring-current' : 'opacity-45 hover:opacity-80'}`}
                    title={c.id}
                  />
                ))}
              </div>
            </div>
            {parentSkills.length > 0 && (
              <div>
                <label className="text-[9px] font-black uppercase tracking-wider text-text-muted">Skill główny</label>
                <select
                  value={editForm.primary_skill_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, primary_skill_id: e.target.value }))}
                  className="mt-1 w-full rounded-[10px] border border-border-custom/50 bg-background/60 px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-primary/30"
                >
                  <option value="">— brak —</option>
                  {parentSkills.map((sk) => (
                    <option key={sk.id} value={sk.id}>{sk.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingProjectId(null)}
                className="rounded-full bg-surface-solid px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:text-text-secondary"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleSaveProject(project)}
                disabled={busy || !editForm.name.trim()}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                <Save size={11} /> Zapisz
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Cel projektu</p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${healthColors.bg} ${healthColors.text}`}>
                  Health {healthScore}
                </span>
              </div>
              {project.goal ? (
                <p className="text-[12px] leading-relaxed text-text-secondary italic">"{project.goal}"</p>
              ) : (
                <p className="text-[12px] text-text-muted/50">Brak opisu celu.</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                  project.deadline
                    ? s.daysLeft !== null && s.daysLeft < 0
                      ? 'bg-rose-500/10 text-rose-500'
                      : 'bg-primary/10 text-primary'
                    : 'bg-surface-solid text-text-muted'
                }`}>
                  <CalendarDays size={11} />
                  {project.deadline
                    ? `${format(new Date(project.deadline + 'T00:00:00'), 'dd.MM.yyyy')}${s.daysLeft !== null ? ` · ${s.daysLeft < 0 ? `${Math.abs(s.daysLeft)}d po` : `${s.daysLeft}d`}` : ''}`
                    : 'Brak daty zakończenia'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-solid px-2 py-1 text-[10px] font-semibold text-text-muted">
                  <Flag size={11} /> {doneCheckpoints}/{projectCheckpoints.length} checkpointów
                </span>
              </div>
            </div>
            <button
              onClick={() => startEditProject(project)}
              className="rounded-full p-2 text-text-muted hover:bg-surface-solid hover:text-text-primary"
              title="Edytuj projekt"
            >
              <Edit3 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Next action highlight */}
      {nextAction && (
        <div className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 ${col.bar.replace('bg-', 'bg-').replace('-500', '-500/8')} border ${col.dot.replace('bg-', 'border-').replace('-500', '-500/20')}`}>
          <Zap size={12} className={col.text} />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-0.5">Next Action</p>
            <p className="text-[12px] font-semibold text-text-primary truncate">{nextAction}</p>
          </div>
        </div>
      )}

      {/* Checkpoints */}
      <div className="rounded-[14px] border border-border-custom/50 bg-surface-solid/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Checkpointy</p>
          {newCheckpoint?.projectId !== project.id && (
            <button
              onClick={() => setNewCheckpoint({ projectId: project.id, title: '', due_date: '' })}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary"
            >
              <Plus size={11} /> Dodaj
            </button>
          )}
        </div>
        {projectCheckpoints.length > 0 && (
          <div className="space-y-1">
            {projectCheckpoints.map(cp => (
              <div key={cp.id} className="flex items-center gap-2 rounded-[10px] px-1.5 py-1.5 hover:bg-background/40">
                <button
                  onClick={() => handleToggleCheckpoint(cp)}
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                    cp.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border-custom text-transparent'
                  }`}
                >
                  <Check size={10} strokeWidth={3} />
                </button>
                <span className={`min-w-0 flex-1 truncate text-[12px] ${cp.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary'}`}>{cp.title}</span>
                {cp.due_date && (
                  <span className="shrink-0 text-[10px] font-semibold text-text-muted">
                    {format(new Date(cp.due_date + 'T00:00:00'), 'dd.MM')}
                  </span>
                )}
                <button
                  onClick={() => deleteCheckpoint(cp.id)}
                  className="shrink-0 rounded-full p-1 text-text-muted/35 hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        {newCheckpoint?.projectId === project.id ? (
          <div className="rounded-[12px] border border-border-custom/50 bg-background/50 p-2 space-y-2">
            <input
              autoFocus
              value={newCheckpoint!.title}
              onChange={e => setNewCheckpoint(cp => cp ? { ...cp, title: e.target.value } : cp)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddCheckpoint(project.id); }
                if (e.key === 'Escape') setNewCheckpoint(null);
              }}
              className="w-full bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted/40"
              placeholder="Nazwa checkpointu..."
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newCheckpoint!.due_date}
                onChange={e => setNewCheckpoint(cp => cp ? { ...cp, due_date: e.target.value } : cp)}
                className="min-w-0 flex-1 rounded-[9px] border border-border-custom/50 bg-surface px-2.5 py-1.5 text-[11px] text-text-secondary outline-none"
              />
              <button onClick={() => setNewCheckpoint(null)} className="rounded-full p-1.5 text-text-muted hover:text-text-secondary">
                <X size={13} />
              </button>
              <button
                onClick={() => handleAddCheckpoint(project.id)}
                disabled={!newCheckpoint!.title.trim() || busy}
                className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-30"
              >
                Dodaj
              </button>
            </div>
          </div>
        ) : projectCheckpoints.length === 0 ? (
          <p className="text-[12px] text-text-muted/45">Brak checkpointów.</p>
        ) : null}
      </div>

      {/* Task list */}
      <div className="space-y-1">
        {s.openItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleToggleTask(item)}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface-solid/60 transition-colors text-left"
          >
            <div className="h-[18px] w-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-all border-border-custom">
              <div className="h-1.5 w-1.5 rounded-full bg-transparent" />
            </div>
            <span className="flex-1 truncate text-[13px] text-text-primary">{item.title}</span>
            {item.recurrence && <Repeat2 size={10} className="shrink-0 text-violet-400" />}
          </button>
        ))}
        {s.doneItems.slice(0, 2).map((item) => (
          <button
            key={item.id}
            onClick={() => handleToggleTask(item)}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface-solid/60 transition-colors text-left opacity-35"
          >
            <div className="h-[18px] w-[18px] shrink-0 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check size={10} className="text-white" strokeWidth={3} />
            </div>
            <span className="flex-1 truncate text-[13px] line-through text-text-muted">{item.title}</span>
          </button>
        ))}
        {s.total === 0 && newTask?.projectId !== project.id && (
          <p className="text-[12px] text-text-muted/40 px-2 py-1">Brak zadań. Dodaj pierwsze poniżej.</p>
        )}
      </div>

      {/* Inline new task */}
      {newTask?.projectId === project.id ? (
        <div className="rounded-[12px] border border-border-custom/50 bg-surface-solid/40 px-3 py-2 space-y-2">
          <input
            autoFocus
            value={newTask!.title}
            onChange={e => setNewTask(t => t ? { ...t, title: e.target.value } : t)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddTask(project, s.section); }
              if (e.key === 'Escape') setNewTask(null);
            }}
            placeholder="Nowe zadanie..."
            className="w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted/40"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewTask(t => t ? { ...t, recurrence: RECURRENCE_CYCLE[(RECURRENCE_CYCLE.indexOf(t.recurrence as typeof RECURRENCE_CYCLE[number]) + 1) % RECURRENCE_CYCLE.length] } : t)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${newTask!.recurrence ? 'bg-violet-500/15 text-violet-500' : 'bg-surface-solid text-text-muted hover:text-text-secondary'}`}
            >
              <Repeat2 size={10} /> {RECURRENCE_LABEL[newTask!.recurrence]}
            </button>
            <div className="flex-1" />
            <button onClick={() => setNewTask(null)} className="text-text-muted hover:text-text-secondary">
              <X size={13} />
            </button>
            <button
              onClick={() => handleAddTask(project, s.section)}
              disabled={!newTask!.title.trim() || busy}
              className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-30"
            >
              Dodaj
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setNewTask({ projectId: project.id, title: '', recurrence: '' })}
          className="flex w-full items-center gap-2 rounded-[12px] border border-dashed border-border-custom/60 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary hover:border-border-custom transition-colors"
        >
          <Plus size={13} /> Dodaj zadanie
        </button>
      )}

      {/* Footer actions */}
      <ProjectEvidenceStrip userId={userId} projectId={project.id} />

      <div className="flex items-center gap-2 pt-0.5">
        <div className="flex gap-1">
          {(['active', 'paused', 'done'] as const).map(st => (
            <button
              key={st}
              disabled={busy}
              onClick={() => {
                if (project.status === st) return;
                if (st === 'done') handleStatusCycle(project);
                else updateProjectStatus(project, st);
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                project.status === st
                  ? 'bg-primary/15 text-primary'
                  : 'bg-surface-solid text-text-muted hover:text-text-secondary'
              }`}
            >
              {STATUS_LABEL[st]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => handleDelete(project.id)}
          disabled={busy}
          className="rounded-full p-1.5 text-text-muted/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
