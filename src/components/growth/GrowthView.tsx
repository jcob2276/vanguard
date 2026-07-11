import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ChevronDown, Save } from 'lucide-react';
import { getTodayWarsaw } from '../../lib/date';
import { useGrowthData } from './hooks/useGrowthData';
import { getWeekStartWarsaw, shiftWeekStart } from '../../lib/growth/growth';
import Modal from '../ui/Modal';
import GrowthViewHeader from './GrowthViewHeader';
import GrowthLearningPanel from './GrowthLearningPanel';
import GrowthMediaQueue from './GrowthMediaQueue';
import GrowthProjectsPanel from './GrowthProjectsPanel';
import GrowthSkillsList from './GrowthSkillsList';
import SkillTreePanel from './SkillTreePanel';
import PinPickerModal from './PinPickerModal';
import FocusEditorModal from './FocusEditorModal';
import GrowthCockpit from './GrowthCockpit';
import GrowthWeekPlan from './GrowthWeekPlan';
import WeekLoopSummary from '../shared/WeekLoopSummary';
import { useDirectionContext } from '../lifestyle/direction/hooks/useDirectionContext';
import { useGrowthActions } from './hooks/useGrowthActions';
import { useGrowthViewDerived } from './useGrowthViewDerived';

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

  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  const {
    parents,
    childrenByParentId,
    readOnly,
    currentScores,
    allLinks,
    linksById,
    focusProposal,
    focusParentId,
    skillInventory,
    learningNeed,
    focusProjectId,
    focusLinks,
    weekLearningLog,
    mediaQueue,
    mustDone,
    mustTotal,
    balance,
    grid,
  } = useGrowthViewDerived({
    weekStart,
    skills,
    snapshots,
    focus,
    pins,
    unreadLinks,
    readLinks,
    openTodos,
    activeProjects,
    weekNotes,
  });

  const actions = useGrowthActions({ userId, weekStart, pins, focusProjectId, refresh });
  const {
    pickerSlot,
    pickerDefaultProjectId,
    showFocusEditor, setShowFocusEditor,
    draftScores, setDraftScores,
    savingScores,
    showScores, setShowScores,
    editingScores, setEditingScores,
    handleSaveFocus,
    handleDonePin,
    handleRemovePin,
    handleAddMustForProject,
    openPicker,
    closePicker,
    handleQuickPinLink,
    handleQuickPinTodo,
    startEditScores,
    saveScores,
    handlePickLink,
    handlePickTodo,
    handlePickManual,
  } = actions;

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <GrowthViewHeader
        weekStart={weekStart}
        onShiftWeek={(dir) => setWeekStart((w) => shiftWeekStart(w, dir))}
        readOnly={readOnly}
        onEditScores={() => startEditScores(currentScores)}
      />

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
                  onEditScores={() => startEditScores(currentScores)}
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
          onPickLink={handlePickLink}
          onPickTodo={handlePickTodo}
          onPickManual={handlePickManual}
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
        <Modal
          isOpen
          onClose={() => { setShowScores(false); setEditingScores(false); }}
          title="Oceny skilli · 0–5"
          size="xl"
          showCloseButton={false}
        >
          <div className="flex justify-end gap-2 -mt-1 mb-2">
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
          </div>
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
        </Modal>
      )}
    </div>
  );
}
