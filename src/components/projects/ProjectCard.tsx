import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  Save,
  Trash2,
  CalendarDays,
  Flag,
  Check,
  Repeat2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ProjectCheckpoint } from '../../lib/projects';
import { COLORS, colorOf, PILLAR_META, STATUS_LABEL, PillarId } from './projectUtils';

const RECURRENCE_CYCLE = ['', 'daily', 'weekly', 'monthly'] as const;
const RECURRENCE_LABEL: Record<string, string> = { '': 'Jednorazowe', daily: 'Codziennie', weekly: 'Co tydzień', monthly: 'Co miesiąc' };

interface ProjectStats {
  section: any;
  openItems: any[];
  doneItems: any[];
  total: number;
  progress: number;
  lastActivity: Date | null;
  daysSince: number | null;
  slipping: boolean;
  daysLeft: number | null;
}

interface ProjectCardProps {
  project: any;
  s: ProjectStats;
  isExpanded: boolean;
  setExpandedId: (updater: (prev: string | null) => string | null) => void;
  projectPillar: (project: any) => PillarId | null;
  projectCheckpoints: ProjectCheckpoint[];
  doneCheckpoints: number;
  busy: boolean;

  editingProjectId: string | null;
  editForm: { name: string; goal: string; deadline: string; color: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ name: string; goal: string; deadline: string; color: string }>>;
  startEditProject: (project: any) => void;
  setEditingProjectId: (id: string | null) => void;
  handleSaveProject: (project: any) => void;

  newCheckpoint: { projectId: string; title: string; due_date: string } | null;
  setNewCheckpoint: React.Dispatch<React.SetStateAction<{ projectId: string; title: string; due_date: string } | null>>;
  handleAddCheckpoint: (projectId: string) => void;
  handleToggleCheckpoint: (checkpoint: ProjectCheckpoint) => void;
  deleteCheckpoint: (id: string) => void;

  kpisByProject: Record<string, any[]>;
  editingKpiId: string | null;
  setEditingKpiId: (id: string | null) => void;
  handleUpdateKpiValue: (kpiId: string, raw: string) => void;

  handleToggleTask: (item: any) => void;
  newTask: { projectId: string; title: string; recurrence: string } | null;
  setNewTask: React.Dispatch<React.SetStateAction<{ projectId: string; title: string; recurrence: string } | null>>;
  handleAddTask: (project: any, section: any) => void;

  handleStatusCycle: (project: any) => void;
  updateProjectStatus: (project: any, status: string) => void;
  handleDelete: (id: string) => void;
}

export default function ProjectCard({
  project,
  s,
  isExpanded,
  setExpandedId,
  projectPillar,
  projectCheckpoints,
  doneCheckpoints,
  busy,
  editingProjectId,
  editForm,
  setEditForm,
  startEditProject,
  setEditingProjectId,
  handleSaveProject,
  newCheckpoint,
  setNewCheckpoint,
  handleAddCheckpoint,
  handleToggleCheckpoint,
  deleteCheckpoint,
  kpisByProject,
  editingKpiId,
  setEditingKpiId,
  handleUpdateKpiValue,
  handleToggleTask,
  newTask,
  setNewTask,
  handleAddTask,
  handleStatusCycle,
  updateProjectStatus,
  handleDelete,
}: ProjectCardProps) {
  const col = colorOf(project.color);

  return (
    <div
      className="rounded-[24px] border border-border-custom bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.07),0_2px_14px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
    >
      {/* Card header */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpandedId(p => p === project.id ? null : project.id)}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${col.dot}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-text-primary leading-tight">{project.name}</span>
              {(() => {
                const pillar = projectPillar(project);
                if (!pillar) return null;
                const meta = PILLAR_META[pillar];
                return (
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                    {meta.label}
                  </span>
                );
              })()}
              {s.slipping && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={9} /> Slipuje {s.daysSince}d
                </span>
              )}
            </div>
            {project.goal && (
              <p className="mt-0.5 text-[12px] text-text-muted line-clamp-1">{project.goal}</p>
            )}
            {!isExpanded && s.openItems[0] && (
              <p className="mt-1 text-[11px] text-text-muted/60 line-clamp-1">
                → {s.openItems[0].title}
              </p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {s.daysLeft !== null && (
              <span className={`text-[11px] font-semibold ${
                s.daysLeft < 0 ? 'text-rose-500' : s.daysLeft <= 14 ? 'text-amber-500' : 'text-text-muted'
              }`}>
                {s.daysLeft < 0 ? `${Math.abs(s.daysLeft)}d po` : `${s.daysLeft}d`}
              </span>
            )}
            {isExpanded ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
          </div>
        </div>

        {/* Progress bars */}
        <div className="mt-3 space-y-2">
          {s.total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-text-muted">{s.doneItems.length}/{s.total} zadań</span>
                <span className={`text-[10px] font-semibold ${col.text}`}>{s.progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border-custom/50">
                <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${s.progress}%` }} />
              </div>
            </div>
          )}
          {projectCheckpoints.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-text-muted">{doneCheckpoints}/{projectCheckpoints.length} checkpointów</span>
                <span className={`text-[10px] font-semibold ${col.text}`}>
                  {Math.round((doneCheckpoints / projectCheckpoints.length) * 100)}%
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-border-custom/50">
                <div
                  className={`h-full rounded-full transition-all ${col.bar} opacity-60`}
                  style={{ width: `${Math.round((doneCheckpoints / projectCheckpoints.length) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* KPI inline edit */}
        {(kpisByProject[project.id] ?? []).length > 0 && (
          <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
            {(kpisByProject[project.id] ?? []).map(kpi => {
              const pct = kpi.target != null && kpi.current_value != null
                ? Math.min(100, Math.round((Number(kpi.current_value) / Number(kpi.target)) * 100)) : null;
              const isEditing = editingKpiId === kpi.id;
              return (
                <div key={kpi.id} className="space-y-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${col.dot}`} />
                    <span className="text-[10px] text-text-muted truncate flex-1">{kpi.name}</span>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        defaultValue={kpi.current_value ?? ''}
                        onBlur={e => handleUpdateKpiValue(kpi.id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateKpiValue(kpi.id, (e.target as HTMLInputElement).value);
                          if (e.key === 'Escape') setEditingKpiId(null);
                        }}
                        className="w-16 rounded-lg border border-primary/40 bg-background/80 px-2 py-0.5 text-[11px] font-bold text-primary outline-none text-center"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingKpiId(kpi.id)}
                        className={`text-[11px] font-black ${col.text} hover:underline cursor-pointer`}
                        title="Kliknij żeby edytować"
                      >
                        {kpi.current_value != null ? kpi.current_value : '—'}
                        {kpi.unit ? ` ${kpi.unit}` : ''}
                        {kpi.target != null && <span className="font-normal text-text-muted/60"> / {kpi.target}</span>}
                      </button>
                    )}
                    {pct !== null && !isEditing && (
                      <span className="text-[9px] font-bold text-text-muted/60 shrink-0">{pct}%</span>
                    )}
                  </div>
                  {pct !== null && (
                    <div className="ml-3 h-1 w-full rounded-full bg-border-custom overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${col.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border-custom/30 px-4 pb-4 pt-3 space-y-3">
          {/* Project metadata */}
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
                  placeholder="Cel / opis projektu..."
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Szczegóły projektu</p>
                  {project.goal ? (
                    <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{project.goal}</p>
                  ) : (
                    <p className="mt-1 text-[12px] text-text-muted/50">Brak opisu celu.</p>
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
            {s.openItems.map((item: any) => (
              <button
                key={item.id}
                onClick={() => handleToggleTask(item)}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface-solid/60 transition-colors text-left"
              >
                <div className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 flex items-center justify-center transition-all border-border-custom`}>
                  <div className="h-1.5 w-1.5 rounded-full bg-transparent" />
                </div>
                <span className="flex-1 truncate text-[13px] text-text-primary">{item.title}</span>
                {item.recurrence && <Repeat2 size={10} className="shrink-0 text-violet-400" />}
              </button>
            ))}
            {s.doneItems.slice(0, 2).map((item: any) => (
              <button
                key={item.id}
                onClick={() => handleToggleTask(item)}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-surface-solid/60 transition-colors text-left opacity-40"
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
                  onClick={() => setNewTask(t => t ? { ...t, recurrence: RECURRENCE_CYCLE[(RECURRENCE_CYCLE.indexOf(t.recurrence as any) + 1) % RECURRENCE_CYCLE.length] } : t)}
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
              className={`flex w-full items-center gap-2 rounded-[12px] border border-dashed border-border-custom/60 px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary hover:border-border-custom transition-colors`}
            >
              <Plus size={13} /> Dodaj zadanie
            </button>
          )}

          {/* Footer actions */}
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
      )}
    </div>
  );
}
