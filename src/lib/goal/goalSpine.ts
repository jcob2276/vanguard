/**
 * Goal spine — canonical read path for the goal hierarchy (background layer).
 * Facade file re-exporting modules to maintain backward compatibility.
 */

export * from './goalSpine.types';
export * from './goalSpine.queries';
export * from './goalSpine.mutations';

// Month review re-exports
export {
  closingMonthStartForReview,
  gatherMonthFacts,
} from '../growth/monthReview';

// Sprint review re-exports
export { gatherSprintFacts } from '../growth/sprintReview';
