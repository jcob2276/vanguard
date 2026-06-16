import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Flame, Search, Shield, Target, Wallet, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { listTodoItems, listTodoSections } from '../../lib/todo';
import { listProjects } from '../../lib/projects';
import { useHaptics } from '../../hooks/useHaptics';
import { useDailyPush } from '../../hooks/useDailyPush';
import type { Session } from '@supabase/supabase-js';
import type { Tables } from '../../lib/database.types';
import type { GoalKey } from '../../hooks/useDailyPush';

interface Props {
  session: Session;
  todayWin: Tables<'daily_wins'> | null;
  onUpdate: () => void;
  onOpenRitual: () => void;
  streak: number;
}

interface EnrichedTask {
  id: string;
  title: string;
  groupKey: string;
  groupLabel: string;
  projectColor: string | null;
}

const COLOR_DOT: Record<string, string> = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

const COLOR_CHIP: Record<string, string> = {
  indigo: 'text-indigo-600 dark:text-indigo-400',
  violet: 'text-violet-600 dark:text-violet-400',
  sky: 'text-sky-600 dark:text-sky-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
};

const GOAL_META: Record<GoalKey, { icon: typeof Shield; color: string; label: string }> = {
  cialo: { icon: Shield, color: 'text-emerald-500', label: 'Ciało' },
  duch:  { icon: Zap,    color: 'text-indigo-500',  label: 'Duch'  },
  konto: { icon: Wallet, color: 'text-amber-500',   label: 'Konto' },
};

function TaskPicker({ items, search, onSearch, onSelect, onClose }: {
  items: EnrichedTask[];
  search: string;
  onSearch: (s: string) => void;
  onSelect: (item: EnrichedTask) => void;
  onClose: () => void;
}) {
  const filtered = search
    ? items.filter(i =>
        i.title.toLowerCase().includes(search.toLowerCase()) ||
        i.groupLabel.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const grouped = filtered.reduce<Record<string, { label: string; color: string | null; items: EnrichedTask[] }>>((acc, item) => {
    if (!acc[item.groupKey]) acc[item.groupKey] = { label: item.groupLabel, color: item.projectColor, items: [] };
    acc[item.groupKey].items.push(item);
    return acc;
  }, {});

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-xl">
      <div className="flex items-center gap-2 border-b border-border-custom px-3 py-2.5">
        <Search size={11} className="shrink-0 text-text-muted" />
        <input
          autoFocus
          value={search}
          onChange={e => onSearch(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="Szukaj zadania lub projektu..."
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-text-primary outline-none placeholder:text-text-muted/40"
        />
      </div>
      <div className="max-h-[240px] overflow-y-auto py-1.5">
        {Object.keys(grouped).length === 0 ? (
          <p className="py-5 text-center text-[10px] text-text-muted">Brak otwartych zadań</p>
        ) : (
          Object.entries(grouped).map(([key, group]) => (
            <div key={key}>
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                {group.color && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR_DOT[group.color] || 'bg-primary'}`} />}
                <span className="text-[8.5px] font-black uppercase tracking-widest text-text-muted">{group.label}</span>
              </div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-solid active:scale-[0.98] cursor-pointer"
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{item.title}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function JedenPriorytetCard({ session, todayWin, onUpdate, onOpenRitual, streak }: Props) {
  const userId = session.user.id;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const haptics = useHaptics();

  const suggestion = useDailyPush(userId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [priorityProject, setPriorityProject] = useState<{ name: string; color: string | null } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const priorityTask = todayWin?.task_1 || null;
  const isWin = !!todayWin?.done_1;
  const state = !priorityTask ? 'empty' : isWin ? 'win' : 'active';

  // Load tasks when picker opens
  useEffect(() => {
    if (!pickerOpen || tasks.length > 0) return;
    (async () => {
      try {
        const [rawItems, sections, projects] = await Promise.all([
          listTodoItems(userId),
          listTodoSections(userId),
          listProjects(userId),
        ]);

        const sectionMap = new Map((sections ?? []).map((s: any) => [s.id, s]));
        const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));

        const enriched: EnrichedTask[] = (rawItems ?? [])
          .filter((i: any) => i.status === 'open')
          .map((i: any) => {
            const section = sectionMap.get(i.section_id) as any;
            const project = section?.project_id ? projectMap.get(section.project_id) as any : null;
            const groupLabel = project?.name ?? section?.name ?? 'Inne';
            const groupKey = project?.id ?? section?.id ?? 'none';
            return {
              id: i.id,
              title: i.title,
              groupKey,
              groupLabel,
              projectColor: project?.color ?? null,
            };
          });

        setTasks(enriched);
      } catch (e) {
        console.error('Failed to load tasks for picker', e);
      }
    })();
  }, [pickerOpen, userId, tasks.length]);

  // Resolve project for the current priority task
  useEffect(() => {
    const todoId = todayWin?.task_1_todo_id;
    if (!todoId) { setPriorityProject(null); return; }
    (async () => {
      try {
        const [{ data: item }, sections, projects] = await Promise.all([
          supabase.from('todo_items').select('section_id').eq('id', todoId).maybeSingle(),
          listTodoSections(userId),
          listProjects(userId),
        ]);
        if (!item?.section_id) { setPriorityProject(null); return; }
        const sectionMap = new Map((sections ?? []).map((s: any) => [s.id, s]));
        const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
        const section = sectionMap.get(item.section_id) as any;
        const project = section?.project_id ? projectMap.get(section.project_id) as any : null;
        setPriorityProject(project ? { name: project.name, color: project.color } : null);
      } catch { setPriorityProject(null); }
    })();
  }, [todayWin?.task_1_todo_id, userId]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const openPicker = () => { haptics.light(); setPickerOpen(true); };
  const closePicker = () => { setPickerOpen(false); setSearch(''); };

  const pickTask = async (item: EnrichedTask) => {
    setSaving(true);
    haptics.medium();
    try {
      if (!todayWin) {
        await supabase.from('daily_wins').insert({
          user_id: userId,
          date: today,
          task_1: item.title,
          category_1: 'general',
          task_1_todo_id: item.id,
        });
      } else {
        await supabase.from('daily_wins')
          .update({ task_1: item.title, task_1_todo_id: item.id })
          .eq('id', todayWin.id);
      }
      closePicker();
      onUpdate();
    } catch (e) {
      console.error('Failed to set priority task', e);
    } finally {
      setSaving(false);
    }
  };

  const takeSuggestion = () => {
    if (!suggestion) return;
    pickTask({
      id: suggestion.taskId,
      title: suggestion.taskTitle,
      groupKey: suggestion.projectId,
      groupLabel: suggestion.projectName,
      projectColor: suggestion.projectColor,
    });
  };

  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5">
        <div>
          <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">
            <Target size={9} className="text-primary" /> 1% LEPSZY KAŻDY DZIEŃ
          </p>
          <h3 className="mt-1 font-display text-[15px] font-black tracking-tight text-text-primary leading-tight">
            Jeden Priorytet
          </h3>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-0.5 rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-500 text-[10px] font-black">
            <Flame size={11} fill="currentColor" />
            <span>{streak}d</span>
          </div>
        )}
      </div>

      <div className="mx-5 border-t border-border-custom" />

      <div className="px-5 pt-4 pb-5 space-y-3">

        {/* EMPTY: show AI suggestion or manual picker */}
        {state === 'empty' && (
          <>
            {suggestion ? (
              <SuggestionCard
                suggestion={suggestion}
                saving={saving}
                onTake={takeSuggestion}
                onChooseOther={openPicker}
              />
            ) : (
              <p className="text-[11.5px] text-text-secondary leading-relaxed">
                Co jest twoją <span className="font-black text-text-primary">jedną rzeczą</span> dziś — taką, że gdy to zrobisz, wszystko inne jest bonusem?
              </p>
            )}
            <div className="relative" ref={pickerRef}>
              {!suggestion && (
                <button
                  onClick={openPicker}
                  disabled={saving}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] px-4 py-3 text-left transition-all hover:bg-primary/[0.05] hover:border-primary/50 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <span className="text-xs font-black text-primary">Wybierz z projektów / to-do</span>
                  <ChevronRight size={14} className="text-primary shrink-0" />
                </button>
              )}
              {pickerOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1.5">
                  <TaskPicker items={tasks} search={search} onSearch={setSearch} onSelect={pickTask} onClose={closePicker} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ACTIVE: task set, waiting for completion */}
        {state === 'active' && (
          <>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary/30" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-text-primary leading-snug">{priorityTask}</p>
                {priorityProject && (
                  <p className="mt-1 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR_DOT[priorityProject.color || ''] || 'bg-primary'}`} />
                    <span className={`text-[9px] font-bold ${COLOR_CHIP[priorityProject.color || ''] || 'text-primary'}`}>{priorityProject.name}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border-custom/60 bg-text-primary/[0.02] px-3.5 py-2.5">
              <p className="flex-1 text-[10px] text-text-muted leading-snug">
                Odhacz w <span className="font-bold text-text-secondary">PowerList ↓</span> — WIN nastąpi automatycznie
              </p>
              <button
                onClick={openPicker}
                className="shrink-0 text-[9px] font-black uppercase tracking-wider text-primary hover:text-primary-hover transition-colors cursor-pointer"
              >
                Zmień
              </button>
            </div>
            {pickerOpen && (
              <div ref={pickerRef}>
                <TaskPicker items={tasks} search={search} onSearch={setSearch} onSelect={pickTask} onClose={closePicker} />
              </div>
            )}
          </>
        )}

        {/* WIN: task completed */}
        {state === 'win' && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Check size={13} strokeWidth={3} className="text-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">WIN — +1%</p>
                <p className="text-[12.5px] font-black text-text-primary leading-tight mt-0.5 truncate">{priorityTask}</p>
                {priorityProject && (
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR_DOT[priorityProject.color || ''] || 'bg-primary'}`} />
                    <span className={`text-[9px] font-bold ${COLOR_CHIP[priorityProject.color || ''] || 'text-primary'}`}>{priorityProject.name}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3.5 py-2">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Kumulacja: 1% × 365 = 37× lepszy w rok
              </p>
            </div>
          </>
        )}

        {/* Always: link to full ritual */}
        <button
          onClick={() => { haptics.light(); onOpenRitual(); }}
          className="w-full text-center text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors pt-0.5"
        >
          + Zwycięski Poranek (pełny rytuał) →
        </button>
      </div>
    </section>
  );
}

function SuggestionCard({
  suggestion,
  saving,
  onTake,
  onChooseOther,
}: {
  suggestion: NonNullable<ReturnType<typeof useDailyPush>>;
  saving: boolean;
  onTake: () => void;
  onChooseOther: () => void;
}) {
  const meta = GOAL_META[suggestion.goalKey];
  const GoalIcon = meta.icon;
  const dotColor = COLOR_DOT[suggestion.projectColor || ''] || 'bg-primary';
  const chipColor = COLOR_CHIP[suggestion.projectColor || ''] || 'text-primary';

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-4 space-y-3">
      {/* Header */}
      <p className="text-[8.5px] font-black uppercase tracking-[0.2em] text-primary/70">
        ↗ System proponuje na dziś
      </p>

      {/* Task */}
      <p className="text-[14px] font-black text-text-primary leading-snug">
        {suggestion.taskTitle}
      </p>

      {/* Chain context */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
          <span className={`text-[9px] font-bold ${chipColor}`}>{suggestion.projectName}</span>
        </div>
        <span className="text-[8px] text-text-muted">·</span>
        <span className="text-[9px] text-text-secondary truncate max-w-[130px]">{suggestion.dreamTitle}</span>
        <span className="text-[8px] text-text-muted">·</span>
        <div className="flex items-center gap-0.5">
          <GoalIcon size={9} className={meta.color} />
          <span className={`text-[9px] font-bold ${meta.color}`}>{meta.label}</span>
        </div>
      </div>

      {/* Reason */}
      <p className="text-[9px] text-text-muted italic">{suggestion.reason}</p>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-0.5">
        <button
          onClick={onTake}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
        >
          Biorę to na dziś →
        </button>
        <button
          onClick={onChooseOther}
          className="w-full text-center text-[9px] font-bold text-text-muted hover:text-primary transition-colors cursor-pointer"
        >
          Wybierz inne zadanie
        </button>
      </div>
    </div>
  );
}
