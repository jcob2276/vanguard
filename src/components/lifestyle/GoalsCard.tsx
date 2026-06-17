import { useEffect, useRef, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Shield, Zap, Wallet, ChevronDown, ChevronUp, AlertTriangle, Plus, Check, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../lib/database.types';

type LifeGoalRow = Tables<'life_goals'>;
type GoalKey = 'goal_cialo' | 'goal_duch' | 'goal_konto';
type GoalDateKey = 'date_cialo' | 'date_duch' | 'date_konto';

const PILLARS = [
  { id: 'cialo', goalKey: 'goal_cialo' as GoalKey, dateKey: 'date_cialo' as GoalDateKey, label: 'Ciało', icon: Shield },
  { id: 'duch',  goalKey: 'goal_duch'  as GoalKey, dateKey: 'date_duch'  as GoalDateKey, label: 'Duch',  icon: Zap   },
  { id: 'konto', goalKey: 'goal_konto' as GoalKey, dateKey: 'date_konto' as GoalDateKey, label: 'Konto', icon: Wallet },
];

const THEME: Record<string, { card: string; accent: string; text: string; chip: string; dot: string; badge: string; inputFocus: string }> = {
  cialo: {
    card:       'bg-emerald-500/6 border-emerald-500/15',
    accent:     'bg-emerald-500/15',
    text:       'text-emerald-600 dark:text-emerald-400',
    chip:       'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot:        'bg-emerald-500',
    badge:      'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    inputFocus: 'focus:border-emerald-500/40',
  },
  duch: {
    card:       'bg-indigo-500/6 border-indigo-500/15',
    accent:     'bg-indigo-500/15',
    text:       'text-indigo-600 dark:text-indigo-400',
    chip:       'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    dot:        'bg-indigo-500',
    badge:      'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400',
    inputFocus: 'focus:border-indigo-500/40',
  },
  konto: {
    card:       'bg-amber-500/6 border-amber-500/15',
    accent:     'bg-amber-500/15',
    text:       'text-amber-600 dark:text-amber-400',
    chip:       'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot:        'bg-amber-500',
    badge:      'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    inputFocus: 'focus:border-amber-500/40',
  },
};

export default function GoalsCard({ session }: { session: Session }) {
  const [goals, setGoals]     = useState<LifeGoalRow | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Lazy-loaded for the expanded map
  const [dreams, setDreams]     = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Inline add-dream
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTitle, setNewTitle]   = useState('');
  const [saving, setSaving]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('life_goals').select('*').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => { if (data) setGoals(data); });
  }, [session.user.id]);

  useEffect(() => {
    if (!expanded || mapLoaded) return;
    const uid = session.user.id;
    Promise.all([
      supabase.from('dreams').select('id, title, life_goal, is_done').eq('user_id', uid).eq('is_done', false),
      supabase.from('projects').select('id, name, dream_id, status').eq('user_id', uid).eq('status', 'active'),
    ]).then(([{ data: d }, { data: p }]) => {
      setDreams(d ?? []);
      setProjects(p ?? []);
      setMapLoaded(true);
    });
  }, [expanded, mapLoaded, session.user.id]);

  useEffect(() => {
    if (addingFor) setTimeout(() => inputRef.current?.focus(), 50);
    else setNewTitle('');
  }, [addingFor]);

  async function addDream(pillarId: string) {
    const title = newTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    const { data, error } = await supabase.from('dreams').insert({
      user_id: session.user.id, title, life_goal: pillarId, category: 'inne',
    }).select('id, title, life_goal, is_done').single();
    setSaving(false);
    if (!error && data) { setDreams(prev => [...prev, data]); setAddingFor(null); }
  }

  async function deleteDream(id: string) {
    setDreams(prev => prev.filter(d => d.id !== id));
    await supabase.from('dreams').delete().eq('id', id).eq('user_id', session.user.id);
  }

  if (!goals) return null;
  const g = goals as any;
  if (!PILLARS.some(p => g[p.goalKey])) return null;

  const projectByDreamId = Object.fromEntries(projects.filter(p => p.dream_id).map(p => [p.dream_id, p]));

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">Cele</p>

      {/* ── 3 clean goal cards ── */}
      <div className="space-y-2.5">
        {PILLARS.map(({ id, goalKey, dateKey, label, icon: Icon }) => {
          const celText = g[goalKey];
          if (!celText) return null;
          const theme = THEME[id];
          const days = g[dateKey] ? differenceInDays(parseISO(g[dateKey]), new Date()) : null;
          const urgent = days !== null && days <= 30;

          return (
            <div key={id} className={`rounded-[24px] border ${theme.card} px-4 py-3.5 shadow-sm`}>
              {/* Header row */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`flex items-center justify-center w-6 h-6 rounded-lg ${theme.accent}`}>
                  <Icon size={12} className={theme.text} />
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${theme.text}`}>{label}</span>
                <div className="flex-1" />
                {days !== null && (
                  <span className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold ${
                    urgent ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' : theme.badge
                  }`}>
                    {days}d
                  </span>
                )}
              </div>

              {/* Goal text */}
              <p className="text-[13px] font-semibold text-text-primary leading-snug pl-1">{celText}</p>
            </div>
          );
        })}
      </div>

      {/* ── Expand toggle: Mapa marzeń ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-center gap-1.5 pt-1 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors cursor-pointer"
      >
        {expanded ? <><ChevronUp size={10} /> Zwiń</> : <><ChevronDown size={10} /> Mapa marzeń</>}
      </button>

      {/* ── Expanded: marzenia + projekty grouped by pillar ── */}
      {expanded && (
        <div className="rounded-[24px] border border-border-custom bg-surface/40 p-4 space-y-5">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Marzenia → Projekty</p>

          {!mapLoaded ? (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            PILLARS.map(({ id, goalKey, label, icon: Icon }) => {
              const celText = g[goalKey];
              if (!celText) return null;
              const theme = THEME[id];
              const pillarDreams = dreams.filter(d => d.life_goal === id);

              return (
                <div key={id} className="space-y-2">
                  {/* Pillar header */}
                  <div className="flex items-center gap-2">
                    <Icon size={10} className={theme.text} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${theme.text}`}>{label}</span>
                    <div className="flex-1 border-t border-border-custom" />
                  </div>

                  {/* Dream rows */}
                  {pillarDreams.length === 0 ? (
                    <p className="pl-4 text-[9px] italic text-text-muted/50">brak marzeń</p>
                  ) : (
                    <div className="space-y-1.5 pl-2">
                      {pillarDreams.map(dream => {
                        const proj = projectByDreamId[dream.id];
                        return (
                          <div key={dream.id} className="group flex items-center gap-2 min-w-0">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${proj ? theme.dot : 'bg-border-custom'}`} />
                            <span className="text-[11px] font-medium text-text-primary truncate flex-1">{dream.title}</span>
                            {proj ? (
                              <span className={`shrink-0 max-w-[90px] truncate rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest ${theme.chip}`}>
                                {proj.name}
                              </span>
                            ) : (
                              <span className="text-[8px] text-text-muted/40 italic shrink-0">brak projektu</span>
                            )}
                            <button
                              onClick={() => deleteDream(dream.id)}
                              className="shrink-0 opacity-0 group-hover:opacity-60 p-0.5 rounded text-text-muted hover:text-rose-500 transition-all cursor-pointer"
                            >
                              <X size={9} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline add */}
                  {addingFor === id ? (
                    <div className="flex items-center gap-1.5 pl-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot} opacity-40`} />
                      <input
                        ref={inputRef}
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addDream(id);
                          if (e.key === 'Escape') setAddingFor(null);
                        }}
                        placeholder="Marzenie..."
                        className={`min-w-0 flex-1 bg-transparent text-[11px] font-medium text-text-primary outline-none border-b border-border-custom ${theme.inputFocus} placeholder:text-text-muted/40 pb-0.5 transition-colors`}
                      />
                      <button onClick={() => addDream(id)} disabled={!newTitle.trim() || saving}
                        className={`shrink-0 p-0.5 ${theme.text} disabled:opacity-30 cursor-pointer`}>
                        <Check size={12} />
                      </button>
                      <button onClick={() => setAddingFor(null)} className="shrink-0 p-0.5 text-text-muted cursor-pointer">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingFor(id)}
                      className={`flex items-center gap-1 pl-2 text-[9px] font-bold ${theme.text} opacity-40 hover:opacity-80 transition-opacity cursor-pointer`}
                    >
                      <Plus size={9} /> marzenie
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
