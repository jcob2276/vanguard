/**
 * @component DirectionPlanningMode
 * @role Tryb planowania tygodnia w Direction (recap + refleksja + pogłębienie + plan tygodnia).
 * @folders directionPlan/ = DirectionPlanBlocks (Block1Narrative/Block2WeekStats), DirectionPlanReflection,
 *          DirectionPlanDeepening, DirectionPlanWeekPlan
 * @usedBy Direction
 */
import type { Session } from "@supabase/supabase-js";
import { useDirectionContext } from "./direction/hooks/useDirectionContext";
import WeekPlanningRecap from "./WeekPlanningRecap";
import { Block1Narrative, Block2WeekStats } from "./directionPlan/DirectionPlanBlocks";
import DirectionPlanReflection from "./directionPlan/DirectionPlanReflection";
import DirectionPlanDeepening from "./directionPlan/DirectionPlanDeepening";
import DirectionPlanWeekPlan from "./directionPlan/DirectionPlanWeekPlan";

type Phase1Recap = { narrative: string; longterm_motif: string | null; question: string };
type Phase2Recap = {
  narrative_check: string;
  deepening_questions?: string[];
  block5_material?: { cialo: string; duch: string; konto: string };
};
type WeekFacts = {
  doneCount: number;
  totalCount: number;
  doneTasks: string[];
  droppedTasks: string[];
  sleepHrs: number | null;
  readiness: number | null;
  totalKm: number | null;
  avgKcal: number | null;
  targetKcal: number | null;
};

interface Props {
  session: Session;
  weekStart: string;
  planWeekStart: string;
  weekFacts: WeekFacts;
  phase1: Phase1Recap | null;
  phase1Loading: boolean;
  phase2: Phase2Recap | null;
  phase2Loading: boolean;
  prevWeekScores: { cialo?: number; duch?: number; konto?: number } | null;
  pillarScores: { cialo: number | null; duch: number | null; konto: number | null };
  setPillarScores: (s: { cialo: number | null; duch: number | null; konto: number | null }) => void;
  obligation: string; setObligation: (v: string) => void;
  doDifferently: string; setDoDifferently: (v: string) => void;
  proudOf: string; setProudOf: (v: string) => void;
  sabotage: string; setSabotage: (v: string) => void;
  weekHighlight: string; setWeekHighlight: (v: string) => void;
  weekRegret: string; setWeekRegret: (v: string) => void;
  newBelief: string; setNewBelief: (v: string) => void;
  deepeningAnswers: Record<string, string>;
  setDeepeningAnswers: (v: Record<string, string>) => void;
  weekIntention: string; setWeekIntention: (v: string) => void;
  weekCommitment: string; setWeekCommitment: (v: string) => void;
  weekGoalCialo: string; setWeekGoalCialo: (v: string) => void;
  weekGoalDuch: string; setWeekGoalDuch: (v: string) => void;
  weekGoalKonto: string; setWeekGoalKonto: (v: string) => void;
  saveReflection: () => void;
  savingReflection: boolean;
  onComplete: () => void;
  completing: boolean;
  reflectionSaved: boolean;
  activeProjects: { id: string; name: string }[];
  intentionFromMonth?: boolean;
  planCarriedFromMonth?: boolean;
}

export default function DirectionPlanningMode({
  session, weekStart, planWeekStart, weekFacts,
  phase1, phase1Loading, phase2, phase2Loading,
  prevWeekScores, pillarScores, setPillarScores,
  obligation, setObligation, doDifferently, setDoDifferently,
  proudOf, setProudOf, sabotage, setSabotage,
  weekHighlight, setWeekHighlight, weekRegret, setWeekRegret,
  newBelief, setNewBelief, deepeningAnswers, setDeepeningAnswers,
  weekIntention, setWeekIntention, weekCommitment, setWeekCommitment,
  weekGoalCialo, setWeekGoalCialo, weekGoalDuch, setWeekGoalDuch,
  weekGoalKonto, setWeekGoalKonto,
  saveReflection, savingReflection, onComplete, completing,
  reflectionSaved, activeProjects,
  intentionFromMonth = false, planCarriedFromMonth = false,
}: Props) {
  const direction = useDirectionContext(session.user.id, weekStart);
  const deepeningQuestions = phase2?.deepening_questions ?? [];
  const deepeningComplete =
    !phase2Loading &&
    (deepeningQuestions.length === 0
      ? reflectionSaved
      : deepeningQuestions.every((_, i) => (deepeningAnswers[String(i)] ?? '').trim().length > 0));

  return (
    <div className="space-y-6 pb-8">
      <WeekPlanningRecap userId={session.user.id} weekStart={weekStart} />
      <Block1Narrative phase1={phase1} phase1Loading={phase1Loading} />
      <Block2WeekStats weekFacts={weekFacts} activeProjects={activeProjects} userId={session.user.id} weekStart={weekStart} sprintFocusProjectIds={direction.sprintFocusProjectIds} />

      <DirectionPlanReflection
        obligation={obligation} setObligation={setObligation}
        doDifferently={doDifferently} setDoDifferently={setDoDifferently}
        proudOf={proudOf} setProudOf={setProudOf}
        sabotage={sabotage} setSabotage={setSabotage}
        weekHighlight={weekHighlight} setWeekHighlight={setWeekHighlight}
        weekRegret={weekRegret} setWeekRegret={setWeekRegret}
        newBelief={newBelief} setNewBelief={setNewBelief}
        pillarScores={pillarScores} setPillarScores={setPillarScores}
        prevWeekScores={prevWeekScores}
        saveReflection={saveReflection} savingReflection={savingReflection}
        reflectionSaved={reflectionSaved} phase2Loading={phase2Loading}
      />

      {reflectionSaved && (
        <DirectionPlanDeepening
          phase2={phase2} phase2Loading={phase2Loading}
          deepeningAnswers={deepeningAnswers} setDeepeningAnswers={setDeepeningAnswers}
        />
      )}

      {reflectionSaved && (
        <DirectionPlanWeekPlan
          phase2={phase2} weekStart={weekStart} planWeekStart={planWeekStart}
          direction={{ sprintGoal: direction.sprintGoal ?? null, bhagLine: direction.bhagLine ?? null, monthTheme: direction.monthTheme ?? null, monthLabel: direction.monthLabel ?? null }}
          weekIntention={weekIntention} setWeekIntention={setWeekIntention}
          weekCommitment={weekCommitment} setWeekCommitment={setWeekCommitment}
          weekGoalCialo={weekGoalCialo} setWeekGoalCialo={setWeekGoalCialo}
          weekGoalDuch={weekGoalDuch} setWeekGoalDuch={setWeekGoalDuch}
          weekGoalKonto={weekGoalKonto} setWeekGoalKonto={setWeekGoalKonto}
          onComplete={onComplete} completing={completing} deepeningComplete={deepeningComplete}
          intentionFromMonth={intentionFromMonth} planCarriedFromMonth={planCarriedFromMonth}
        />
      )}
    </div>
  );
}
