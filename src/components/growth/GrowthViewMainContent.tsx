import { ChevronDown } from 'lucide-react';
import GrowthLearningPanel from './GrowthLearningPanel';
import GrowthMediaQueue from './GrowthMediaQueue';
import GrowthProjectsPanel from './GrowthProjectsPanel';
import GrowthSkillsList from './GrowthSkillsList';
import Skeleton from '../ui/Skeleton';
import GrowthCockpit from './GrowthCockpit';
import GrowthWeekPlan from './GrowthWeekPlan';
import WeekLoopSummary from '../shared/WeekLoopSummary';
import { useGrowthData } from './hooks/useGrowthData';
import { useGrowthViewDerived } from './useGrowthViewDerived';
import { useGrowthActions } from './hooks/useGrowthActions';
import { useDirectionContext } from '../lifestyle/direction/hooks/useDirectionContext';

interface GrowthViewMainContentProps {
  loading: boolean;
  userId: string;
  direction: ReturnType<typeof useDirectionContext>;
  data: ReturnType<typeof useGrowthData>;
  derived: ReturnType<typeof useGrowthViewDerived>;
  actions: ReturnType<typeof useGrowthActions>;
  showMore: boolean;
  setShowMore: (updater: (v: boolean) => boolean) => void;
}

export default function GrowthViewMainContent({
  loading,
  userId,
  direction,
  data,
  derived,
  actions,
  showMore,
  setShowMore,
}: GrowthViewMainContentProps) {
  const {
    skills, pins, unreadLinks, openTodos, context, weekFocusScore, activeProjects, powerListStats,
    prevWeekSummary: prevWeek, focus, refresh,
  } = data;
  const {
    currentScores, allLinks, linksById, focusProposal, focusParentId, skillInventory, learningNeed,
    focusProjectId, focusLinks, weekLearningLog, mediaQueue, mustDone, mustTotal, balance, readOnly,
  } = derived;
  const { startEditScores, handleAddMustForProject, openPicker, handleQuickPinLink, handleQuickPinTodo, handleDonePin, handleRemovePin } = actions;

  if (loading) {
    return <Skeleton variant="card" className="h-64 rounded-2xl" />;
  }

  return (
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
        onSetFocus={() => actions.setShowFocusEditor(true)}
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
  );
}
