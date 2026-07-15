import { useEffect, useRef } from 'react';
import { Calendar, Check, Target } from 'lucide-react';
import { Card } from '../ui/Card';
import { addDays, format, startOfWeek, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { getTodayWarsaw, formatWarsawDate, shiftDateStr, TIMEZONE } from '../../lib/date';
import type { Tables } from '../../lib/database.types';
import { DAYS_PL, SENTIMENTS } from './directionConstants';

type DailyWinRow = Tables<'daily_wins'>;
type WeeklyReviewRow = Tables<'weekly_reviews'>;
type CalendarRow = Pick<Tables<'vanguard_calendar'>, 'summary' | 'start_time' | 'end_time'>;

const APP_LAUNCH_DATE = '2026-05-03';
const todayWarsaw = () => getTodayWarsaw();

interface DirectionRadarModeProps {
  stats: { streak: number; weeklyP: number; monthlyWin: boolean; weeks: Array<{ isWeekWin: boolean; pCount: number; start: Date }> };
  history: DailyWinRow[];
  prevWeekReview: WeeklyReviewRow | null;
  planWeekStart: Date;
  allCalEvents: CalendarRow[];
  togglePowerListTask: (dayWin: DailyWinRow, index: number) => void;
  currentReview: WeeklyReviewRow | null;
}

export default function DirectionRadarMode({
  stats,
  history,
  prevWeekReview,
  planWeekStart,
  allCalEvents,
  togglePowerListTask,
  currentReview,
}: DirectionRadarModeProps) {
  const todayCardRef = useRef<HTMLDivElement | null>(null);

  // Mid-week, "today" is buried a few cards into the horizontal scroll —
  // jump straight to it instead of making the user hunt for it every time.
  useEffect(() => {
    todayCardRef.current?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
  }, []);

  return (
    <div className="space-y-4">

      {/* 1. Kompaktowe statsy */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[var(--radius-lg)] border border-border-custom bg-surface p-3 shadow-sm text-center">
          <p className="text-2xs font-black uppercase tracking-widest text-text-muted">Streak</p>
          <p className="text-xl font-black font-display text-primary mt-1 leading-none">{stats.streak}</p>
          <p className="text-2xs font-bold text-text-muted mt-1">dni</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border-custom bg-surface p-3 shadow-sm text-center">
          <p className="text-2xs font-black uppercase tracking-widest text-text-muted">Tydzień</p>
          <p className={`text-base font-black font-display mt-1 leading-none ${stats.weeklyP > 2 ? 'text-dayB' : 'text-dayC'}`}>
            {stats.weeklyP > 2 ? 'Przeg.' : 'OK'}
          </p>
          <p className="text-2xs font-bold text-text-muted mt-1">{stats.weeklyP}/2 P</p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-border-custom bg-surface p-3 shadow-sm text-center">
          <p className="text-2xs font-black uppercase tracking-widest text-text-muted">Miesiąc</p>
          <p className={`text-base font-black font-display mt-1 leading-none ${stats.monthlyWin ? 'text-dayC' : 'text-warning'}`}>
            {stats.weeks.filter((w) => w.isWeekWin).length}/3
          </p>
          <p className="text-2xs font-bold text-text-muted mt-1">tyg. wygr.</p>
        </div>
      </div>

      {/* 2. Mapka 28 dni */}
      <Card padding="1rem">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, index) => {
            const d = new Date(shiftDateStr(getTodayWarsaw(), -21) + 'T12:00:00Z');
            const gridStart = startOfWeek(d, { weekStartsOn: 1 });
            const dateObj = subDays(gridStart, -index);
            const date = format(dateObj, 'yyyy-MM-dd');
            const dayData = history.find((d) => d.date === date);
            const isFuture = dateObj > new Date(getTodayWarsaw() + 'T12:00:00Z');
            const isMissingLoss = date < todayWarsaw() && !dayData && date >= APP_LAUNCH_DATE;
            const color = isFuture ? 'border border-border-custom bg-transparent' : dayData?.result === 'Z' ? 'bg-dayC' : dayData?.result === 'P' || isMissingLoss ? 'bg-dayB' : 'border border-border-custom bg-surface';
            return (
              <div key={date} title={date} className={`flex aspect-square items-end justify-center rounded-lg ${color}`}>
                {date === todayWarsaw() && <span className="mb-1 h-1 w-1 rounded-full bg-on-accent" />}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-2xs font-bold text-text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-dayC" />Wygrany</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-dayB" />Przegrany / brak</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm border border-border-custom bg-surface" />Zaplanowany</span>
        </div>
      </Card>

      {/* 3. Lekcja z poprzedniego tygodnia */}
      {prevWeekReview?.bottleneck && (
        <Card padding="1rem" className="flex gap-3 items-start animate-in fade-in-50 duration-[var(--motion-slow)]" style={{ background: 'var(--color-theme-hex-ba24515811005)' }}>
          <span className="text-lg leading-none">💡</span>
          <div>
            <p className="text-2xs font-black uppercase tracking-widest text-warning mb-0.5 font-display">Lekcja na ten tydzień</p>
            <p className="text-sm font-semibold text-text-primary leading-relaxed">{prevWeekReview.bottleneck}</p>
          </div>
        </Card>
      )}

      {/* 3. Weekly Board — na górze */}
      <div>
        <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-22em)] text-text-muted font-display mb-3">Plan tygodnia</p>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border-custom scrollbar-track-transparent snap-x">
        {DAYS_PL.map((dayLabel, i) => {
          const dayDate = addDays(planWeekStart, i);
          const dayKey = formatWarsawDate(dayDate);
          const isToday = dayKey === todayWarsaw();
          const dayWin = history.find((d) => d.date === dayKey);
          const dayEvents = allCalEvents.filter((e) =>
            e.start_time && formatWarsawDate(new Date(e.start_time)) === dayKey
          );

          const hasWins = dayWin && [0, 1, 2, 3, 4].some(slotIdx => dayWin[`task_${slotIdx + 1}` as keyof typeof dayWin]);
          const hasContent = dayEvents.length > 0 || hasWins;

          if (!hasContent) {
            return (
              <div
                key={i}
                ref={isToday ? todayCardRef : undefined}
                className={`min-w-[var(--ds-w-150px)] max-w-[var(--ds-maxw-170px)] shrink-0 flex flex-col rounded-[var(--radius-xl)] border p-4 snap-align-start transition-all ${
                  isToday ? 'border-primary/45 bg-surface-solid shadow-sm' : 'border-border-custom bg-surface/20 opacity-[var(--opacity-60)]'
                }`}
              >
                <div className="flex items-center justify-between border-b border-border-custom/30 pb-2 mb-3">
                  <h4 className={`text-sm font-black uppercase tracking-wide ${isToday ? 'text-primary' : 'text-text-primary'}`}>
                    {dayLabel}
                  </h4>
                  <span className="text-xs font-bold text-text-muted">
                    {format(dayDate, 'd MMM', { locale: pl })}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center py-6">
                  <span className="text-2xs text-text-muted/40 font-bold uppercase tracking-wider">Brak planów</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={i}
              ref={isToday ? todayCardRef : undefined}
              className={`min-w-[var(--ds-w-260px)] max-w-[var(--ds-maxw-280px)] shrink-0 flex flex-col rounded-[var(--radius-xl)] border bg-surface p-4 shadow-sm transition-all duration-[var(--motion-slow)] snap-align-start ${
                isToday ? 'border-primary/50 shadow-md shadow-primary/5 bg-surface-solid' : 'border-border-custom'
              }`}
            >
              <div className="flex items-center justify-between border-b border-border-custom/40 pb-2 mb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <h4 className={`text-sm font-black uppercase tracking-wide ${isToday ? 'text-primary' : 'text-text-primary'}`}>
                    {dayLabel}
                  </h4>
                  <span className="text-xs font-bold text-text-muted">
                    {format(dayDate, 'd MMM', { locale: pl })}
                  </span>
                </div>
                {isToday && (
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-2xs font-black uppercase tracking-wider text-primary">
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
                      <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Harmonogram</span>
                    </div>
                    <div className="space-y-1.5 pl-3 border-l border-border-custom/50">
                      {dayEvents.map((ev, idx) => (
                        <div key={idx} className="flex items-baseline gap-1.5 text-xs font-semibold text-text-secondary font-display">
                          <span className="text-primary font-black shrink-0 text-2xs mr-1">
                            {new Date(ev.start_time!).toLocaleTimeString('pl-PL', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })}
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
                      <Target size={11} className="text-success shrink-0" />
                      <span className="text-2xs font-black uppercase tracking-wider text-text-muted font-display">Plan dnia</span>
                    </div>
                    <div className="space-y-2 pl-3 border-l border-border-custom/50">
                      {[0, 1, 2, 3, 4].map((slotIdx) => {
                        if (!dayWin) return null;
                        const task = dayWin[`task_${slotIdx + 1}` as keyof typeof dayWin];
                        const done = dayWin[`done_${slotIdx + 1}` as keyof typeof dayWin];
                        if (!task) return null;
                        const isInteractive = isToday;
                        return (
                          <div
                            key={slotIdx}
                            onClick={() => isInteractive && togglePowerListTask(dayWin!, slotIdx)}
                            className={`flex items-center gap-2 text-xs font-medium transition-all duration-[var(--motion-medium)] ${isInteractive ? 'cursor-pointer active:scale-[var(--ds-arbitrary-0-98)]' : ''}`}
                          >
                            <div className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition-all duration-[var(--motion-slow)] ${
                              done ? 'border-success bg-success text-on-accent' : 'border-border-custom bg-surface'
                            }`}>
                              {done && <Check size={8} strokeWidth={3} className="text-on-accent" />}
                            </div>
                            <span className={`truncate ${done ? 'line-through text-text-muted opacity-[var(--opacity-70)]' : 'text-text-primary'}`}>
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

      {/* 5. Cele tygodnia (z przeglądu niedzielnego) */}
      {currentReview && (currentReview.week_goal_cialo || currentReview.week_goal_duch || currentReview.week_goal_konto) && (
        <Card padding="1rem" className="space-y-3">
          <p className="text-2xs font-black uppercase tracking-widest text-text-muted font-display">Cele tego tygodnia</p>
          {currentReview.week_intention && (
            <p className="text-xs font-semibold text-text-secondary italic">„{currentReview.week_intention}"</p>
          )}
          <div className="space-y-2">
            {[
              { key: 'week_goal_cialo' as const, label: 'Ciało', color: 'text-success dark:text-success', bg: 'bg-success/10' },
              { key: 'week_goal_duch' as const,  label: 'Duch',  color: 'text-primary dark:text-primary',   bg: 'bg-primary/10'  },
              { key: 'week_goal_konto' as const, label: 'Konto', color: 'text-warning dark:text-warning',     bg: 'bg-warning/10'   },
            ].filter(g => currentReview[g.key]).map(g => (
              <div key={g.key} className="flex items-start gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-3xs font-black uppercase tracking-widest ${g.bg} ${g.color}`}>{g.label}</span>
                <span className="text-sm font-semibold text-text-primary leading-snug">{currentReview[g.key]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 6. Sentyment */}
      <div className="space-y-3">
        {currentReview?.week_sentiment && (
          <Card padding="0.875rem 1rem" className="flex items-center justify-between">
            <span className="text-2xs font-black uppercase tracking-widest text-text-muted font-display">Sentyment tygodnia</span>
            <span className={`text-2xs font-black uppercase tracking-wide rounded-full px-2.5 py-0.5 ${
              currentReview.week_sentiment === 'excellent' ? 'bg-success/15 text-success dark:text-success'
              : currentReview.week_sentiment === 'good' ? 'bg-info/15 text-info dark:text-info'
              : currentReview.week_sentiment === 'ok' ? 'bg-warning/15 text-warning dark:text-warning'
              : 'bg-danger/15 text-danger dark:text-danger'
            }`}>
              {SENTIMENTS.find((s) => s.value === currentReview.week_sentiment)?.label}
            </span>
          </Card>
        )}
      </div>

    </div>
  );
}
