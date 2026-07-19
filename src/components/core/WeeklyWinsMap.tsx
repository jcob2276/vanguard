import { CheckSquare } from 'lucide-react';
import { useWeeklyWinsMap } from '../../lib/weeklyWinsMap';
import { useUserId } from '../../store/useStore';

export default function WeeklyWinsMap() {
  const userId = useUserId();
  const { data, isLoading } = useWeeklyWinsMap(userId ?? '');
  if (!userId) return null;

  const wins = data?.filter((d) => d.status === 'win').length ?? 0;
  const tasksDone = (data ?? []).reduce((s, d) => s + d.doneCount, 0);
  const tasksSet = (data ?? []).reduce((s, d) => s + d.plannedCount, 0);
  const daysActive = (data ?? []).filter((d) => d.doneCount > 0 || d.plannedCount > 0).length;

  return (
    <section className="rounded-3xl border border-border-custom/60 bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-widest text-text-muted">
            <CheckSquare size={12} /> Power list · 7 dni
          </p>
          <p className="mt-1 text-base font-bold text-text-primary">
            {isLoading
              ? 'Ładuję mapkę…'
              : `${wins}/7 dni z 5/5`}
          </p>
          {!isLoading && (
            <p className="mt-0.5 text-xs text-text-muted">
              {tasksDone}/{tasksSet || '?'} zadań · {daysActive}d aktywnych
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 border-t border-border-custom/40 pt-3">
        {(data ?? Array.from({ length: 7 }, (_, i) => ({
          date: `p-${i}`,
          label: '·',
          result: null as const,
          doneCount: 0,
          plannedCount: 0,
          status: 'open' as const,
        }))).map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <div
              title={`${day.date}: ${day.doneCount}/${day.plannedCount || 5}${day.result ? ` · ${day.result}` : ''}`}
              className={`flex aspect-square w-full max-w-11 items-center justify-center rounded-lg border text-2xs font-black ${cellClass(day.status)}`}
            >
              {day.status === 'open' && day.doneCount > 0 ? day.doneCount : null}
            </div>
            <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">{day.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-2xs font-bold text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm border ${cellClass('win')}`} /> 5/5 wygrany
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm border ${cellClass('loss')}`} /> nie / brak
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-border-custom bg-surface" /> dziś
        </span>
      </div>
    </section>
  );
}

function cellClass(status: 'win' | 'loss' | 'open'): string {
  if (status === 'win') return 'border-dayC/50 bg-dayC/20 text-dayC';
  if (status === 'loss') return 'border-dayB/50 bg-dayB/20 text-dayB';
  return 'border-border-custom bg-surface text-text-muted';
}
