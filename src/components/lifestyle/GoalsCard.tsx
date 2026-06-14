import { useEffect, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Shield, Zap, Wallet, Edit2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../lib/database.types';

type LifeGoalRow = Tables<'life_goals'>;
type GoalKey = 'goal_cialo' | 'goal_duch' | 'goal_konto';
type GoalDateKey = 'date_cialo' | 'date_duch' | 'date_konto';

const GOALS = [
  { key: 'goal_cialo', dateKey: 'date_cialo', label: 'Ciało', icon: Shield, tone: 'text-dayC', border: 'border-dayC/20', bg: 'bg-dayC/8' },
  { key: 'goal_duch', dateKey: 'date_duch', label: 'Duch', icon: Zap, tone: 'text-primary', border: 'border-primary/20', bg: 'bg-primary/8' },
  { key: 'goal_konto', dateKey: 'date_konto', label: 'Konto', icon: Wallet, tone: 'text-orange-300', border: 'border-orange-400/20', bg: 'bg-orange-400/8' },
];

export default function GoalsCard({ session, onEditClick = null }: { session: Session; onEditClick?: (() => void) | null }) {
  const [goals, setGoals] = useState<LifeGoalRow | null>(null);

  useEffect(() => {
    supabase.from('life_goals').select('*')
      .eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => { if (data) setGoals(data); });
  }, [session.user.id]);

  if (!goals) return null;

  const hasAny = GOALS.some(g => goals[g.key]);
  if (!hasAny) return null;

  const THEME_GOALS = {
    goal_cialo: { bg: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/10 dark:border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
    goal_duch: { bg: 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/10 dark:border-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400' },
    goal_konto: { bg: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/10 dark:border-amber-500/20', text: 'text-amber-600 dark:text-amber-400' }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">Cele kierunkowe</p>
        {onEditClick && (
          <button onClick={onEditClick} className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <Edit2 size={12} />
          </button>
        )}
      </div>
      <div className="grid gap-2.5">
        {GOALS.map(({ key, dateKey, icon: Icon, tone }) => {
          const goalKey = key as GoalKey;
          const goalDateKey = dateKey as GoalDateKey;
          const text = goals[goalKey];
          if (!text) return null;
          const days = goals[goalDateKey] ? differenceInDays(parseISO(goals[goalDateKey]), new Date()) : null;
          const urgent = days !== null && days <= 30;
          
          const theme = THEME_GOALS[key] || { bg: 'bg-surface-solid/40 border-border-custom', text: tone };

          return (
            <div key={key} className={`flex items-start gap-3 rounded-[20px] border ${theme.bg} p-3.5 shadow-sm`}>
              <Icon size={14} className={`${theme.text} mt-0.5 shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-relaxed text-text-primary">{text}</p>
              </div>
              {days !== null && (
                <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-bold border ${
                  urgent 
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                    : 'bg-surface-solid/40 border-border-custom text-text-secondary'
                }`}>
                  {days}d
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
