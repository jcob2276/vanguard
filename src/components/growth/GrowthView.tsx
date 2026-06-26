import { useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw, warsawDayBoundsISO } from '../../lib/date';
import { notify } from '../../lib/notify';
import { useGrowthData } from '../../hooks/useGrowthData';
import {
  formatWeekRange,
  getWeekStartWarsaw,
  isCurrentWeek,
  partitionSkillTree,
  scoresFromSnapshot,
  shiftWeekStart,
} from '../../lib/growth';
import { getWeekEndExclusive } from '../../lib/growthWeek';
import { restoreDefaultSkillTree } from '../../lib/growthSeed';
import { DEFAULT_SKILL_TREE } from '../../lib/growthSkills';
import {
  buildLearningNeed,
  buildMediaQueue,
  buildSkillInventory,
  buildWeekLearningLog,
  deriveFocusProposal,
  filterReadLinksInWeek,
} from '../../lib/growthOverview';
import GrowthLearningPanel from './GrowthLearningPanel';
import GrowthMediaQueue from './GrowthMediaQueue';
import GrowthProjectsPanel from './GrowthProjectsPanel';
import GrowthSkillsList from './GrowthSkillsList';
import { pinTitle } from './PinPickerModal';
import SkillTreePanel from './SkillTreePanel';

export default function GrowthView({ session }: { session: Session }) {
  const userId = session.user.id;
  const [weekStart, setWeekStart] = useState(() => getWeekStartWarsaw(getTodayWarsaw()));
  const {
    skills,
    snapshots,
    focus,
    pins,
    unreadLinks,
    readLinks,
    openTodos,
    context,
    loading,
    weekNotes,
    weekFocusScore,
    activeProjects,
    refresh,
  } = useGrowthData(userId, weekStart);

  const [showScores, setShowScores] = useState(false);
  const [editingScores, setEditingScores] = useState(false);
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  const { parents, childrenByParentId } = useMemo(() => partitionSkillTree(skills), [skills]);
  const skillsById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const hasLegacySkillTree = useMemo(() => {
    const expected = new Set(DEFAULT_SKILL_TREE.map((n) => n.key));
    return parents.length === 0 || parents.some((p) => !expected.has(p.key));
  }, [parents]);

  const readOnly = !isCurrentWeek(weekStart);
  const latestSnapshot = snapshots[0] ?? null;
  const currentScores = useMemo(
    () => scoresFromSnapshot(skills, latestSnapshot),
    [skills, latestSnapshot],
  );

  const allLinks = useMemo(() => {
    const m = new Map<string, (typeof unreadLinks)[0]>();
    [...unreadLinks, ...readLinks].forEach((l) => m.set(l.id, l));
    return [...m.values()];
  }, [unreadLinks, readLinks]);
  const linksById = useMemo(() => new Map(allLinks.map((l) => [l.id, l])), [allLinks]);
  const todosById = useMemo(() => new Map(openTodos.map((t) => [t.id, t])), [openTodos]);

  const focusProposal = useMemo(
    () => deriveFocusProposal(parents, childrenByParentId, currentScores, focus, skillsById),
    [parents, childrenByParentId, currentScores, focus, skillsById],
  );

  const focusParentId = focusProposal?.parentId ?? focus?.skill_id ?? null;
  const skillInventory = useMemo(
    () => buildSkillInventory(parents, childrenByParentId, currentScores, focusParentId),
    [parents, childrenByParentId, currentScores, focusParentId],
  );

  const learningNeed = useMemo(
    () => buildLearningNeed(focusProposal, focus, parents, childrenByParentId, currentScores),
    [focusProposal, focus, parents, childrenByParentId, currentScores],
  );

  const { fromISO: weekFromISO } = useMemo(() => warsawDayBoundsISO(weekStart), [weekStart]);
  const weekEnd = useMemo(() => getWeekEndExclusive(weekStart), [weekStart]);
  const readLinksThisWeek = useMemo(
    () => filterReadLinksInWeek(readLinks, weekFromISO),
    [readLinks, weekFromISO],
  );

  const weekLearningLog = useMemo(
    () =>
      buildWeekLearningLog({
        pins,
        resolvePinTitle: (pin) => pinTitle(pin, linksById, todosById),
        weekNotes,
        readLinksThisWeek,
        snapshots: snapshots.map((s) => ({ snapshot_date: s.snapshot_date, scores: s.scores })),
        skills,
        weekStart,
        weekEnd,
      }),
    [pins, linksById, todosById, weekNotes, readLinksThisWeek, snapshots, skills, weekStart, weekEnd],
  );

  const mediaQueue = useMemo(() => buildMediaQueue(unreadLinks, 16), [unreadLinks]);

  const mustDone = pins.filter((p) => p.slot === 'must' && p.done).length;
  const mustTotal = pins.filter((p) => p.slot === 'must').length;

  const theme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const startEditScores = () => {
    setDraftScores({ ...currentScores });
    setEditingScores(true);
    setShowScores(true);
  };

  const saveScores = async () => {
    setSavingScores(true);
    try {
      const today = getTodayWarsaw();
      const { error } = await supabase.from('learning_skill_snapshots').upsert(
        { user_id: userId, snapshot_date: today, scores: draftScores },
        { onConflict: 'user_id,snapshot_date' },
      );
      if (error) throw error;
      setEditingScores(false);
      notify('Zapisano oceny skilli', 'success');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd zapisu', 'error');
    } finally {
      setSavingScores(false);
    }
  };

  const handleRestoreSkillTree = async () => {
    try {
      await restoreDefaultSkillTree(supabase, userId);
      notify('Przywrócono domyślne skilli', 'success');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const directionLine =
    context.weekGoals.intention ||
    context.weekGoals.commitment ||
    context.sprintGoal ||
    null;

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <header className="sticky top-0 z-30 w-full border-b border-border-custom bg-background/95 backdrop-blur-md">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="rounded-xl border border-border-custom p-2.5 text-text-muted hover:text-text-primary shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black font-display uppercase tracking-tight">Rozwój</h1>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setWeekStart((w) => shiftWeekStart(w, -1))}
                className="p-1 text-text-muted hover:text-primary cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[12px] font-bold text-text-muted">{formatWeekRange(weekStart)}</span>
              <button
                type="button"
                onClick={() => setWeekStart((w) => shiftWeekStart(w, 1))}
                disabled={isCurrentWeek(weekStart)}
                className="p-1 text-text-muted hover:text-primary disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={startEditScores}
              className="rounded-xl border border-border-custom px-3 py-2 text-[10px] font-black uppercase text-text-muted hover:text-text-primary cursor-pointer shrink-0"
            >
              Oceń skilli
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-16 space-y-6">
        {!loading && hasLegacySkillTree && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
            <p className="text-[12px] text-text-secondary">
              Stara lista skilli w bazie — przywróć drzewo życiowe, żeby mapa miała sens.
            </p>
            <button
              type="button"
              onClick={() => void handleRestoreSkillTree()}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase text-white cursor-pointer"
            >
              Przywróć domyślne
            </button>
          </div>
        )}

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-surface border border-border-custom" />
        ) : (
          <>
            {directionLine && (
              <div className="rounded-xl border border-border-custom bg-surface/20 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
                <span className="text-text-secondary line-clamp-2 flex-1 min-w-[200px]">
                  <span className="font-black uppercase text-text-muted mr-2">Kontekst</span>
                  {directionLine}
                </span>
                <span className="text-text-muted tabular-nums shrink-0">
                  MUST {mustDone}/{mustTotal}
                </span>
                {weekFocusScore != null && (
                  <span className="text-text-muted tabular-nums shrink-0">
                    Focus {weekFocusScore}%
                  </span>
                )}
              </div>
            )}

            <GrowthProjectsPanel
              projects={activeProjects}
              userId={userId}
              sprintGoal={context.sprintGoal}
              sprintLabel={context.sprintLabel}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4">
                <GrowthSkillsList
                  rows={skillInventory}
                  onEditScores={startEditScores}
                  readOnly={readOnly}
                />
              </div>
              <div className="lg:col-span-4">
                <GrowthLearningPanel
                  primary={learningNeed.primary}
                  alsoWeak={learningNeed.alsoWeak}
                  drill={learningNeed.drill}
                  weekItems={weekLearningLog}
                  readOnly={readOnly}
                />
              </div>
              <div className="lg:col-span-4">
                <GrowthMediaQueue links={mediaQueue} />
              </div>
            </div>
          </>
        )}
      </div>

      {showScores && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border-custom bg-background shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-border-custom px-4 py-3 bg-background">
              <p className="text-[11px] font-black uppercase text-text-muted">Oceny skilli · 0–5</p>
              <div className="flex gap-2">
                {editingScores && (
                  <button
                    type="button"
                    onClick={() => void saveScores()}
                    disabled={savingScores}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[9px] font-black uppercase text-white cursor-pointer"
                  >
                    <Save size={10} /> Zapisz
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowScores(false);
                    setEditingScores(false);
                  }}
                  className="p-1 text-text-muted cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4">
              <SkillTreePanel
                parents={parents}
                childrenByParentId={childrenByParentId}
                scores={editingScores ? draftScores : currentScores}
                prevScores={null}
                showPrev={false}
                editing={editingScores}
                draftScores={draftScores}
                onDraftChange={(key, val) => setDraftScores((d) => ({ ...d, [key]: val }))}
                grid={grid}
                expandedParentId={expandedParentId}
                onExpandParent={setExpandedParentId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
