/**
 * Goal spine — canonical read path for the goal hierarchy (background layer).
 * Facade file re-exporting modules to maintain backward compatibility.
 */

export * from './goalSpine.types';
export * from './goalSpine.cache';
export * from './goalSpine.queries';
export * from './goalSpine.mutations';

// Month review re-exports
export {
  closingMonthStartForReview,
  isMonthlyReviewDue,
  gatherMonthFacts,
  monthLabel,
  isMonthlyHardGate,
  isMonthlySoftCue,
} from './monthReview';
export type { MonthFacts } from './monthReview';

// Sprint review re-exports
export type { SprintFacts } from './sprintReview';
export { gatherSprintFacts, weekStartsInSprint } from './sprintReview';
