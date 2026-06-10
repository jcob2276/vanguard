import { useEffect, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Shield, Zap, Wallet, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const GOALS = [
  { key: 'goal_cialo', dateKey: 'date_cialo', label: 'Ciało', icon: Shield, tone: 'text-dayC', border: 'border-dayC/20', bg: 'bg-dayC/8' },
  { key: 'goal_duch', dateKey: 'date_duch', label: 'Duch', icon: Zap, tone: 'text-primary', border: 'border-primary/20', bg: 'bg-primary/8' },
  { key: 'goal_konto', dateKey: 'date_konto', label: 'Konto', icon: Wallet, tone: 'text-orange-300', border: 'border-orange-400/20', bg: 'bg-orange-400/8' },
];

export default function GoalsCard({ session, onEditClick }) {
  const [goals, setGoals] = useState(null);

  useEffect(() => {
    supabase.from('life_goals').select('*')
      .eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => { if (data) setGoals(data); });
  }, [session.user.id]);

  if (!goals) return null;

  const hasAny = GOALS.some(g => goals[g.key]);
  if (!hasAny) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[8px] font-black uppercase tracking-[0.24em] text-white/30">Cele kierunkowe</p>
        {onEditClick && (
          <button onClick={onEditClick} className="p-1.5 text-white/25 hover:text-white transition-colors">
            <Edit2 size={11} />
          </button>
        )}
      </div>
      <div className="grid gap-2">
        {GOALS.map(({ key, dateKey, icon: Icon, tone, border, bg }) => {
          const text = goals[key];
          if (!text) return null;
          const days = goals[dateKey] ? differenceInDays(parseISO(goals[dateKey]), new Date()) : null;
          const urgent = days !== null && days <= 30;
          return (
            <div key={key} className={`flex items-start gap-3 rounded-lg border ${border} ${bg} p-3`}>
              <Icon size={13} className={`${tone} mt-0.5 shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase leading-tight text-white">{text}</p>
              </div>
              {days !== null && (
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                  urgent ? 'bg-orange-400/15 text-orange-300' : 'bg-white/[0.05] text-white/35'
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
