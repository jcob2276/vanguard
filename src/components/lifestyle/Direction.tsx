/**
 * @component Direction
 * @role Zunifikowany widok TYDZIEŃ — review/refleksja, KPI, sprint, plan miesiąca (4 tryby + WeekHub).
 * @composes DirectionMonthlyMode, DirectionSprintMode, DirectionPlanningMode (patrz jego @folders),
 *           DirectionRadarMode, WeekHub
 * @folders direction/hooks/ = useDirection (fetch+akcje, wraps directionFetcher/Actions/Keys),
 *          useDirectionContext (stan współdzielony przez tryby)
 * @usedBy DashboardTydzienTab (lazy)
 */
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import DirectionMonthlyMode from './DirectionMonthlyMode';
import DirectionSprintMode from './DirectionSprintMode';
import DirectionPlanningMode from './DirectionPlanningMode';
import DirectionRadarMode from './DirectionRadarMode';
import WeekHub from './WeekHub';
import { useDirection } from './direction/hooks/useDirection';

function SectionTitle({ icon: Icon, title, detail, action }: { icon: LucideIcon; title: string; detail?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-22em)] text-text-muted">
          <Icon size={12} /> {title}
        </p>
        {detail && <p className="mt-1 text-xs font-semibold leading-relaxed text-text-secondary">{detail}</p>}
      </div>
      {action}
    </header>
  );
}

export default function Direction({
  session,
  onOpenActionCenter,
}: {
  session: Session;
  onOpenActionCenter?: () => void;
}) {
  const {
    loading,
    history,
    currentReview,
    allCalEvents,
    planWeekLabel,
    planWeekStart,
    proudOf,
    setProudOf,
    doDifferently,
    setDoDifferently,
    sabotage,
    setSabotage,
    obligation,
    setObligation,
    weekHighlight,
    setWeekHighlight,
    weekRegret,
    setWeekRegret,
    newBelief,
    setNewBelief,
    weekIntention,
    setWeekIntention,
    weekCommitment,
    setWeekCommitment,
    weekGoalCialo,
    setWeekGoalCialo,
    weekGoalDuch,
    setWeekGoalDuch,
    weekGoalKonto,
    setWeekGoalKonto,
    pillarScores,
    setPillarScores,
    prevWeekReview,
    phase1,
    phase1Loading,
    phase2,
    phase2Loading,
    savingReflection,
    deepeningAnswers,
    setDeepeningAnswers,
    completing,
    ritualClosed,
    setForceWeeklyReview,
    monthFacts,
    monthRecap,
    monthRecapLoading,
    monthCompleting,
    patternNote,
    setPatternNote,
    leverageNote,
    setLeverageNote,
    correctionNote,
    setCorrectionNote,
    monthTheme,
    setMonthTheme,
    sprintFacts,
    sprintCompleting,
    sprintReflection,
    setSprintReflection,
    nextSprintGoal,
    setNextSprintGoal,
    projectDecisions,
    setProjectDecisions,
    intentionFromMonth,
    planCarriedFromMonth,
    showSprintMode,
    showMonthlyMode,
    monthlyComplete,
    showWeeklyPlanning,
    stats,
    prevWeekScores,
    weekFacts,
    activeProjects,
    saveReflection,
    completeMonthly,
    completeSprint,
    completeReview,
    togglePowerListTask,
    closingMonthStart,
    planTargetWeekStart,
    currentWeekStart,
  } = useDirection(session, onOpenActionCenter);

  if (loading) {
    return <div className="p-8 text-center text-text-muted uppercase font-black animate-pulse tracking-widest">Wczytywanie Kierunku...</div>;
  }

  const reflectionSaved = ritualClosed || !!currentReview?.review_completed_at || Boolean(
    currentReview?.proud_of?.trim() ||
    currentReview?.obligation?.trim() ||
    currentReview?.do_differently?.trim() ||
    currentReview?.sabotage?.trim()
  );

  return (
    <div className="flex-1 space-y-6 overflow-y-auto animate-fadeIn">

      {/* ── Tydzień ── */}
      <section className="space-y-3">
        <SectionTitle
          icon={Calendar}
          title={
            showSprintMode
              ? 'Zamknięcie sprintu'
              : showMonthlyMode && !monthlyComplete
                ? 'Przegląd miasta'
                : showWeeklyPlanning
                  ? 'Plan następnego tygodnia'
                  : 'Radar tygodnia'
          }
          detail={
            showSprintMode && sprintFacts
              ? `${sprintFacts.sprintLabel} · 12/12`
              : showMonthlyMode && !monthlyComplete && monthFacts
                ? monthFacts.monthLabel
                : planWeekLabel
          }
        />

        {showSprintMode && !sprintFacts && (
          <div className="py-6 text-center text-sm text-text-muted animate-pulse">
            Zbieram dane sprintu…
          </div>
        )}

        {showSprintMode && sprintFacts && (
          <DirectionSprintMode
            sprintFacts={sprintFacts}
            reflection={sprintReflection}
            setReflection={setSprintReflection}
            nextSprintGoal={nextSprintGoal}
            setNextSprintGoal={setNextSprintGoal}
            projectDecisions={projectDecisions}
            setProjectDecisions={setProjectDecisions}
            onComplete={completeSprint}
            completing={sprintCompleting}
          />
        )}

        {showMonthlyMode && closingMonthStart && !monthFacts && (
          <div className="py-6 text-center text-sm text-text-muted animate-pulse">
            Zbieram dane miesiąca…
          </div>
        )}

        {showMonthlyMode && closingMonthStart && monthFacts && (
          <DirectionMonthlyMode
            session={session}
            monthStart={closingMonthStart}
            monthFacts={monthFacts}
            recap={monthRecap}
            recapLoading={monthRecapLoading}
            patternNote={patternNote}
            setPatternNote={setPatternNote}
            leverageNote={leverageNote}
            setLeverageNote={setLeverageNote}
            correctionNote={correctionNote}
            setCorrectionNote={setCorrectionNote}
            monthTheme={monthTheme}
            setMonthTheme={setMonthTheme}
            onComplete={completeMonthly}
            completing={monthCompleting}
          />
        )}

        {showWeeklyPlanning ? (
          <DirectionPlanningMode
            session={session}
            weekStart={currentWeekStart}
            planWeekStart={planTargetWeekStart}
            weekFacts={weekFacts}
            phase1={phase1}
            phase1Loading={phase1Loading}
            phase2={phase2}
            phase2Loading={phase2Loading}
            prevWeekScores={prevWeekScores}
            pillarScores={pillarScores}
            setPillarScores={setPillarScores}
            obligation={obligation}
            setObligation={setObligation}
            doDifferently={doDifferently}
            setDoDifferently={setDoDifferently}
            proudOf={proudOf}
            setProudOf={setProudOf}
            sabotage={sabotage}
            setSabotage={setSabotage}
            weekHighlight={weekHighlight}
            setWeekHighlight={setWeekHighlight}
            weekRegret={weekRegret}
            setWeekRegret={setWeekRegret}
            newBelief={newBelief}
            setNewBelief={setNewBelief}
            deepeningAnswers={deepeningAnswers}
            setDeepeningAnswers={setDeepeningAnswers}
            weekIntention={weekIntention}
            setWeekIntention={setWeekIntention}
            intentionFromMonth={intentionFromMonth}
            planCarriedFromMonth={planCarriedFromMonth}
            weekCommitment={weekCommitment}
            setWeekCommitment={setWeekCommitment}
            weekGoalCialo={weekGoalCialo}
            setWeekGoalCialo={setWeekGoalCialo}
            weekGoalDuch={weekGoalDuch}
            setWeekGoalDuch={setWeekGoalDuch}
            weekGoalKonto={weekGoalKonto}
            setWeekGoalKonto={setWeekGoalKonto}
            saveReflection={saveReflection}
            savingReflection={savingReflection}
            onComplete={completeReview}
            completing={completing}
            reflectionSaved={reflectionSaved}
            activeProjects={activeProjects}
          />
        ) : (!showMonthlyMode || monthlyComplete) ? (
          <div className="space-y-6">
            <WeekHub
              session={session}
              onOpenActionCenter={onOpenActionCenter}
              onStartWeeklyReview={() => setForceWeeklyReview(true)}
            />
            <Card padding="0" style={{ background: 'var(--color-theme-hex-ba11152503)' }}>
              <p className="px-4 py-3 text-xs font-black uppercase tracking-widest text-text-muted">
                Radar szczegóły
              </p>
              <div className="px-1 pb-4 pt-1">
                <DirectionRadarMode
                  stats={stats}
                  history={history}
                  prevWeekReview={prevWeekReview}
                  planWeekStart={planWeekStart}
                  allCalEvents={allCalEvents}
                  togglePowerListTask={togglePowerListTask}
                  currentReview={currentReview}
                />
              </div>
            </Card>
          </div>
        ) : null}
      </section>

    </div>
  );
}
