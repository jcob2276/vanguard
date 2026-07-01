import { getSprintInfo } from '../components/desktop/desktopUtils';
import type { LifeGoalDisplayRow } from './lifeGoals';
import type { WeekDirectionGoals } from './growthWeek';
import type { Json, Tables, TablesInsert, TablesUpdate } from './database.types';
import type { MonthlyReviewRow, MonthlyReviewFields } from './monthReview';

export type { MonthlyReviewRow, MonthlyReviewFields } from './monthReview';
export type { SprintProjectDecision } from './sprintReview';

export type WeekReviewRow = Pick<
  Tables<'weekly_reviews'>,
  'week_start' | 'week_intention' | 'week_commitment' | 'week_goal_cialo' | 'week_goal_duch' | 'week_goal_konto'
>;

export type WeeklyReviewRow = Tables<'weekly_reviews'>;

export type LifeGoalDeclarations = Pick<
  Tables<'life_goals'>,
  | 'goal_cialo'
  | 'goal_duch'
  | 'goal_konto'
  | 'date_cialo'
  | 'date_duch'
  | 'date_konto'
  | 'bhag_pillar'
>;

export type SprintContext = ReturnType<typeof getSprintInfo> & {
  goalText: string | null;
  label: string;
  isClosingWeek: boolean;
  /** Active projects chosen at prior sprint close. */
  focusProjectIds: string[];
};

export type SprintReview = Pick<
  Tables<'sprint_reviews'>,
  'personal_year' | 'sprint_number' | 'reflection' | 'completed_at'
>;

export type ResolvedWeekGoals = WeekDirectionGoals & {
  weekStart: string;
  source: 'week' | 'fallback' | 'empty';
  fallbackWeekStart: string | null;
};

export type LongTermGoals = {
  declarations: LifeGoalDeclarations | null;
  projects: LifeGoalDisplayRow[];
};

export type GoalSpine = {
  weekStart: string;
  sprint: SprintContext;
  month: MonthlySpineSlice;
  week: ResolvedWeekGoals;
  longTerm: LongTermGoals;
  sprintReview: SprintReview | null;
};

export type MonthlySpineSlice = {
  closingMonthStart: string | null;
  review: MonthlyReviewRow | null;
  due: boolean;
  /** Theme for the live calendar month (from prior month's review). */
  activeTheme: string | null;
  activeMonthLabel: string | null;
};

export type WeeklyReviewBundle = {
  current: WeeklyReviewRow | null;
  previous: WeeklyReviewRow | null;
  latest: WeeklyReviewRow | null;
};

export type StrategicGaps = {
  projects_without_kpi: string[];
  pillars_with_declaration_no_active_project: Array<'cialo' | 'duch' | 'konto'>;
  dreams_without_active_project: string[];
};

export type GoalSpineAiSnapshot = {
  week_start: string;
  week_goals: WeekDirectionGoals;
  week_source: ResolvedWeekGoals['source'];
  fallback_week_start: string | null;
  sprint: {
    label: string;
    goal: string | null;
    number: number;
    personal_year: number;
    week_in_sprint: number;
    pct: number;
    is_closing_week: boolean;
    review_completed: boolean;
    focus_project_ids: string[];
  };
  sprint_review: {
    reflection: string | null;
    completed: boolean;
  } | null;
  long_term: {
    declarations: LifeGoalDeclarations | null;
    projects: { title: string; pillar: string; project_id: string | null; kpis: { name: string; current: number | null; target: number | null; unit?: string | null }[] }[];
  };
  month: {
    label: string;
    theme: string | null;
    review_due: boolean;
  };
  long_term_bhag: string | null;
};

export type ProjectRow = Pick<
  Tables<'projects'>,
  'id' | 'name' | 'goal' | 'deadline' | 'color' | 'dream_id' | 'status'
>;
export type DreamRow = Pick<Tables<'dreams'>, 'id' | 'life_goal'>;

export type WeeklyReflectionFields = {
  proud_of?: string | null;
  do_differently?: string | null;
  sabotage?: string | null;
  obligation?: string | null;
  week_highlight?: string | null;
  week_regret?: string | null;
  new_belief?: string | null;
  pillar_scores?: Json;
  bottleneck?: string | null;
};

export type WeeklyPlanFields = {
  week_intention?: string | null;
  week_commitment?: string | null;
  week_goal_cialo?: string | null;
  week_goal_duch?: string | null;
  week_goal_konto?: string | null;
  deepening_answers?: Record<string, string> | null;
};

export type GoalKpiRow = Tables<'goal_kpis'>;

export type ProjectWeekKpi = {
  kpi: GoalKpiRow;
  thisWeekValue: number | null;
};

export type RollupDecision = { kpiId: string; delta: number } | null;

export type CompleteWeeklyReviewOptions = {
  /** Sunday ritual: plan fields go on the upcoming week, reflection stays on closing week. */
  planWeekStart?: string | null;
};

export type DailyWinRow = Tables<'daily_wins'>;
export type DailyWinUpdate = TablesUpdate<'daily_wins'>;
export type DailyWinInsert = TablesInsert<'daily_wins'>;
