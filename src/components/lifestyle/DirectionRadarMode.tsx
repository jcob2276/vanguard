import { Calendar, Check, Shield, Target, Wallet, Zap } from 'lucide-react';
import { addDays, differenceInDays, format, parseISO, startOfWeek, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { getTodayWarsaw, formatWarsawDate , nowWarsaw } from '../../lib/date';
import type { Tables } from '../../lib/database.types';
import { DAYS_PL, SENTIMENTS } from './directionConstants';

type DailyWinRow = Tables<'daily_wins'>;
type WeeklyReviewRow = Tables<'weekly_reviews'>;
type CalendarRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;
type TodoItemRow = Pick<Tables<'todo_items'>, 'id' | 'title' | 'status' | 'priority' | 'ai_bucket' | 'due_date' | 'section_id'>;
type LifeGoalRow = Pick<Tables<'life_goals'>, 'goal_cialo' | 'date_cialo' | 'goal_duch' | 'date_duch' | 'goal_konto' | 'date_konto'>;

const APP_LAUNCH_DATE = '2026-05-03';
const todayWarsaw = () => getTodayWarsaw();

const GOAL_DEFS: Array<{ key: 'goal_cialo' | 'goal_duch' | 'goal_konto'; dateKey: 'date_cialo' | 'date_duch' | 'date_konto'; Icon: typeof Target; color: string }> = [
  { key: 'goal_cialo', dateKey: 'date_cialo', Icon: Shield, color: 'text-emerald-500' },
  { key: 'goal_duch', dateKey: 'date_duch', Icon: Zap, color: 'text-indigo-400' },
  { key: 'goal_konto', dateKey: 'date_konto', Icon: Wallet, color: 'text-amber-400' },
];

interface DirectionRadarModeProps {
  stats: { streak: number; weeklyP: number; monthlyWin: boolean; weeks: Array<{ isWeekWin: boolean; pCount: number; start: Date }> };
  history: DailyWinRow[];
  prevWeekReview: WeeklyReviewRow | null;
  planWeekStart: Date;
  allCalEvents: CalendarRow[];
  togglePowerListTask: (dayWin: DailyWinRow, index: number) => void;
  focusTasks: TodoItemRow[];
  focusGoalMappings: Record<string, string>;
  currentReview: WeeklyReviewRow | null;
  weekGoals: LifeGoalRow | null;
}

export default function DirectionRadarMode({
  stats,
  history,
  prevWeekReview,
  planWeekStart,
  allCalEvents,
  togglePowerListTask,
  focusTasks,
  focusGoalMappings,
  currentReview,
  weekGoals,
}: DirectionRadarModeProps) {
  return (
    <div className="space-y-4">

      {/* 1. Kompaktowe statsy */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[16px] border border-border-custom bg-surface p-3 shadow-sm text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Streak</p>
          <p className="text-[20px] font-black font-display text-primary mt-1 leading-none">{stats.streak}</p>
          <p className="text-[8px] font-bold text-text-muted mt-1">dni</p>
        </div>
        <div className="rounded-[16px] border border-border-custom bg-surface p-3 shadow-sm text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Tydzień</p>
          <p className={`text-[14px] font-black font-display mt-1 leading-none ${stats.weeklyP > 2 ? 'text-dayB' : 'text-dayC'}`}>
            {stats.weeklyP > 2 ? 'Przeg.' : 'OK'}
          </p>
          <p className="text-[8px] font-bold text-text-muted mt-1">{stats.weeklyP}/2 P</p>
        </div>
        <div className="rounded-[16px] border border-border-custom bg-surface p-3 shadow-sm text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Miesiąc</p>
          <p className={`text-[14px] font-black font-display mt-1 leading-none ${stats.monthlyWin ? 'text-dayC' : 'text-orange-500'}`}>
            {stats.weeks.filter((w) => w.isWeekWin).length}/3
          </p>
          <p className="text-[8px] font-bold text-text-muted mt-1">tyg. wygr.</p>
        </div>
      </div>

      {/* 2. Mapka 28 dni */}
      <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, index) => {
            const gridStart = startOfWeek(subDays(nowWarsaw(), 21), { weekStartsOn: 1 });
            const dateObj = subDays(gridStart, -index);
            const date = format(dateObj, 'yyyy-MM-dd');
            const dayData = history.find((d) => d.date === date);
            const isFuture = dateObj > nowWarsaw();
            const isMissingLoss = date < todayWarsaw() && !dayData && date >= APP_LAUNCH_DATE;
            const color = isFuture ? 'border border-border-custom bg-transparent' : dayData?.result === 'Z' ? 'bg-dayC' : dayData?.result === 'P' || isMissingLoss ? 'bg-dayB' : 'border border-border-custom bg-surface';
            return (
              <div key={date} title={date} className={`flex aspect-square items-end justify-center rounded-lg ${color}`}>
                {date === todayWarsaw() && <span className="mb-1 h-1 w-1 rounded-full bg-white" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Lekcja z poprzedniego tygodnia */}
      {prevWeekReview?.bottleneck && (
        <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/5 p-4 shadow-sm flex gap-3 items-start animate-in fade-in-50 duration-300">
          <span className="text-[18px] leading-none">💡</span>
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 mb-0.5 font-display">Lekcja na ten tydzień</p>
            <p className="text-[12px] font-semibold text-text-primary leading-relaxed">{prevWeekReview.bottleneck}</p>
          </div>
        </div>
      )}

      {/* 3. Weekly Board — na górze */}
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted font-display mb-3">Plan tygodnia</p>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border-custom scrollbar-track-transparent snap-x">
        {DAYS_PL.map((dayLabel, i) => {
          const dayDate = addDays(planWeekStart, i);
          const dayKey = formatWarsawDate(dayDate);
          const isToday = dayKey === todayWarsaw();
          const dayWin = history.find((d) => d.date === dayKey);
          const dayEvents = allCalEvents.filter((e) =>
            e.start_time && formatWarsawDate(new Date(e.start_time)) === dayKey
          );

          const dayWinAny = dayWin as any;
          const hasWins = dayWinAny && [0, 1, 2, 3, 4].some(slotIdx => dayWinAny[`task_${slotIdx + 1}`]);
          const hasContent = dayEvents.length > 0 || hasWins;

          if (!hasContent) {
            return (
              <div
                key={i}
                className={`min-w-[150px] max-w-[170px] shrink-0 flex flex-col rounded-[24px] border p-4 snap-align-start transition-all ${
                  isToday ? 'border-primary/45 bg-surface-solid shadow-sm' : 'border-border-custom bg-surface/20 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between border-b border-border-custom/30 pb-2 mb-3">
                  <h4 className={`text-[12px] font-black uppercase tracking-wide ${isToday ? 'text-primary' : 'text-text-primary'}`}>
                    {dayLabel}
                  </h4>
                  <span className="text-[10px] font-bold text-text-muted">
                    {format(dayDate, 'd MMM', { locale: pl })}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center py-6">
                  <span className="text-[9px] text-text-muted/40 font-bold uppercase tracking-wider">Brak planów</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={i}
              className={`min-w-[260px] max-w-[280px] shrink-0 flex flex-col rounded-[24px] border bg-surface p-4 shadow-sm transition-all duration-300 snap-align-start ${
                isToday ? 'border-primary/50 shadow-md shadow-primary/5 bg-surface-solid' : 'border-border-custom'
              }`}
            >
              <div className="flex items-center justify-between border-b border-border-custom/40 pb-2 mb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <h4 className={`text-[12px] font-black uppercase tracking-wide ${isToday ? 'text-primary' : 'text-text-primary'}`}>
                    {dayLabel}
                  </h4>
                  <span className="text-[10px] font-bold text-text-muted">
                    {format(dayDate, 'd MMM', { locale: pl })}
                  </span>
                </div>
                {isToday && (
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-primary">
                    Dzisiaj
                  </span>
                )}
              </div>

              <div className="space-y-4 flex-1 flex flex-col justify-start">

                {/* Calendar (only if has events) */}
                {dayEvents.length > 0 && (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar size={11} className="text-primary shrink-0" />
                      <span className="text-[8px] font-black uppercase tracking-wider text-text-muted">Harmonogram</span>
                    </div>
                    <div className="space-y-1.5 pl-3 border-l border-border-custom/50">
                      {dayEvents.map((ev, idx) => (
                        <div key={idx} className="flex items-baseline gap-1.5 text-[10px] font-semibold text-text-secondary font-display">
                          <span className="text-primary font-black shrink-0 text-[8.5px] mr-1">
                            {new Date(ev.start_time!).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="truncate">{ev.summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily plan (only if has plan) */}
                {hasWins && (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target size={11} className="text-emerald-500 shrink-0" />
                      <span className="text-[8px] font-black uppercase tracking-wider text-text-muted font-display">Plan dnia</span>
                    </div>
                    <div className="space-y-2 pl-3 border-l border-border-custom/50">
                      {[0, 1, 2, 3, 4].map((slotIdx) => {
                        const dayWinAny = dayWin as any;
                        const task = dayWinAny[`task_${slotIdx + 1}`];
                        const done = dayWinAny[`done_${slotIdx + 1}`];
                        if (!task) return null;
                        const isInteractive = isToday;
                        return (
                          <div
                            key={slotIdx}
                            onClick={() => isInteractive && togglePowerListTask(dayWin!, slotIdx)}
                            className={`flex items-center gap-2 text-[11px] font-medium transition-all duration-200 ${isInteractive ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                          >
                            <div className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition-all duration-300 ${
                              done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border-custom bg-surface'
                            }`}>
                              {done && <Check size={8} strokeWidth={3} className="text-white" />}
                            </div>
                            <span className={`truncate ${done ? 'line-through text-text-muted opacity-70' : 'text-text-primary'}`}>
                              {task}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* 4. Fokus tygodnia — tylko jeśli zatwierdzony */}
      {focusTasks.length > 0 && (
        <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
          <p className="mb-3 text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Fokus tygodnia</p>
          <div className="space-y-3.5">
            {[
              { key: 'goal_cialo', label: 'Ciało', color: 'text-emerald-500' },
              { key: 'goal_duch', label: 'Duch', color: 'text-indigo-400' },
              { key: 'goal_konto', label: 'Konto', color: 'text-amber-400' },
              { key: 'other', label: 'Inne', color: 'text-text-muted' },
            ].map((category) => {
              const tasksInCategory = focusTasks.filter(
                (todo) => (focusGoalMappings[todo.id] || 'other') === category.key
              );
              if (tasksInCategory.length === 0) return null;
              return (
                <div key={category.key} className="space-y-1.5">
                  <p className={`text-[9px] font-black uppercase tracking-wider ${category.color} font-display`}>{category.label}</p>
                  <div className="space-y-1.5 pl-2 border-l border-border-custom/60">
                    {tasksInCategory.map((todo) => {
                      const done = todo.status === 'done';
                      return (
                        <div key={todo.id} className="flex items-center gap-2.5">
                          <div className={`h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${done ? 'border-emerald-500 bg-emerald-500' : 'border-border-custom'}`}>
                            {done && <Check size={9} className="text-white" />}
                          </div>
                          <span className={`flex-1 truncate text-[12px] font-semibold ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>{todo.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Cele tygodnia (z przeglądu niedzielnego) */}
      {currentReview && ((currentReview as any).week_goal_cialo || (currentReview as any).week_goal_duch || (currentReview as any).week_goal_konto) && (
        <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm space-y-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Cele tego tygodnia</p>
          {(currentReview as any).week_intention && (
            <p className="text-[11px] font-semibold text-text-secondary italic">„{(currentReview as any).week_intention}"</p>
          )}
          <div className="space-y-2">
            {[
              { key: 'week_goal_cialo', label: 'Ciało', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
              { key: 'week_goal_duch',  label: 'Duch',  color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10'  },
              { key: 'week_goal_konto', label: 'Konto', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10'   },
            ].filter(g => (currentReview as any)[g.key]).map(g => (
              <div key={g.key} className="flex items-start gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${g.bg} ${g.color}`}>{g.label}</span>
                <span className="text-[12px] font-semibold text-text-primary leading-snug">{(currentReview as any)[g.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Sentyment + Cele kierunkowe */}
      <div className="space-y-3">
        {currentReview?.week_sentiment && (
          <div className="rounded-[24px] border border-border-custom bg-surface px-4 py-3.5 shadow-sm flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Sentyment tygodnia</span>
            <span className={`text-[9px] font-black uppercase tracking-wide rounded-full px-2.5 py-0.5 ${
              currentReview.week_sentiment === 'excellent' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : currentReview.week_sentiment === 'good' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
              : currentReview.week_sentiment === 'ok' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            }`}>
              {SENTIMENTS.find((s) => s.value === currentReview.week_sentiment)?.label}
            </span>
          </div>
        )}
        {weekGoals && GOAL_DEFS.some((g) => (weekGoals as any)[g.key]) && (
          <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm">
            <p className="mb-3 text-[8px] font-black uppercase tracking-widest text-text-muted font-display">Cele kierunkowe</p>
            <div className="space-y-2.5">
              {GOAL_DEFS.filter((g) => (weekGoals as any)[g.key]).map(({ key, dateKey, Icon, color }) => {
                const weekGoalsAny = weekGoals as any;
                const days = weekGoalsAny[dateKey] ? differenceInDays(parseISO(weekGoalsAny[dateKey]), nowWarsaw()) : null;
                return (
                  <div key={key} className="flex items-center gap-2.5">
                    <Icon size={13} className={`${color} shrink-0`} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{weekGoalsAny[key]}</span>
                    {days !== null && (
                      <span className={`shrink-0 text-[9px] font-bold ${days <= 0 ? 'text-rose-500 font-black' : days <= 14 ? 'text-amber-500' : 'text-text-muted'}`}>
                        {days <= 0 ? `${Math.abs(days)}d po` : `za ${days}d`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
