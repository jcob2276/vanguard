/**
 * Application Query Keys Registry (SSOT)
 *
 * Central registry for all react-query cache keys.
 * Using strongly-typed functions prevents silent cache invalidation bugs due to typos.
 */

// ── GOAL SPINE KEYS ──
export const goalSpineKeys = {
  all: ['goalSpine'] as const,
  week: (userId: string, weekStart: string) => [...goalSpineKeys.all, userId, 'week', weekStart] as const,
  sprint: (userId: string) => [...goalSpineKeys.all, userId, 'sprint'] as const,
  longTerm: (userId: string) => [...goalSpineKeys.all, userId, 'longTerm'] as const,
  sprintReview: (userId: string, personalYear: number, sprintNumber: number) => [...goalSpineKeys.all, userId, 'sprintReview', personalYear, sprintNumber] as const,
  monthReview: (userId: string, monthStart: string) => [...goalSpineKeys.all, userId, 'monthReview', monthStart] as const,
  latestKpiValues: (userId: string, sortedIds: string[]) => [...goalSpineKeys.all, userId, 'latestKpiValues', sortedIds] as const,
  review: (userId: string, weekStart: string) => [...goalSpineKeys.all, userId, 'review', weekStart] as const,
  reviewLatestCompletedDate: (userId: string) => [...goalSpineKeys.all, userId, 'reviewLatestCompletedDate'] as const,
  full: (userId: string, weekStart: string, currentToday: string) => [...goalSpineKeys.all, userId, 'full', weekStart, currentToday] as const,
  projectKpis: (userId: string, weekStart: string, sortedIds: string[]) => [...goalSpineKeys.all, userId, 'projectKpis', weekStart, sortedIds] as const,
  projectKpisFor: (userId: string, projectId: string) => [...goalSpineKeys.all, userId, 'projectKpisFor', projectId] as const,
  forUser: (userId: string) => [...goalSpineKeys.all, userId] as const,
};

// ── BIOMETRICS KEYS ──
export const biometricsKeys = {
  all: ['biometrics'] as const,
  dailyStrainOura: (userId: string) => [...biometricsKeys.all, 'dailyStrainOura', userId] as const,
};

// ── CALENDAR KEYS ──
export const calendarKeys = {
  all: ['calendar'] as const,
  events: (userId: string, rangeStart: string, rangeEnd: string) =>
    [...calendarKeys.all, 'events', userId, rangeStart, rangeEnd] as const,
};

// ── DASHBOARD KEYS ──
export const dashboardKeys = {
  all: ['dashboard'] as const,
  main: (userId: string) => [...dashboardKeys.all, 'main', userId] as const,
};

// ── NUDGE KEYS ──
export const nudgeKeys = {
  all: ['nudge'] as const,
  counts: (userId: string) => [...nudgeKeys.all, 'counts', userId] as const,
};

// ── TODO KEYS ──
export const todoKeys = {
  all: ['todo'] as const,
  sections: (userId: string) => [...todoKeys.all, 'sections', userId] as const,
  items: (userId: string) => [...todoKeys.all, 'items', userId] as const,
  projects: (userId: string) => [...todoKeys.all, 'projects', userId] as const,
  dreams: (userId: string) => [...todoKeys.all, 'dreams', userId] as const,
  smartLists: (userId: string) => [...todoKeys.all, 'smartLists', userId] as const,
};

// ── DESKTOP KEYS ──
export const desktopKeys = {
  all: ['desktop'] as const,
  dashboard: (userId: string) => [...desktopKeys.all, 'dashboard', userId] as const,
};

// ── NOTES KEYS ──
export const notesKeys = {
  all: ['notes'] as const,
  list: (userId: string) => [...notesKeys.all, 'list', userId] as const,
};

// ── STATS OVERVIEW KEYS ──
export const statsOverviewKeys = {
  all: ['statsOverview'] as const,
  forUser: (userId: string) => [...statsOverviewKeys.all, userId] as const,
};

// ── INSIGHT CARDS KEYS ──
export const insightCardsKeys = {
  all: ['insight-cards'] as const,
  list: (userId: string) => [...insightCardsKeys.all, userId] as const,
};

// ── PATTERNS KEYS ──
export const patternsKeys = {
  all: ['patterns'] as const,
  list: (userId: string) => [...patternsKeys.all, userId] as const,
};

// ── PROJECT WEEK KPIS KEYS ──
export const projectWeekKpisKeys = {
  all: ['project-week-kpis'] as const,
  list: (userId: string, weekStart: string, projectIdsKey: string) =>
    [...projectWeekKpisKeys.all, userId, weekStart, projectIdsKey] as const,
};

// ── DIRECTION KEYS ──
export const directionKeys = {
  all: ['direction'] as const,
  data: (userId: string, weekStart: string) => [...directionKeys.all, userId, weekStart] as const,
  monthlyProgress: (userId: string, startMonth: string, endMonth: string) =>
    [...directionKeys.all, 'monthlyProgress', userId, startMonth, endMonth] as const,
  radarProgress: (userId: string, startWeek: string, endWeek: string) =>
    [...directionKeys.all, 'radarProgress', userId, startWeek, endWeek] as const,
};

// ── LINKS KEYS ──
export const linksKeys = {
  all: ['links-inbox'] as const,
  list: (userId: string) => [...linksKeys.all, userId] as const,
};

// ── PROJECTS KEYS ──
export const projectsKeys = {
  all: ['projects-data'] as const,
  detail: (userId: string) => [...projectsKeys.all, userId] as const,
};

// ── ACTION CENTER KEYS ──
export const actionCenterKeys = {
  all: ['action-center'] as const,
  count: (userId: string) => [...actionCenterKeys.all, 'count', userId] as const,
  data: (userId: string) => [...actionCenterKeys.all, 'data', userId] as const,
};

// ── BIOMEDICAL CONTEXT KEYS ──
export const medicalContextKeys = {
  all: ['medicalContext'] as const,
  cabinet: (userId: string) => [...medicalContextKeys.all, 'cabinet', userId] as const,
};

// ── FOOD ENTRY LISTS KEYS ──
export const foodEntryListsKeys = {
  all: ['food-entry-lists'] as const,
  favorites: (userId: string) => [...foodEntryListsKeys.all, 'favorites', userId] as const,
  recent: (userId: string) => [...foodEntryListsKeys.all, 'recent', userId] as const,
  todayTotals: (userId: string) => [...foodEntryListsKeys.all, 'today', userId] as const,
  targets: (userId: string) => [...foodEntryListsKeys.all, 'targets', userId] as const,
};

// ── SUPPLEMENTS KEYS ──
export const supplementsKeys = {
  all: ['supplements'] as const,
  list: (userId: string) => [...supplementsKeys.all, 'list', userId] as const,
};

// ── HEXAGON SCORES KEYS ──
export const hexagonScoresKeys = {
  all: ['hexagonScores'] as const,
  list: (userId: string, weekStart: string) =>
    [...hexagonScoresKeys.all, 'list', userId, weekStart] as const,
};

// ── KPI TREND KEYS ──
export const kpiTrendKeys = {
  all: ['kpiTrend'] as const,
  sparkline: (userId: string, kpiId: string, limit: number) =>
    [...kpiTrendKeys.all, 'sparkline', userId, kpiId, limit] as const,
};

// ── LIFE SCOREBOARD KEYS ──
export const lifeScoreboardKeys = {
  all: ['lifeScoreboard'] as const,
  range: (userId: string, start: string, end: string) =>
    [...lifeScoreboardKeys.all, 'range', userId, start, end] as const,
};

// ── DREAMS KEYS ──
export const dreamsKeys = {
  all: ['dreams'] as const,
  list: (userId: string) => [...dreamsKeys.all, 'list', userId] as const,
};

// ── VISION ITEMS KEYS ──
export const visionItemsKeys = {
  all: ['visionItems'] as const,
  list: (userId: string) => [...visionItemsKeys.all, 'list', userId] as const,
};

// ── SPRINT REVIEW KEYS ──
export const sprintReviewKeys = {
  all: ['sprintReview'] as const,
  bySprint: (userId: string, personalYear: number, sprintNumber: number) =>
    [...sprintReviewKeys.all, 'bySprint', userId, personalYear, sprintNumber] as const,
};

// ── FOOD SEARCH KEYS ──
export const foodSearchKeys = {
  all: ['foodSearch'] as const,
  recent: (userId: string) => [...foodSearchKeys.all, 'recent', userId] as const,
};

// ── HABITS KEYS ──
export const habitsKeys = {
  all: ['habits'] as const,
  list: (userId: string) => [...habitsKeys.all, 'list', userId] as const,
};

// ── CORRELATIONS KEYS ──
export const correlationsKeys = {
  all: ['correlations'] as const,
  forUser: (userId: string) => [...correlationsKeys.all, 'forUser', userId] as const,
};

// ── DAILY SNAPSHOT KEYS ──
export const dailySnapshotKeys = {
  all: ['dailySnapshot'] as const,
  list: (userId: string, limit: number) =>
    [...dailySnapshotKeys.all, 'list', userId, limit] as const,
};

// ── INLINE LOOSE KEY LITERALS ──
export const brainHealthKeys = {
  all: ['brain-health'] as const,
  forUser: (userId: string) => [...brainHealthKeys.all, userId] as const,
};

export const calendarTodosKeys = {
  inbox: (userId: string) => ['calendar-todos-inbox', userId] as const,
  scheduled: (userId: string, rangeStart: string, rangeEnd: string) => ['calendar-todos-scheduled', userId, rangeStart, rangeEnd] as const,
};

export const goalLineageKeys = {
  forUser: (userId: string) => ['goal-lineage', userId] as const,
};

export const calendarWeatherKeys = {
  range: (rangeStart: string, rangeEnd: string) => ['calendar-weather', rangeStart, rangeEnd] as const,
};

export const timeBudgetsKeys = {
  forUser: (userId: string) => ['time-budgets', userId] as const,
};

export const todayCalendarEventsKeys = {
  forUser: (userId: string, today: string) => ['today-calendar-events', userId, today] as const,
};

export const latestTaskReviewDateKeys = {
  forUser: (userId: string) => ['latest-task-review-date', userId] as const,
};

export const morningPlanKeys = {
  data: (userId: string, planningDate: string, isPlanningTomorrow: boolean) => ['morning-plan-data', userId, planningDate, isPlanningTomorrow] as const,
};

export const nutritionDayContextKeys = {
  forUser: (userId: string, today: string, refreshSignal: number) => ['nutrition-day-context', userId, today, refreshSignal] as const,
};

export const foodEntrySearchKeys = {
  search: (userId: string, debouncedQuery: string) => ['food-entry-search', userId, debouncedQuery] as const,
};

export const nutritionContextKeys = {
  forUser: (userId: string, logDate: string, refreshSignal: number) => ['nutrition-context', userId, logDate, refreshSignal] as const,
};

export const yesterdayEntriesKeys = {
  byType: (userId: string, mealType: string) => ['yesterday-entries', userId, mealType] as const,
};

export const nutritionDataKeys = {
  forUser: (userId: string, weeklyCalories: number) => ['nutrition-data', userId, weeklyCalories] as const,
};

export const behaviorLogsKeys = {
  forUser: (userId: string) => ['behavior-logs', userId] as const,
};

export const generalViewDataKeys = {
  forUser: (userId: string, hasOura: boolean) => ['general-view-data', userId, hasOura] as const,
};

export const systemHealthKeys = {
  forUser: (userId: string) => ['system-health', userId] as const,
};

export const spineGuidanceKeys = {
  forUser: (userId: string) => ['spine-guidance', userId] as const,
};

export const userFundamentKeys = {
  forUser: (userId: string) => ['user-fundament', userId] as const,
};

export const progressPhotosKeys = {
  forUser: (userId: string) => ['progress-photos', userId] as const,
};

export const systemProposalsKeys = {
  forUser: (userId: string) => ['system-proposals', userId] as const,
};

export const weeklyBalanceHexagonKeys = {
  forUser: (userId: string, weekStart: string) => ['weekly-balance-hexagon', userId, weekStart] as const,
};

export const directionContextKeys = {
  forUser: (userId: string, weekStart: string) => ['direction-context', userId, weekStart] as const,
};

export const powerlistKeys = {
  projectMetadata: (userId: string, todoIds: string[], directProjectIds: string[]) => ['powerlist-project-metadata', userId, ...todoIds, ...directProjectIds] as const,
  yesterdayWin: (userId: string) => ['powerlist-yesterday-win', userId] as const,
  openTodos: (userId: string, today: string) => ['powerlist-open-todos', userId, today] as const,
};

export const prescriptionsKeys = {
  forUser: (userId: string) => ['prescriptions', userId] as const,
};

export const medicalDataKeys = {
  forUser: (userId: string) => ['medical-data', userId] as const,
};

export const lifeGoalsKeys = {
  forUser: (userId: string) => ['life-goals', userId] as const,
};

export const todoPushSubscriptionKeys = {
  forUser: (userId: string) => ['todo-push-subscription', userId] as const,
};
