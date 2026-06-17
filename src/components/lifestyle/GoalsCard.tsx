import { useEffect, useMemo, useRef, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Shield, Zap, Wallet, Edit2, ChevronDown, ChevronUp, AlertTriangle, Plus, X, Check } from 'lucide-react';
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

const THEME: Record<string, { card: string; text: string; chip: string; dot: string; inputFocus: string }> = {
  cialo: { card: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', inputFocus: 'focus:border-emerald-500/40' },
  duch:  { card: 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/15',   text: 'text-indigo-600 dark:text-indigo-400',   chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',   dot: 'bg-indigo-500',  inputFocus: 'focus:border-indigo-500/40'  },
  konto: { card: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/15',       text: 'text-amber-600 dark:text-amber-400',     chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',      dot: 'bg-amber-500',   inputFocus: 'focus:border-amber-500/40'   },
};

export default function GoalsCard({ session, onEditClick = null }: { session: Session; onEditClick?: (() => void) | null }) {
  const [goals, setGoals] = useState<LifeGoalRow | null>(null);
  const [dreams, setDreams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [weekCounts, setWeekCounts] = useState<Record<string, number>>({});

  const [expanded, setExpanded] = useState(false);
  const [extraLoaded, setExtraLoaded] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [openItems, setOpenItems] = useState<any[]>([]);

  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const uid = session.user.id;
    supabase.from('life_goals').select('*').eq('user_id', uid).maybeSingle()
      .then(({ data }) => { if (data) setGoals(data); });
    supabase.from('dreams').select('id, title, life_goal, is_done').eq('user_id', uid).eq('is_done', false)
      .then(({ data }) => { if (data) setDreams(data); });
    supabase.from('projects').select('id, name, dream_id, status').eq('user_id', uid).eq('status', 'active')
      .then(({ data }) => { if (data) setProjects(data); });
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const weekStart = d.toISOString().split('T')[0];
    supabase.from('weekly_reviews').select('focus_goal_mappings').eq('user_id', uid).eq('week_start', weekStart).maybeSingle()
      .then(({ data }) => {
        if (!data?.focus_goal_mappings || typeof data.focus_goal_mappings !== 'object') return;
        const counts: Record<string, number> = {};
        for (const v of Object.values(data.focus_goal_mappings as Record<string, string>)) {
          if (v !== 'other') counts[v] = (counts[v] || 0) + 1;
        }
        setWeekCounts(counts);
      });
  }, [session.user.id]);

  useEffect(() => {
    if (addingFor) setTimeout(() => inputRef.current?.focus(), 50);
    else setNewTitle('');
  }, [addingFor]);

  useEffect(() => {
    if (!expanded || extraLoaded) return;
    const uid = session.user.id;
    Promise.all([
      supabase.from('todo_sections').select('id, project_id').eq('user_id', uid),
      supabase.from('todo_items').select('section_id').eq('user_id', uid).eq('status', 'open'),
    ]).then(([{ data: s }, { data: i }]) => {
      setSections(s ?? []);
      setOpenItems(i ?? []);
      setExtraLoaded(true);
    }).catch(() => {});
  }, [expanded, extraLoaded, session.user.id]);

  const projectByDreamId = useMemo(() =>
    Object.fromEntries(projects.filter(p => p.dream_id).map(p => [p.dream_id, p])),
    [projects],
  );

  const openCountByProjectId = useMemo(() => {
    const projectBySectionId = Object.fromEntries(
      sections.filter(s => s.project_id).map(s => [s.id, s.project_id])
    );
    const counts: Record<string, number> = {};
    for (const item of openItems) {
      const pid = projectBySectionId[item.section_id];
      if (pid) counts[pid] = (counts[pid] || 0) + 1;
    }
    return counts;
  }, [sections, openItems]);

  async function addDream(pillarId: string) {
    const title = newTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    const { data, error } = await supabase.from('dreams').insert({
      user_id: session.user.id,
      title,
      life_goal: pillarId,
      category: 'inne',
    }).select('id, title, life_goal, is_done').single();
    setSaving(false);
    if (!error && data) {
      setDreams(prev => [...prev, data]);
      setAddingFor(null);
      if (expanded) setExtraLoaded(false);
    }
  }

  async function deleteDream(dreamId: string) {
    setDreams(prev => prev.filter(d => d.id !== dreamId));
    await supabase.from('dreams').delete().eq('id', dreamId).eq('user_id', session.user.id);
  }

  if (!goals) return null;
  const goalsAny = goals as any;
  const hasAny = PILLARS.some(p => goalsAny[p.goalKey]);
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">Marzenia</p>
        {onEditClick && (
          <button onClick={onEditClick} className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <Edit2 size={12} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {PILLARS.map(({ id, goalKey, dateKey, label, icon: Icon }) => {
          const celText = goalsAny[goalKey];
          if (!celText) return null;
          const theme = THEME[id];
          const days = goalsAny[dateKey]
            ? differenceInDays(parseISO(goalsAny[dateKey]), new Date())
            : null;
          const urgent = days !== null && days <= 30;
          const pillarDreams = dreams.filter(d => d.life_goal === id);
          const weekKey = `goal_${id}`;
          const wc = weekCounts[weekKey] ?? 0;

          return (
            <div key={id}>
              {/* Pillar header — CEL */}
              <div className="flex items-center gap-2 mb-2">
                <Icon size={11} className={theme.text} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${theme.text}`}>{label}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-semibold text-text-muted truncate ml-1">{celText}</p>
                </div>
                {days !== null && (
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold border ${
                    urgent
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                      : 'bg-surface-solid/60 border-border-custom text-text-muted'
                  }`}>
                    {days}d
                  </span>
                )}
                {wc > 0 && (
                  <span className={`shrink-0 text-[8px] font-bold ${theme.text} opacity-60`}>↑{wc}</span>
                )}
              </div>

              {/* MARZENIA cards for this pillar */}
              <div className="space-y-2 pl-3 border-l-2 border-border-custom/40">
                {pillarDreams.map(dream => {
                  const proj = projectByDreamId[dream.id];
                  const openCount = proj ? (openCountByProjectId[proj.id] ?? 0) : 0;
                  const stalled = proj && openCount === 0 && extraLoaded;

                  return (
                    <div key={dream.id} className={`group rounded-[20px] border ${theme.card} px-3.5 py-2.5 shadow-sm min-w-0 overflow-hidden`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot}`} />
                        <p className="text-[12px] font-semibold text-text-primary truncate flex-1">{dream.title}</p>
                        <button
                          onClick={() => deleteDream(dream.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-rose-500 transition-all cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      {proj ? (
                        <div className="flex items-center gap-1.5 mt-1 pl-3.5 min-w-0">
                          <span className={`shrink-0 max-w-[110px] truncate rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${theme.chip}`}>
                            {proj.name}
                          </span>
                          {expanded && (stalled ? (
                            <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-500 shrink-0">
                              <AlertTriangle size={8} /> brak zadań
                            </span>
                          ) : extraLoaded ? (
                            <span className="text-[8px] text-text-muted shrink-0">{openCount} zadań</span>
                          ) : null)}
                        </div>
                      ) : (
                        <p className="mt-0.5 pl-3.5 text-[8px] text-text-muted/50 italic">brak projektu</p>
                      )}
                    </div>
                  );
                })}

                {/* Inline add */}
                {addingFor === id ? (
                  <div className="flex items-center gap-1.5 px-1">
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
                      className={`min-w-0 flex-1 bg-transparent text-[12px] font-medium text-text-primary outline-none border-b border-border-custom ${theme.inputFocus} placeholder:text-text-muted/40 pb-0.5 transition-colors`}
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
                    className={`flex items-center gap-1 text-[9px] font-bold ${theme.text} opacity-40 hover:opacity-90 transition-opacity cursor-pointer px-1`}
                  >
                    <Plus size={9} /> marzenie
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-center gap-1.5 pt-0.5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors cursor-pointer"
      >
        {expanded ? <><ChevronUp size={10} /> Zwiń</> : <><ChevronDown size={10} /> Mapa marzeń</>}
      </button>

      {/* Expanded map */}
      {expanded && (
        <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm space-y-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Przegląd systemu</p>
          {!extraLoaded ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {PILLARS.map(({ id, goalKey, dateKey, label, icon: Icon }) => {
                const celText = goalsAny[goalKey];
                if (!celText) return null;
                const theme = THEME[id];
                const pillarDreams = dreams.filter(d => d.life_goal === id);
                const withProj = pillarDreams.filter(d => projectByDreamId[d.id]);

                return (
                  <div key={id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon size={10} className={theme.text} />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${theme.text}`}>{label}</span>
                      <div className="flex-1 border-t border-border-custom" />
                      <span className="text-[8px] font-bold text-text-muted shrink-0">
                        {withProj.length}/{pillarDreams.length} z projektem
                      </span>
                    </div>
                    <p className="text-[9px] text-text-secondary pl-2 leading-relaxed">{celText}</p>
                    {pillarDreams.length === 0 ? (
                      <p className="pl-4 text-[9px] italic text-text-muted/50">brak marzeń</p>
                    ) : (
                      <div className="space-y-1.5 pl-3">
                        {pillarDreams.map(dream => {
                          const proj = projectByDreamId[dream.id];
                          const openCount = proj ? (openCountByProjectId[proj.id] ?? 0) : 0;
                          return (
                            <div key={dream.id} className="flex items-center gap-2 min-w-0">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${proj ? theme.dot : 'bg-border-custom'}`} />
                              <span className="text-[11px] font-medium text-text-primary truncate flex-1">{dream.title}</span>
                              {proj ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`max-w-[80px] truncate rounded px-1 py-0.5 text-[7px] font-black uppercase tracking-widest ${theme.chip}`}>
                                    {proj.name}
                                  </span>
                                  {openCount === 0 ? (
                                    <span className="flex items-center gap-0.5 text-[8px] text-amber-500 font-bold">
                                      <AlertTriangle size={8} />
                                    </span>
                                  ) : (
                                    <span className="text-[8px] text-text-muted">{openCount}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[8px] text-text-muted/40 shrink-0 italic">brak projektu</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
