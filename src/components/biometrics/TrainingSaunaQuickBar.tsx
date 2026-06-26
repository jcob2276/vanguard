import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Dumbbell, Flame, Trash2 } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';
import {
  deleteSaunaSession,
  fetchTodaySaunaEntries,
  type TodaySaunaEntry,
} from '../../lib/workoutLogging';

export default function TrainingSaunaQuickBar({
  session,
  refreshSignal = 0,
  onOpenWorkout,
  onOpenSauna,
}: {
  session: Session;
  refreshSignal?: number;
  onOpenWorkout: () => void;
  onOpenSauna: () => void;
}) {
  const userId = session.user.id;
  const haptics = useHaptics();
  const [entries, setEntries] = useState<TodaySaunaEntry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(await fetchTodaySaunaEntries(userId));
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  const remove = async (id: string) => {
    if (deletingId) return;
    haptics.light();
    setDeletingId(id);
    try {
      await deleteSaunaSession(userId, id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="animate-fadeIn rounded-[24px] border border-border-custom bg-surface p-3 shadow-sm space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenWorkout}
          className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-primary/25 bg-primary/[0.08] px-3 py-3 text-center transition-all hover:bg-primary/12 active:scale-[0.98] cursor-pointer"
        >
          <Dumbbell size={18} className="text-primary" />
          <span className="text-[11px] font-black uppercase tracking-wider text-primary">Trening</span>
        </button>
        <button
          type="button"
          onClick={onOpenSauna}
          className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-orange-500/25 bg-orange-500/[0.08] px-3 py-3 text-center transition-all hover:bg-orange-500/12 active:scale-[0.98] cursor-pointer"
        >
          <Flame size={18} className="text-orange-500" />
          <span className="text-[11px] font-black uppercase tracking-wider text-orange-600">Sauna</span>
        </button>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-1.5 border-t border-border-custom/60 pt-2.5">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Dziś · sauna</p>
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded-xl border border-orange-500/15 bg-background/30 px-3 py-2"
            >
              <Flame size={12} className="text-orange-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-text-primary">
                  {e.minutes} min{e.celsius ? ` · ${e.celsius}°C` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={deletingId === e.id}
                onClick={() => void remove(e.id)}
                className="p-1 text-text-muted hover:text-rose-500 cursor-pointer disabled:opacity-40"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-text-muted leading-snug px-0.5">
          Sauna trafia do historii treningów (Trener → Siłownia) i do strain / Regeneracji.
        </p>
      )}
    </section>
  );
}
