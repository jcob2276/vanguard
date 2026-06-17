import { useEffect, useMemo, useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Shield, Zap, Wallet, Edit2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../lib/database.types';

type LifeGoalRow = Tables<'life_goals'>;
type GoalKey = 'goal_cialo' | 'goal_duch' | 'goal_konto';
type GoalDateKey = 'date_cialo' | 'date_duch' | 'date_konto';

const LIFE_GOAL_KEY: Record<string, string> = {
  goal_cialo: 'cialo',
  goal_duch: 'duch',
  goal_konto: 'konto',
};

const GOALS = [
  { key: 'goal_cialo', dateKey: 'date_cialo', label: 'Ciało', icon: Shield },
  { key: 'goal_duch',  dateKey: 'date_duch',  label: 'Duch',  icon: Zap   },
  { key: 'goal_konto', dateKey: 'date_konto', label: 'Konto', icon: Wallet },
];

const THEME: Record<string, { bg: string; text: string; chip: string; border: string }> = {
  goal_cialo: { bg: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/10 dark:border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
  goal_duch:  { bg: 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/10 dark:border-indigo-500/20',   text: 'text-indigo-600 dark:text-indigo-400',   chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',   border: 'border-indigo-500/20'  },
  goal_konto: { bg: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/10 dark:border-amber-500/20',       text: 'text-amber-600 dark:text-amber-400',     chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',      border: 'border-amber-500/20'   },
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

  // Lazy-load task counts when expanded
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

  if (!goals) return null;
  const goalsAny = goals as any;
  const hasAny = GOALS.some(g => goalsAny[g.key]);
  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">Cele kierunkowe</p>
        <div className="flex items-center gap-1">
          {onEditClick && (
            <button onClick={onEditClick} className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
              <Edit2 size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-2.5">
        {GOALS.map(({ key, dateKey, icon: Icon }) => {
          const text = goalsAny[key as GoalKey];
          if (!text) return null;
          const days = goalsAny[dateKey as GoalDateKey]
            ? differenceInDays(parseISO(goalsAny[dateKey as GoalDateKey]), new Date())
            : null;
          const urgent = days !== null && days <= 30;
          const theme = THEME[key];
          const lifeGoalVal = LIFE_GOAL_KEY[key];
          const linkedDreams = dreams.filter(d => d.life_goal === lifeGoalVal);

          return (
            <div key={key} className={`rounded-[24px] border ${theme.bg} p-3.5 shadow-sm`}>
              <div className="flex items-start gap-3">
                <Icon size={14} className={`${theme.text} mt-0.5 shrink-0`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-relaxed text-text-primary">{text}</p>
                  {(weekCounts[key] ?? 0) > 0 && (
                    <p className={`mt-0.5 text-[9px] font-bold ${theme.text} opacity-70`}>
                      ↑ {weekCounts[key]} {weekCounts[key] === 1 ? 'zadanie' : weekCounts[key] < 5 ? 'zadania' : 'zadań'} ten tydzień
                    </p>
                  )}
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

              {linkedDreams.length > 0 && (
                <div className="mt-2.5 space-y-1 pl-[26px]">
                  {linkedDreams.slice(0, 3).map(dream => {
                    const proj = projectByDreamId[dream.id];
                    return (
                      <div key={dream.id} className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[9px] text-text-muted shrink-0">✦</span>
                        <span className="text-[11px] text-text-secondary truncate">{dream.title}</span>
                        {proj && (
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${theme.chip}`}>
                            {proj.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {!expanded && linkedDreams.length > 3 && (
                    <p className="text-[9px] text-text-muted pl-3">+{linkedDreams.length - 3} więcej</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-center gap-1.5 pt-0.5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-primary transition-colors cursor-pointer"
      >
        {expanded ? <><ChevronUp size={10} /> Zwiń</> : <><ChevronDown size={10} /> Przegląd systemu</>}
      </button>

      {/* Bird's-eye view */}
      {expanded && (
        <div className="rounded-[24px] border border-border-custom bg-surface p-4 shadow-sm space-y-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Mapa organizmu</p>
          {!extraLoaded ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {GOALS.map(({ key, icon: Icon, label }) => {
                const text = goalsAny[key as GoalKey];
                if (!text) return null;
                const theme = THEME[key];
                const lifeGoalVal = LIFE_GOAL_KEY[key];
                const allDreams = dreams.filter(d => d.life_goal === lifeGoalVal);
                const withProject = allDreams.filter(d => projectByDreamId[d.id]);
                const withoutProject = allDreams.filter(d => !projectByDreamId[d.id]);

                return (
                  <div key={key} className="space-y-2">
                    {/* Pillar header */}
                    <div className="flex items-center gap-2">
                      <Icon size={11} className={theme.text} />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${theme.text}`}>{label}</span>
                      <div className="flex-1 border-t border-border-custom" />
                      {allDreams.length > 0 && (
                        <span className="text-[8px] font-bold text-text-muted">
                          {withProject.length}/{allDreams.length} aktywnych
                        </span>
                      )}
                    </div>

                    {allDreams.length === 0 ? (
                      <p className="pl-4 text-[9px] italic text-text-muted/50">brak marzeń pod tym celem</p>
                    ) : (
                      <div className="space-y-2 pl-3.5">
                        {allDreams.map(dream => {
                          const proj = projectByDreamId[dream.id];
                          const openCount = proj ? (openCountByProjectId[proj.id] ?? 0) : 0;
                          const stalled = proj && openCount === 0;

                          return (
                            <div key={dream.id} className="flex items-start gap-2 min-w-0">
                              <span className={`mt-[3px] text-[8px] shrink-0 ${proj ? theme.text : 'text-text-muted/40'}`}>✦</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-text-primary truncate leading-snug">{dream.title}</p>
                                {proj ? (
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${theme.chip}`}>
                                      {proj.name}
                                    </span>
                                    {stalled ? (
                                      <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-500">
                                        <AlertTriangle size={8} /> brak zadań
                                      </span>
                                    ) : (
                                      <span className="text-[8px] text-text-muted">{openCount} otwartych</span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="mt-0.5 text-[8px] text-text-muted/50 italic">brak projektu</p>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {withoutProject.length > 0 && (
                          <p className="text-[8px] text-amber-500/70 font-bold pl-3.5 mt-0.5">
                            ! {withoutProject.length} {withoutProject.length === 1 ? 'marzenie bez' : 'marzeń bez'} projektu
                          </p>
                        )}
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
