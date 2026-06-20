import { useEffect, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Shield, Zap, Wallet, Crown } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';
import type { Tables } from '../../lib/database.types';

type LifeGoalRow = Tables<'life_goals'>;
type GoalKey = 'goal_cialo' | 'goal_duch' | 'goal_konto';
type GoalDateKey = 'date_cialo' | 'date_duch' | 'date_konto';

const PILLARS = [
  { id: 'cialo', goalKey: 'goal_cialo' as GoalKey, dateKey: 'date_cialo' as GoalDateKey, label: 'Ciało', icon: Shield },
  { id: 'duch',  goalKey: 'goal_duch'  as GoalKey, dateKey: 'date_duch'  as GoalDateKey, label: 'Duch',  icon: Zap   },
  { id: 'konto', goalKey: 'goal_konto' as GoalKey, dateKey: 'date_konto' as GoalDateKey, label: 'Konto', icon: Wallet },
];

const THEME: Record<string, { card: string; accent: string; text: string; badge: string }> = {
  cialo: { card: 'bg-emerald-500/6 border-emerald-500/15', accent: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  duch:  { card: 'bg-indigo-500/6 border-indigo-500/15',   accent: 'bg-indigo-500/15',   text: 'text-indigo-600 dark:text-indigo-400',   badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400'   },
  konto: { card: 'bg-amber-500/6 border-amber-500/15',     accent: 'bg-amber-500/15',     text: 'text-amber-600 dark:text-amber-400',     badge: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'       },
};

export default function GoalsCard({ session }: { session: Session }) {
  const [goals, setGoals] = useState<LifeGoalRow | null>(null);
  const [bhag, setBhag]   = useState<string | null>(null);

  useEffect(() => {
    supabase.from('life_goals').select('*').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setGoals(data); setBhag((data as any).bhag_pillar ?? null); }
      });
  }, [session.user.id]);

  async function toggleBhag(pillarId: string) {
    const next = bhag === pillarId ? null : pillarId;
    setBhag(next);
    await supabase.from('life_goals').update({ bhag_pillar: next } as any).eq('user_id', session.user.id);
  }

  if (!goals) return null;
  const g = goals as any;
  if (!PILLARS.some(p => g[p.goalKey])) return null;

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">Kierunek</p>

      <div className="space-y-2.5">
        {PILLARS.map(({ id, goalKey, dateKey, label, icon: Icon }) => {
          const celText = g[goalKey];
          if (!celText) return null;
          const theme = THEME[id];
          const days = g[dateKey] ? differenceInDays(parseISO(g[dateKey]), parseISO(getTodayWarsaw())) : null;
          const urgent = days !== null && days <= 30;

          return (
            <div key={id} className={`rounded-[24px] border ${theme.card} px-4 py-3.5 shadow-sm`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`flex items-center justify-center w-6 h-6 rounded-lg ${theme.accent}`}>
                  <Icon size={12} className={theme.text} />
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${theme.text}`}>{label}</span>
                <button
                  onClick={() => toggleBhag(id)}
                  title={bhag === id ? 'Usuń BHAG' : 'Ustaw jako BHAG #1'}
                  className={`rounded-md p-0.5 transition-colors cursor-pointer ${bhag === id ? theme.text : 'text-text-muted/25 hover:text-text-muted/60'}`}
                >
                  <Crown size={11} className={bhag === id ? 'fill-current' : ''} />
                </button>
                <div className="flex-1" />
                {bhag === id && (
                  <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${theme.badge} border`}>#1</span>
                )}
                {days !== null && (
                  <span className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold ${urgent ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' : theme.badge}`}>
                    {days}d
                  </span>
                )}
              </div>
              <p className="text-[13px] font-semibold text-text-primary leading-snug pl-1">{celText}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
