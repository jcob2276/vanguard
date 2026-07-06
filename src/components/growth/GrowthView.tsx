import { useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Save, X } from 'lucide-react';
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
import GrowthCockpit from './GrowthCockpit';
import GrowthWeekPlan from './GrowthWeekPlan';
import WeekLoopSummary from '../shared/WeekLoopSummary';
import { useDirectionContext } from '../../hooks/useDirectionContext';
import { computeTheoryPracticeBalance } from '../../lib/growthMastery';
import type { GrowthPinSlot } from '../../lib/growth';

function matchLinkToSkill(link: any, skillKey: string): boolean {
  const t = `${link.title || ''} ${link.description || ''} ${link.domain || ''} ${link.category || ''}`.toLowerCase();
  const keywords: Record<string, string[]> = {
    storytelling: ['storytelling', 'histori', 'opowiad', 'pitch', 'narrac'],
    setting: ['setting', 'rozmowa', 'słuchan', 'mirroring', 'pytań', 'mówien', 'pauz'],
    closing: ['closing', 'sprzedaż', 'cena', 'ceny', 'decyzj', 'handlow', 'klient', 'sales'],
    negotiation: ['negocjac', 'ustępstw', 'granic', 'negotiat', 'anchor'],
    voice_presence: ['dykcj', 'artykulac', 'głos', 'wymow', 'intonac', 'oddech', 'tempo', 'korek'],
    social_exposure: ['relacj', 'kontakt', 'poznaw', 'randk', 'kobie', 'dziewczyn', 'social', 'ludzi', 'semen', 'manifesting'],
    deep_work: ['deep work', 'produktyw', 'skup', 'egzekuc', 'prokrastyn', 'czas', 'organizac', 'wasting'],
    body_base: ['sen', 'trening', 'siłown', 'biega', 'ruch', 'diet', 'calories', 'kalori', 'regenerac', 'oura', 'health', 'sleep'],
  };
  const list = keywords[skillKey];
  if (!list) return false;
  return list.some(kw => t.includes(kw));
}

export default function GrowthView({ session }: { session: Session }) {
  const userId = session.user.id;
  const [weekStart, setWeekStart] = useState(() => getWeekStartWarsaw(getTodayWarsaw()));
  const [showMore, setShowMore] = useState(false);
  const direction = useDirectionContext(userId, weekStart);
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
  const [pickerDefaultProjectId, setPickerDefaultProjectId] = useState<string | null>(null);
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
  
  const focusSkillKey = focusParentId ? skillsById.get(focusParentId)?.key : null;
  
  // Derive which project best matches the focus skill (heuristic by name/goal keywords)
  const focusProjectId = useMemo(() => {
    if (activeProjects.length === 0) return null;
    const focusSkillId = focusParentId;
    if (focusSkillId) {
      const bySkill = activeProjects.find((p) => p.primarySkillId === focusSkillId);
      if (bySkill) return bySkill.id;
    }
    if (!focusSkillKey) return activeProjects[0]?.id ?? null;
    const skillKws: Record<string, string[]> = {
      storytelling: ['pewnosc', 'charyzma', 'komunikacja', 'sprzedaz', 'perswazja', 'storytelling'],
      voice_presence: ['pewnosc', 'charyzma', 'dykcja', 'glos'],
      closing: ['sprzedaz', 'dochod', 'klient', 'business'],
      social_exposure: ['poznawanie', 'zwiazek', 'relacj', 'ludzi'],
      body_base: ['cialo', 'tluszcz', 'trening', 'redukcja'],
      deep_work: ['praca', 'egzekucja', 'dyscyplina'],
      negotiation: ['sprzedaz', 'negocjacja'],
      setting: ['komunikacja', 'sprzedaz', 'rozmowa'],
    };
    const kws = skillKws[focusSkillKey] ?? [];
    const match = activeProjects.find(p => {
      const text = (p.name + ' ' + (p.goal ?? '')).toLowerCase();
      return kws.some(kw => text.includes(kw));
    });
    return match?.id ?? activeProjects[0]?.id ?? null;
  }, [focusSkillKey, activeProjects]);

  const focusLinks = useMemo(() => {
    if (!focusSkillKey) return [];
    return unreadLinks.filter(l => matchLinkToSkill(l, focusSkillKey));
  }, [unreadLinks, focusSkillKey]);

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
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd zapisu', 'error');
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

      notify('Gotowe!', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
    }
  };

  const handleRemovePin = async (pinId: string) => {
    try {
      const { error } = await supabase.from('learning_week_pins').delete().eq('id', pinId);
      if (error) throw error;
      notify('Odpięto element', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
    }
  };

  const handleAddMustForProject = (projectId: string) => {
    setPickerDefaultProjectId(projectId);
    setPickerSlot('must');
  };

  const openPicker = (slot: GrowthPinSlot) => {
    setPickerDefaultProjectId(focusProjectId);
    setPickerSlot(slot);
  };

  const closePicker = () => {
    setPickerSlot(null);
    setPickerDefaultProjectId(null);
  };

  const handleQuickPinLink = async (linkId: string, slot: GrowthPinSlot) => {
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId,
        week_start: weekStart,
        slot,
        entity_type: 'link',
        entity_id: linkId,
        project_id: focusProjectId,
        sort_order: pins.filter((p) => p.slot === slot).length,
      });
      if (error) throw error;
      notify('Przypięto link', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
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
        project_id: focusProjectId,
        sort_order: pins.filter((p) => p.slot === slot).length,
      });
      if (error) throw error;
      notify('Przypięto zadanie', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
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
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd zapisu', 'error');
    } finally {
      setSavingScores(false);
    }
  };

  const handleRestoreSkillTree = async () => {
    try {
      await restoreDefaultSkillTree(supabase, userId);
      notify('Przywrócono domyślne skilli', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
    }
  };


  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <header className="sticky top-0 z-30 w-full border-b border-border-custom bg-background/95 backdrop-blur-md">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-4">
          <Link
            to="/"
            className="rounded-xl border border-border-custom p-2.5 text-text-muted hover:text-text-primary shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-black font-display uppercase tracking-tight">Rozwój</h1>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setWeekStart((w) => shiftWeekStart(w, -1))} className="p-1 text-text-muted hover:text-primary cursor-pointer">
                  <ChevronLeft size={15} />
                </button>
                <span className="text-[11px] font-bold text-text-muted">{formatWeekRange(weekStart)}</span>
                <button type="button" onClick={() => setWeekStart((w) => shiftWeekStart(w, 1))} disabled={isCurrentWeek(weekStart)} className="p-1 text-text-muted hover:text-primary disabled:opacity-30 cursor-pointer">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
          {!readOnly && (
            <button type="button" onClick={startEditScores} className="rounded-xl border border-border-custom px-3 py-2 text-[10px] font-black uppercase text-text-muted hover:text-text-primary cursor-pointer shrink-0">
              Oceń skilli
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-16 space-y-6">
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-surface border border-border-custom" />
        ) : (
          <div className="space-y-6">
            {direction.weekStart && (
              <WeekLoopSummary
                compact
                ctx={{
                  weekGoals: direction.weekGoals ?? { intention: null, commitment: null, cialo: null, duch: null, konto: null },
                  powerListStats: direction.powerListStats ?? { daysLogged: 0, daysWithWins: 0, tasksDone: 0, tasksSet: 0 },
                  mustPins: direction.mustPins ?? [],
                  openMustPins: direction.openMustPins ?? [],
                  focus: direction.focus ?? { skillId: null, skillLabel: null, subskillLabel: null, targetLevel: null },
                  weekCheckpointsDone: direction.weekCheckpointsDone ?? 0,
                  weekCheckpointsDue: direction.weekCheckpointsDue ?? 0,
                  sprintGoal: direction.sprintGoal ?? null,
                  sprintLabel: direction.sprintLabel ?? null,
                  monthTheme: direction.monthTheme ?? null,
                  monthLabel: direction.monthLabel ?? null,
                  bhagLine: direction.bhagLine ?? null,
                }}
              />
            )}
            <GrowthCockpit
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
              onSetFocus={() => setShowFocusEditor(true)}
            />

            <GrowthWeekPlan
              pins={pins}
              skills={skills}
              links={allLinks}
              todos={openTodos}
              projects={activeProjects}
              focusSkillId={focusParentId}
              focusTargetLevel={focus?.target_level ?? null}
              readOnly={readOnly}
              suggestedLinks={focusLinks.length > 0 ? focusLinks : unreadLinks.slice(0, 6)}
              suggestedTodos={openTodos}
              balance={balance}
              onAddPin={openPicker}
              onQuickPinLink={handleQuickPinLink}
              onQuickPinTodo={handleQuickPinTodo}
              onDonePin={handleDonePin}
              onRemovePin={handleRemovePin}
            />

            <GrowthProjectsPanel
              projects={activeProjects}
              pins={pins}
              userId={userId}
              sprintGoal={context.sprintGoal}
              sprintLabel={context.sprintLabel}
              focusProjectId={focusProjectId}
              onAddMust={handleAddMustForProject}
              onKpiChange={() => void refresh()}
            />

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-custom py-2.5 text-[10px] font-black uppercase text-text-muted hover:text-primary hover:border-primary/30 transition-all cursor-pointer"
            >
              {showMore ? 'Mniej' : 'Więcej — skille i Keep'}
              <ChevronDown size={14} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </button>

            {showMore && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GrowthSkillsList
                  rows={skillInventory}
                  onEditScores={startEditScores}
                  readOnly={readOnly}
                  unreadLinks={unreadLinks}
                  onQuickPinLink={handleQuickPinLink}
                />
                <GrowthLearningPanel
                  primary={learningNeed.primary}
                  alsoWeak={learningNeed.alsoWeak}
                  drill={learningNeed.drill}
                  weekItems={weekLearningLog}
                  readOnly={readOnly}
                  focusLinks={focusLinks}
                  onQuickPinLink={handleQuickPinLink}
                />
                <div className="lg:col-span-2">
                  <GrowthMediaQueue links={mediaQueue} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {pickerSlot && (
        <PinPickerModal
          slot={pickerSlot}
          skills={skills}
          projects={activeProjects}
          focusSkillId={focusParentId}
          defaultProjectId={pickerDefaultProjectId ?? focusProjectId}
          unreadLinks={unreadLinks}
          openTodos={openTodos}
          pinnedLinkIds={new Set(pins.filter((p) => p.entity_type === 'link').map((p) => p.entity_id).filter(Boolean) as string[])}
          pinnedTodoIds={new Set(pins.filter((p) => p.entity_type === 'todo').map((p) => p.entity_id).filter(Boolean) as string[])}
          onClose={closePicker}
          onPickLink={async (linkId, skillId, projectId) => {
            try {
              const { error } = await supabase.from('learning_week_pins').insert({
                user_id: userId,
                week_start: weekStart,
                slot: pickerSlot,
                entity_type: 'link',
                entity_id: linkId,
                skill_id: skillId,
                project_id: projectId ?? pickerDefaultProjectId ?? focusProjectId,
                sort_order: pins.filter((p) => p.slot === pickerSlot).length,
              });
              if (error) throw error;
              notify('Przypięto link', 'success');
              closePicker();
              await refresh();
            } catch (e: unknown) {
              notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
            }
          }}
          onPickTodo={async (todoId, skillId, projectId) => {
            try {
              const { error } = await supabase.from('learning_week_pins').insert({
                user_id: userId,
                week_start: weekStart,
                slot: pickerSlot,
                entity_type: 'todo',
                entity_id: todoId,
                skill_id: skillId,
                project_id: projectId ?? pickerDefaultProjectId ?? focusProjectId,
                sort_order: pins.filter((p) => p.slot === pickerSlot).length,
              });
              if (error) throw error;
              notify('Przypięto zadanie', 'success');
              closePicker();
              await refresh();
            } catch (e: unknown) {
              notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
            }
          }}
          onPickManual={async (title, type, skillId, projectId) => {
            try {
              const { error } = await supabase.from('learning_week_pins').insert({
                user_id: userId,
                week_start: weekStart,
                slot: pickerSlot,
                entity_type: 'manual',
                manual_title: title,
                manual_resource_type: type,
                skill_id: skillId,
                project_id: projectId ?? pickerDefaultProjectId ?? focusProjectId,
                sort_order: pins.filter((p) => p.slot === pickerSlot).length,
              });
              if (error) throw error;
              notify('Dodano element do planu', 'success');
              closePicker();
              await refresh();
            } catch (e: unknown) {
              notify(e instanceof Error ? (e as Error).message : 'Błąd', 'error');
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
