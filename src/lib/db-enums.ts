/**
 * Compile-time literals that mirror DB CHECK constraints.
 *
 * RULE: database.types.ts stays auto-generated and untouched.
 *       These types live here as the human-maintained SSOT for enum columns.
 *
 * When you add a new constrained column:
 *   1. Add a type alias here.
 *   2. Use it in the INSERT/UPDATE call site (not in the generated Row type).
 *
 * When a DB constraint changes (e.g. a new status value):
 *   1. Update the union here.
 *   2. TypeScript will flag all callers that pass a value not in the new union.
 *
 * See AGENTS.md → DB constraints for the authoritative list of valid values.
 */

// daily_wins.planning_status
// DB CHECK: ('pending', 'active', 'completed')
// AGENTS.md rule: NOT 'done'
export type PlanningStatus = 'pending' | 'active' | 'completed';

// todo_items.status
export type TodoStatus = 'open' | 'done' | 'cancelled';

// todo_items.priority (stored as string in DB)
export type TodoPriority = '1' | '2' | '3' | '4';

// food_entries.meal_type
// Mirrors MEAL_TYPES in src/lib/health/foodLogging.ts
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// daily_wins.status / daily_win_tasks.status — separate from planning_status
export type DailyWinStatus = 'pending' | 'active' | 'done' | 'skipped';
