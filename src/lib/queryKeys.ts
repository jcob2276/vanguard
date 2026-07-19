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
  weeklyPulse: (userId: string, since: string) => [...biometricsKeys.all, 'weeklyPulse', userId, since] as const,
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

// ── FOOD ENTRY LISTS KEYS ──
export const foodEntryListsKeys = {
  all: ['food-entry-lists'] as const,
  favorites: (userId: string) => [...foodEntryListsKeys.all, 'favorites', userId] as const,
  recent: (userId: string) => [...foodEntryListsKeys.all, 'recent', userId] as const,
  todayTotals: (userId: string) => [...foodEntryListsKeys.all, 'today', userId] as const,
  targets: (userId: string) => [...foodEntryListsKeys.all, 'targets', userId] as const,
};

// ── USER SETTINGS KEYS ──
export const userSettingsKeys = {
  all: ['user-settings'] as const,
  detail: (userId: string) => [...userSettingsKeys.all, userId] as const,
};

// ── SHUTDOWN KEYS ──
export const shutdownKeys = {
  all: ['shutdown'] as const,
  data: (userId: string, date: string) => [...shutdownKeys.all, 'data', userId, date] as const,
};

// ── USER STATS KEYS ──
export const userStatsKeys = {
  all: ['userStats'] as const,
  snapshot: (userId: string) => [...userStatsKeys.all, 'snapshot', userId] as const,
};
