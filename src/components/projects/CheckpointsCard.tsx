import { getTodayWarsaw, formatWarsawDate , nowWarsaw } from '../../lib/date';
import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, ChevronRight, Flag, Shield, Wallet, Zap } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';

const PILLAR_ICON = {
  cialo: Shield,
  duch: Zap,
  konto: Wallet,
};

const PILLAR_COLOR = {
  cialo: 'text-emerald-500',
  duch:  'text-indigo-500',
  konto: 'text-amber-500',
};

const DOT_COLOR = {
  indigo:  'bg-indigo-500',
  violet:  'bg-violet-500',
  sky:     'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  rose:    'bg-rose-500',
};

export default function CheckpointsCard({ session, onNavigateTo }: { session: any; onNavigateTo?: (dest: string) => void }) {
  const userId = session?.user?.id;
  const haptics = useHaptics();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const todayStr = getTodayWarsaw();
    const in14 = nowWarsaw();
    in14.setDate(in14.getDate() + 14);
    const in14Str = formatWarsawDate(in14);

    Promise.all([
      supabase
        .from('project_checkpoints')
        .select('id, project_id, title, due_date, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'open'])
        .lte('due_date', in14Str)
        .order('due_date', { ascending: true }),
      supabase
        .from('projects')
        .select('id, name, color, dream_id')
        .eq('user_id', userId)
        .eq('status', 'active'),
      supabase
        .from('dreams')
        .select('id, life_goal')
        .eq('user_id', userId),
    ]).then(([{ data: cps }, { data: projs }, { data: dreams }]) => {
      if (!cps || !projs) { setLoading(false); return; }
      const dreamById: Record<string, any> = {};
      (dreams ?? []).forEach((d: any) => { dreamById[d.id] = d; });
      const projMap: Record<string, any> = {};
      (projs ?? []).forEach((p: any) => {
        projMap[p.id] = { ...p, pillar: p.dream_id ? dreamById[p.dream_id]?.life_goal ?? null : null };
      });

      const enriched = (cps ?? [])
        .map((cp: any) => ({ ...cp, project: projMap[cp.project_id] }))
        .filter((cp: any) => cp.project);

      setItems(enriched);
      setLoading(false);
    }).catch(err => {
      console.error('[CheckpointsCard] Data fetch error:', err);
      setLoading(false);
    });
  }, [userId]);

  const todayStr = getTodayWarsaw();

  const markDone = async (id: string) => {
    setCompletingId(id);
    haptics.success();
    const { error } = await supabase.from('project_checkpoints').update({ status: 'done', completed_at: nowWarsaw().toISOString() }).eq('id', id);
    if (error) {
      console.warn('[CheckpointsCard] markDone failed:', error.message);
      setCompletingId(null);
      return;
    }
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 280);
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const overdue = items.filter(cp => cp.due_date < todayStr);
  const upcoming = items.filter(cp => cp.due_date >= todayStr);

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
        {overdue.map(cp => {
          const daysLate = differenceInDays(new Date(todayStr), new Date(cp.due_date));
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
                    <AlertTriangle size={9} /> {daysLate === 1 ? '1 dzień' : `${daysLate} dni`} po terminie
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

        {upcoming.map(cp => {
          const daysLeft = differenceInDays(new Date(cp.due_date), new Date(todayStr));
          const isUrgent = daysLeft <= 3;
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
                    {daysLeft === 0 ? 'dziś' : `${daysLeft}d`}
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
