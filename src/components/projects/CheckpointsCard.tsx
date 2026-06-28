import { useState } from 'react';
import { AlertTriangle, CalendarDays, Check, ChevronRight, Flag, Shield, Wallet, Zap } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';
import { useUpcomingCheckpoints } from '../../hooks/useUpcomingCheckpoints';
import { markCheckpointDone } from '../../lib/checkpoints';

const PILLAR_ICON = {
  cialo: Shield,
  duch: Zap,
  konto: Wallet,
};

const PILLAR_COLOR = {
  cialo: 'text-emerald-500',
  duch: 'text-indigo-500',
  konto: 'text-amber-500',
};

const DOT_COLOR = {
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

export default function CheckpointsCard({ session, onNavigateTo }: { session: any; onNavigateTo?: (dest: string) => void }) {
  const userId = session?.user?.id;
  const haptics = useHaptics();
  const { items, overdue, upcoming, loading, reload } = useUpcomingCheckpoints(userId, 14);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const markDone = async (id: string) => {
    setCompletingId(id);
    haptics.success();
    try {
      await markCheckpointDone(id);
      setTimeout(() => void reload(), 280);
    } catch (err) {
      console.warn('[CheckpointsCard] markDone failed:', err);
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="animate-fadeIn rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag size={13} className="text-primary" />
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">
            Checkpointy · {items.length}
          </p>
        </div>
        {onNavigateTo && (
          <button
            onClick={() => onNavigateTo('projekty')}
            className="flex items-center gap-0.5 text-[10px] font-bold text-text-muted hover:text-primary transition-colors cursor-pointer"
          >
            Projekty <ChevronRight size={11} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {overdue.map((cp) => {
          const proj = cp.project;
          const PillarIcon = PILLAR_ICON[proj.pillar as keyof typeof PILLAR_ICON] ?? Flag;
          const dotClass = DOT_COLOR[proj.color as keyof typeof DOT_COLOR] ?? 'bg-primary';
          const completing = completingId === cp.id;
          return (
            <div key={cp.id} className={`flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-3.5 py-2.5 transition-all duration-300 ${completing ? 'scale-95 opacity-0' : ''}`}>
              <div className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-text-primary leading-tight">{cp.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <PillarIcon size={9} className={PILLAR_COLOR[proj.pillar as keyof typeof PILLAR_COLOR] ?? 'text-text-muted'} />
                  <span className="text-[10px] text-text-muted truncate">{proj.name}</span>
                  <span className="text-[10px] font-black text-rose-500 flex items-center gap-0.5">
                    <AlertTriangle size={9} /> {cp.daysLate === 1 ? '1 dzień' : `${cp.daysLate} dni`} po terminie
                  </span>
                </div>
              </div>
              <button
                onClick={() => markDone(cp.id)}
                disabled={completing}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-custom bg-surface-solid hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-500 text-text-muted transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Check size={12} strokeWidth={3} />
              </button>
            </div>
          );
        })}

        {upcoming.map((cp) => {
          const isUrgent = cp.daysLeft <= 3;
          const proj = cp.project;
          const PillarIcon = PILLAR_ICON[proj.pillar as keyof typeof PILLAR_ICON] ?? Flag;
          const dotClass = DOT_COLOR[proj.color as keyof typeof DOT_COLOR] ?? 'bg-primary';
          const completing = completingId === cp.id;
          return (
            <div key={cp.id} className={`flex items-center gap-3 rounded-2xl border border-border-custom bg-surface-solid/40 px-3.5 py-2.5 transition-all duration-300 ${completing ? 'scale-95 opacity-0' : ''}`}>
              <div className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-text-primary leading-tight">{cp.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <PillarIcon size={9} className={PILLAR_COLOR[proj.pillar as keyof typeof PILLAR_COLOR] ?? 'text-text-muted'} />
                  <span className="text-[10px] text-text-muted truncate">{proj.name}</span>
                  <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isUrgent ? 'text-amber-500' : 'text-text-muted'}`}>
                    <CalendarDays size={9} />
                    {cp.daysLeft === 0 ? 'dziś' : `${cp.daysLeft}d`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => markDone(cp.id)}
                disabled={completing}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-custom bg-surface-solid hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-500 text-text-muted transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Check size={12} strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
