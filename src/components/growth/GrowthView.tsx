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
import PinPickerModal from './PinPickerModal';
import FocusEditorModal from './FocusEditorModal';
import GrowthOverview from './GrowthOverview';
import GrowthWeekPlan from './GrowthWeekPlan';
import { computeTheoryPracticeBalance } from '../../lib/growthMastery';
import type { GrowthPinSlot } from '../../lib/growth';

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
    powerListStats,
    prevWeekSummary: prevWeek,
    refresh,
  } = useGrowthData(userId, weekStart);

  const [showScores, setShowScores] = useState(false);
  const [editingScores, setEditingScores] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<GrowthPinSlot | null>(null);
  const [showFocusEditor, setShowFocusEditor] = useState(false);
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

  const balance = useMemo(() => computeTheoryPracticeBalance(pins, linksById), [pins, linksById]);

  const handleSaveFocus = async (
    skillId: string | null,
    why: string,
    drill: string,
    targetLevel: number,
  ) => {
    try {
      const { error } = await supabase.from('learning_week_focus').upsert(
        {
          user_id: userId,
          week_start: weekStart,
          skill_id: skillId,
          why_text: why,
          drill_text: drill,
          target_level: targetLevel,
        },
        { onConflict: 'user_id,week_start' },
      );
      if (error) throw error;
      notify('Zapisano focus tygodnia', 'success');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd zapisu', 'error');
      throw e;
    }
  };

  const handleDonePin = async (pin: typeof pins[0]) => {
    try {
      const today = getTodayWarsaw();
      const { error } = await supabase
        .from('learning_week_pins')
        .update({ done: true, done_at: today })
        .eq('id', pin.id);
      if (error) throw error;

      if (pin.entity_type === 'link' && pin.entity_id) {
        await supabase.from('vanguard_links').update({ status: 'read' }).eq('id', pin.entity_id);
      } else if (pin.entity_type === 'todo' && pin.entity_id) {
        await supabase.from('todo_items').update({ status: 'done' }).eq('id', pin.entity_id);
      }

      notify('Zrealizowano repa!', 'success');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleRemovePin = async (pinId: string) => {
    try {
      const { error } = await supabase.from('learning_week_pins').delete().eq('id', pinId);
      if (error) throw error;
      notify('Odpięto element', 'success');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleQuickPinLink = async (linkId: string, slot: GrowthPinSlot) => {
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId,
        week_start: weekStart,
        slot,
        entity_type: 'link',
        entity_id: linkId,
        sort_order: pins.filter((p) => p.slot === slot).length,
      });
      if (error) throw error;
      notify('Przypięto link', 'success');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleQuickPinTodo = async (todoId: string, slot: GrowthPinSlot) => {
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId,
        week_start: weekStart,
        slot,
        entity_type: 'todo',
        entity_id: todoId,
        sort_order: pins.filter((p) => p.slot === slot).length,
      });
      if (error) throw error;
      notify('Przypięto zadanie', 'success');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

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


        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-surface border border-border-custom" />
        ) : (
          <>
            <GrowthProjectsPanel
              projects={activeProjects}
              userId={userId}
              sprintGoal={context.sprintGoal}
              sprintLabel={context.sprintLabel}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-8 flex flex-col justify-between">
                <GrowthWeekPlan
                  pins={pins}
                  skills={skills}
                  links={allLinks}
                  todos={openTodos}
                  focusSkillId={focusParentId}
                  focusTargetLevel={focus?.target_level ?? null}
                  readOnly={readOnly}
                  suggestedLinks={unreadLinks}
                  suggestedTodos={openTodos}
                  balance={balance}
                  onAddPin={(slot) => setPickerSlot(slot)}
                  onQuickPinLink={handleQuickPinLink}
                  onQuickPinTodo={handleQuickPinTodo}
                  onDonePin={handleDonePin}
                  onRemovePin={handleRemovePin}
                />
              </div>
              <div className="lg:col-span-4 flex flex-col justify-between h-full">
                <GrowthOverview
                  context={context}
                  powerListStats={powerListStats}
                  focusProposal={focusProposal}
                  pins={pins}
                  linksById={linksById}
                  prevWeek={prevWeek}
                  mustDone={mustDone}
                  mustTotal={mustTotal}
                  weekFocusScore={weekFocusScore}
                  focusTarget={focus?.target_level ?? null}
                  readOnly={readOnly}
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setShowFocusEditor(true)}
                    className="w-full mt-3 rounded-xl border border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 py-2.5 text-[11px] font-black uppercase text-primary transition-all cursor-pointer shrink-0"
                  >
                    🎯 Ustaw focus tygodnia
                  </button>
                )}
              </div>
            </div>

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

      {pickerSlot && (
        <PinPickerModal
          slot={pickerSlot}
          skills={skills}
          focusSkillId={focusParentId}
          unreadLinks={unreadLinks}
          openTodos={openTodos}
          pinnedLinkIds={new Set(pins.filter((p) => p.entity_type === 'link').map((p) => p.entity_id).filter(Boolean) as string[])}
          pinnedTodoIds={new Set(pins.filter((p) => p.entity_type === 'todo').map((p) => p.entity_id).filter(Boolean) as string[])}
          onClose={() => setPickerSlot(null)}
          onPickLink={async (linkId, skillId) => {
            try {
              const { error } = await supabase.from('learning_week_pins').insert({
                user_id: userId,
                week_start: weekStart,
                slot: pickerSlot,
                entity_type: 'link',
                entity_id: linkId,
                skill_id: skillId,
                sort_order: pins.filter((p) => p.slot === pickerSlot).length,
              });
              if (error) throw error;
              notify('Przypięto link', 'success');
              setPickerSlot(null);
              await refresh();
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Błąd', 'error');
            }
          }}
          onPickTodo={async (todoId, skillId) => {
            try {
              const { error } = await supabase.from('learning_week_pins').insert({
                user_id: userId,
                week_start: weekStart,
                slot: pickerSlot,
                entity_type: 'todo',
                entity_id: todoId,
                skill_id: skillId,
                sort_order: pins.filter((p) => p.slot === pickerSlot).length,
              });
              if (error) throw error;
              notify('Przypięto zadanie', 'success');
              setPickerSlot(null);
              await refresh();
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Błąd', 'error');
            }
          }}
          onPickManual={async (title, type, skillId) => {
            try {
              const { error } = await supabase.from('learning_week_pins').insert({
                user_id: userId,
                week_start: weekStart,
                slot: pickerSlot,
                entity_type: 'manual',
                manual_title: title,
                manual_resource_type: type,
                skill_id: skillId,
                sort_order: pins.filter((p) => p.slot === pickerSlot).length,
              });
              if (error) throw error;
              notify('Dodano element do planu', 'success');
              setPickerSlot(null);
              await refresh();
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Błąd', 'error');
            }
          }}
        />
      )}

      {showFocusEditor && (
        <FocusEditorModal
          skills={skills}
          currentFocus={focus}
          onClose={() => setShowFocusEditor(false)}
          onSave={handleSaveFocus}
        />
      )}

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
