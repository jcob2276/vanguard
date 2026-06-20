import { Check, Plus } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { Tables } from '../../lib/database.types';
import { DAYS_PL, SENTIMENTS, GOAL_CHIP } from './directionConstants';

type CalendarRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;
type TodoItemRow = Pick<Tables<'todo_items'>, 'id' | 'title' | 'status' | 'priority' | 'ai_bucket' | 'due_date' | 'section_id'>;
type TodoSectionRow = Pick<Tables<'todo_sections'>, 'id' | 'name' | 'project_id'>;

interface DirectionPlanningModeProps {
  pastWeekStats: { wins: number; habitPercent: number };
  weekSentiment: string;
  setWeekSentiment: (v: string) => void;
  proudOf: string;
  setProudOf: (v: string) => void;
  bottleneck: string;
  setBottleneck: (v: string) => void;
  planWeekStart: Date;
  planCalEvents: CalendarRow[];
  selectedSectionId: string;
  setSelectedSectionId: (v: string) => void;
  todoSections: TodoSectionRow[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredTasks: TodoItemRow[];
  quickTaskInput: string;
  setQuickTaskInput: (v: string) => void;
  addQuickTask: () => void;
  addingTask: boolean;
  selectedTaskIds: Set<string>;
  toggleTaskSelection: (id: string) => void;
  weekTodos: TodoItemRow[];
  sectionGoalMap: Record<string, string>;
  focusGoalMappings: Record<string, string>;
  setFocusGoalMappings: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  saveWeeklyPlan: () => void;
  savingPlan: boolean;
}

export default function DirectionPlanningMode({
  pastWeekStats,
  weekSentiment,
  setWeekSentiment,
  proudOf,
  setProudOf,
  bottleneck,
  setBottleneck,
  planWeekStart,
  planCalEvents,
  selectedSectionId,
  setSelectedSectionId,
  todoSections,
  searchQuery,
  setSearchQuery,
  filteredTasks,
  quickTaskInput,
  setQuickTaskInput,
  addQuickTask,
  addingTask,
  selectedTaskIds,
  toggleTaskSelection,
  weekTodos,
  sectionGoalMap,
  focusGoalMappings,
  setFocusGoalMappings,
  saveWeeklyPlan,
  savingPlan,
}: DirectionPlanningModeProps) {
  return (
    <div className="space-y-5 rounded-2xl border border-primary/15 bg-primary/5 p-4 shadow-sm">

      {/* 1. Past Week Performance stats */}
      <div className="rounded-xl border border-border-custom/50 bg-surface/50 p-3.5">
        <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-2">Podsumowanie minionego tygodnia</p>
        <div className="flex gap-4">
          <div className="flex-1">
            <span className="block text-[16px] font-black text-emerald-500 font-display">{pastWeekStats.wins}/7</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Dni wygranych</span>
          </div>
          <div className="w-[1px] bg-border-custom" />
          <div className="flex-1">
            <span className="block text-[16px] font-black text-indigo-400 font-display">{pastWeekStats.habitPercent}%</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Realizacja nawyków</span>
          </div>
        </div>
      </div>

      {/* 2. Sentiment */}
      <div>
        <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-text-muted">Jak minął ten tydzień?</p>
        <div className="grid grid-cols-2 gap-2">
          {SENTIMENTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setWeekSentiment(s.value)}
              className={`py-3 rounded-xl border text-[12px] font-semibold transition-all cursor-pointer ${weekSentiment === s.value ? 'border-primary bg-primary text-white shadow-sm shadow-primary/20' : 'border-border-custom bg-surface text-text-secondary hover:bg-surface-solid'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Reflection fields */}
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Z czego jestem najbardziej dumny?</p>
          <textarea
            value={proudOf}
            onChange={(e) => setProudOf(e.target.value)}
            placeholder="Główny sukces, przełom lub ukończone ważne zadanie..."
            rows={2}
            className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-medium text-text-primary outline-none transition-all placeholder:text-text-muted/40 focus:border-primary/50 focus:bg-surface-solid"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[8px] font-black uppercase tracking-widest text-text-muted">Co mnie spowalniało / Lekcja na przyszłość?</p>
          <textarea
            value={bottleneck}
            onChange={(e) => setBottleneck(e.target.value)}
            placeholder="Brak energii, przeszkody, wnioski, co zmienić..."
            rows={2}
            className="w-full rounded-xl border border-border-custom bg-surface p-3 text-[12px] font-medium text-text-primary outline-none transition-all placeholder:text-text-muted/40 focus:border-primary/50 focus:bg-surface-solid"
          />
        </div>
      </div>

      {/* 4. Next week calendar */}
      <div>
        <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-text-muted">Harmonogram na następny tydzień</p>
        <div className="flex gap-1 mb-2">
          {DAYS_PL.map((dayLabel, i) => {
            const dayDate = addDays(planWeekStart, i);
            const dayKey = dayDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
            const hasEvent = planCalEvents.some((e) =>
              new Date(e.start_time!).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === dayKey
            );
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-text-muted">{dayLabel}</span>
                <span className="text-[10px] font-semibold text-text-primary">{format(dayDate, 'd')}</span>
                <div className={`h-1.5 w-1.5 rounded-full ${hasEvent ? 'bg-primary' : 'bg-transparent'}`} />
              </div>
            );
          })}
        </div>
        {planCalEvents.length > 0 && (
          <div className="max-h-[110px] overflow-y-auto space-y-1 rounded-xl border border-border-custom bg-surface/30 p-2.5">
            {planCalEvents.map((ev, i) => {
              const eDay = new Date(ev.start_time!).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
              const dayIdx = DAYS_PL.findIndex((_, j) =>
                addDays(planWeekStart, j).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) === eDay
              );
              return (
                <p key={i} className="text-[10px] font-semibold text-text-secondary truncate">
                  <span className="font-black text-primary mr-1">{dayIdx >= 0 ? DAYS_PL[dayIdx] : ''}</span>
                  <span className="text-text-muted text-[9px] mr-1.5">
                    {new Date(ev.start_time!).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {ev.summary}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Task picker */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Wybierz fokus tygodnia (maks. 3)</p>
          <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">{selectedTaskIds.size}/3</span>
        </div>

        {/* Section Filters & Search */}
        <div className="space-y-2">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedSectionId('all')}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${selectedSectionId === 'all' ? 'bg-primary border-primary text-white shadow-sm' : 'bg-surface border-border-custom text-text-secondary hover:bg-surface-solid'}`}
            >
              Wszystkie
            </button>
            {todoSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer border ${selectedSectionId === sec.id ? 'bg-primary border-primary text-white shadow-sm' : 'bg-surface border-border-custom text-text-secondary hover:bg-surface-solid'}`}
              >
                {sec.name}
              </button>
            ))}
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtruj lub szukaj zadania..."
            className="w-full rounded-xl border border-border-custom bg-surface px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:border-primary/50 placeholder:text-text-muted/40"
          />
        </div>

        {filteredTasks.length === 0 ? (
          <div className="space-y-2 rounded-xl border border-dashed border-border-custom p-4 text-center">
            <p className="text-[11px] font-semibold text-text-muted">
              {searchQuery || selectedSectionId !== 'all' ? 'Brak pasujących zadań' : 'Brak zadań — dodaj pierwsze'}
            </p>
            <div className="flex gap-2">
              <input
                value={quickTaskInput}
                onChange={(e) => setQuickTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addQuickTask()}
                placeholder="Tytuł zadania..."
                className="flex-1 rounded-lg border border-border-custom bg-surface px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:border-primary/50"
              />
              <button type="button" onClick={addQuickTask} disabled={addingTask || !quickTaskInput.trim()} className="flex items-center rounded-lg bg-primary px-3 text-white cursor-pointer disabled:opacity-40">
                <Plus size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
            {filteredTasks.map((todo) => {
              const isSelected = selectedTaskIds.has(todo.id);
              const atMax = selectedTaskIds.size >= 3 && !isSelected;
              return (
                <div
                  key={todo.id}
                  onClick={() => !atMax && toggleTaskSelection(todo.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all ${
                    isSelected ? 'border-primary/30 bg-primary/8 cursor-pointer'
                    : atMax ? 'border-border-custom bg-surface opacity-30'
                    : 'border-border-custom bg-surface hover:bg-surface-solid cursor-pointer'
                  }`}
                >
                  <div className={`h-5 w-5 shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-all ${isSelected ? 'border-primary bg-primary' : 'border-border-custom'}`}>
                    {isSelected && <Check size={10} className="text-white" />}
                  </div>
                  <span className="flex-1 truncate text-[12px] font-semibold text-text-primary">{todo.title}</span>
                  {todo.section_id && sectionGoalMap[todo.section_id] && (() => {
                    const g = GOAL_CHIP[sectionGoalMap[todo.section_id]];
                    return g ? (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${g.chip}`}>{g.label}</span>
                    ) : null;
                  })()}
                  {todo.ai_bucket && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${
                      todo.ai_bucket === 'today' ? 'bg-rose-500/10 text-rose-500'
                      : todo.ai_bucket === 'soon' ? 'bg-primary/10 text-primary'
                      : 'bg-text-muted/10 text-text-muted'
                    }`}>
                      {todo.ai_bucket === 'today' ? 'Dziś' : todo.ai_bucket === 'soon' ? 'Wkrótce' : 'W tle'}
                    </span>
                  )}
                </div>
              );
            })}
            {/* Inline quick add */}
            <div className="flex gap-2 pt-1.5">
              <input
                value={quickTaskInput}
                onChange={(e) => setQuickTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addQuickTask()}
                placeholder="Dodaj nowe zadanie..."
                className="flex-1 rounded-xl border border-dashed border-border-custom bg-transparent px-3 py-2 text-[12px] font-medium text-text-primary outline-none focus:border-primary/50 placeholder:text-text-muted/40"
              />
              {quickTaskInput.trim() && (
                <button type="button" onClick={addQuickTask} disabled={addingTask} className="flex items-center rounded-xl bg-primary px-3 text-white cursor-pointer disabled:opacity-40">
                  <Plus size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Goal mapping picker */}
      {selectedTaskIds.size > 0 && (
        <div className="space-y-3 rounded-xl border border-border-custom bg-surface p-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Połącz zadania z celami</p>
          <div className="space-y-2.5">
            {[...selectedTaskIds].map((id) => {
              const todo = weekTodos.find((t) => t.id === id);
              if (!todo) return null;
              const currentMapping = focusGoalMappings[todo.id] || 'other';
              return (
                <div key={todo.id} className="space-y-1">
                  <p className="text-[11px] font-bold text-text-primary truncate">{todo.title}</p>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { value: 'goal_cialo', label: 'Ciało', color: 'border-emerald-500/35 text-emerald-500 bg-emerald-500/5' },
                      { value: 'goal_duch', label: 'Duch', color: 'border-indigo-500/35 text-indigo-500 bg-indigo-500/5' },
                      { value: 'goal_konto', label: 'Konto', color: 'border-amber-500/35 text-amber-500 bg-amber-500/5' },
                      { value: 'other', label: 'Inne', color: 'border-border-custom text-text-muted bg-surface/40' },
                    ].map((g) => {
                      const active = currentMapping === g.value;
                      return (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setFocusGoalMappings((prev) => ({ ...prev, [todo.id]: g.value }))}
                          className={`py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                            active
                              ? g.value === 'goal_cialo' ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                                : g.value === 'goal_duch' ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                                : g.value === 'goal_konto' ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                                : 'border-text-primary bg-text-primary text-background shadow-sm'
                              : 'border-border-custom bg-surface text-text-secondary hover:bg-surface-solid'
                          }`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Confirm */}
      <button
        onClick={saveWeeklyPlan}
        disabled={savingPlan}
        className="w-full rounded-xl bg-primary hover:bg-primary-hover py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-40"
      >
        {savingPlan ? 'Zapisywanie...' : 'Zatwierdź plan'}
      </button>
    </div>
  );
}
