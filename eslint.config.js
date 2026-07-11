import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const LEGACY_FILES = [
  'src/components/core/DailyShutdownModal.tsx',
  'src/components/core/nutrition/FoodQuickCapture.tsx',
  'src/components/desktop/fitness/fitnessScoreUtils.ts',
  'src/components/desktop/desktopUtils.ts',
  'src/components/medical/EndMyopiaCalculator.tsx',
  'src/components/notes/EditNoteModal.tsx',
  'src/components/notes/RichEditor.tsx',
  'src/components/todo/TodoCard.tsx',
  'src/components/todo/useTodoCardSwipe.ts',
  'src/lib/database.types.ts',
]

const LEGACY_REFACTORED_FILES = [
  'src/components/lifestyle/LinksInbox.tsx',
  'src/components/lifestyle/links/LinksInboxItem.tsx',
  'src/components/todo/TodoCardExpandedPanel.tsx',
  'src/components/ai/ChatItems.tsx',
  'src/components/ai/ClarificationRequestCard.tsx',
  'src/components/ai/OracleCard.tsx',
  'src/components/biometrics/MuscleHeatmap.tsx',
  'src/components/biometrics/WorkoutLogger.tsx',
  'src/components/biometrics/workout/ExerciseCard.tsx',
  'src/components/calendar/CalendarView.tsx',
  'src/components/cards/CardFactory.tsx',
  'src/components/core/DailySnapshotCard.tsx',
  'src/components/core/Dashboard.tsx',
  'src/components/core/DashboardModals.tsx',
  'src/components/core/Fundament.tsx',
  'src/components/core/NutritionCard.tsx',
  'src/components/core/NutritionChart.tsx',
  'src/components/core/Stats.tsx',
  'src/components/core/nutrition/FoodEntryModal.tsx',
  'src/components/core/nutrition/NutritionTrainingBar.tsx',
  'src/components/core/nutrition/hooks/useFoodEntryData.ts',
  'src/components/core/stats/FoodAnalysisSection.tsx',
  'src/components/core/stats/TrainingAnalysisSection.tsx',
  'src/components/core/stats/WorkoutHistorySection.tsx',
  'src/lib/stats/exportStats.ts',
  'src/components/core/useNutritionData.ts',
  'src/components/correlations/CorrelationsPage.tsx',
  'src/components/desktop/shell/DesktopDashboard.tsx',
  'src/components/desktop/vision/DreamEditModal.tsx',
  'src/components/desktop/vision/DreamsPanel.tsx',
  'src/components/desktop/fitness/FitnessScorePanel.tsx',
  'src/components/desktop/general/GeneralView.tsx',
  'src/components/desktop/health/HabitsPanel.tsx',
  'src/components/desktop/fitness/Heatmap.tsx',
  'src/components/desktop/general/HexagonPanel.tsx',
  'src/components/desktop/general/IntelligencePanel.tsx',
  'src/components/desktop/fitness/MarathonPanel.tsx',
  'src/components/desktop/fitness/SprintPanel.tsx',
  'src/components/desktop/health/SupplementsPanel.tsx',
  'src/components/desktop/vision/VisionBoardPanel.tsx',
  'src/components/desktop/shell/useDesktopData.ts',
  'src/components/desktop/vision/useDreamsData.ts',
  'src/components/growth/GrowthCockpit.tsx',
  'src/components/growth/GrowthLearningPanel.tsx',
  'src/components/growth/GrowthSkillsList.tsx',
  'src/components/growth/GrowthWeekPlan.tsx',
  'src/components/growth/PinPickerModal.tsx',
  'src/components/growth/SkillRadarPanel.tsx',
  'src/components/identity/IdentityVault.tsx',
  'src/components/identity/Photos.tsx',
  'src/components/integrations/StravaWidget.tsx',
  'src/components/lifestyle/Direction.tsx',
  'src/components/lifestyle/DirectionRadarMode.tsx',
  'src/components/lifestyle/DirectionSprintMode.tsx',
  'src/components/lifestyle/PowerList.tsx',
  'src/components/lifestyle/PowerListKpi.tsx',
  'src/components/lifestyle/PowerListTask.tsx',
  'src/components/lifestyle/ProjectWeekKpis.tsx',
  'src/components/lifestyle/WeekHub.tsx',
  'src/components/lifestyle/WeeklyBalanceHexagon.tsx',
  'src/components/lifestyle/directionHelpers.ts',
  'src/components/lifestyle/usePowerListData.ts',
  'src/components/medical/MedicalStudiesPage.tsx',
  'src/components/notes/Keep.tsx',
  'src/components/notes/NoteCard.tsx',
  'src/components/notes/NoteQuickCapture.tsx',
  'src/components/projects/GoalCreateModal.tsx',
  'src/components/projects/LifeGoalsCard.tsx',
  'src/components/projects/ProjectCard.tsx',
  'src/components/projects/Projects.tsx',
  'src/components/projects/RetroModal.tsx',
  'src/components/projects/projectUtils.ts',
  'src/components/todo/ContextMenu.tsx',
  'src/components/todo/DragGhost.tsx',
  'src/components/todo/EisenhowerMatrix.tsx',
  'src/components/todo/KanbanView.tsx',
  'src/components/todo/Todo.tsx',
  'src/components/todo/TodoDatePickerPopover.tsx',
  'src/components/todo/TodoQuickCapture.tsx',
  'src/components/todo/TodoScanTextModal.tsx',
  'src/components/todo/TodoSidebar.tsx',
  'src/components/todo/WeeklyReviewModal.tsx',
  'src/components/todo/useTodoData.ts',
  'src/data/exercises.ts',
  'src/components/calendar/hooks/useCalendarTodos.ts',
  'src/components/lifestyle/direction/hooks/useDirection.ts',
  'src/components/lifestyle/direction/hooks/useDirectionContext.ts',
  'src/components/growth/hooks/useGrowthData.ts',
  'src/hooks/useSyncActivities.ts',
  'src/lib/aiContext.ts',
  'src/lib/dailyPlanProposal.ts',
  'src/lib/health/foodLogging.ts',
  'src/lib/goal/goalLineage.ts',
  'src/lib/goal/goalSpine.mutations.ts',
  'src/lib/goal/goalSpine.queries.ts',
  'src/lib/projects/lifeGoals.ts',
  'src/lib/offlineQueue.ts',
  'src/lib/supabaseUtils.ts',
  'src/lib/health/supplementsClient.ts',
  'src/lib/todo/todoParser.ts',
  'src/lib/health/workoutLogging.test.ts',
  'src/lib/health/workoutLogging.ts',
  'src/components/core/SearchModal.tsx',
  'src/components/desktop/health/SystemHealth.tsx',
  'src/components/lifestyle/direction/hooks/directionActions.ts',
  'src/components/lifestyle/direction/hooks/directionFetcher.ts',
  'src/components/lifestyle/links/useLinksInboxData.ts',
  'src/components/lifestyle/usePowerListTypes.ts',
  'src/components/projects/ProjectCardExpanded.tsx',
]

// Targeted debt lists for the frontend boundary rules below (see docs/FRONTEND_GUIDE.md).
// Unlike LEGACY_FILES these do NOT relax max-lines/no-explicit-any/unused-vars — they only
// exempt the one specific rule they're listed under. Fix and remove entries over time;
// scripts/ops/check-frontend-ratchets.mjs fails CI if any of these lists grows.

const NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS = [
  'src/components/core/morningPlan/useMorningPlanActions.ts',
  'src/components/core/morningPlan/useMorningPlanData.ts',
  'src/components/insights/TaskAnalyticsCard.tsx',
  'src/components/medical/GlassesCabinet.tsx',
  'src/components/medical/VisionJournal.tsx',
  'src/components/projects/KpiTrendSparkline.tsx',
  'src/components/settings/SettingsView.tsx',
  'src/components/shared/ActionCenterSheet.tsx',
]

// Canonical date-label formatters — these files ARE the wrapper, so calling
// toLocaleDateString('pl-PL', ...) inside them is correct, not debt. Permanent, not a ratchet.
const CANONICAL_DATE_FORMATTERS = [
  'src/components/calendar/calendarHelpers.ts',
  'src/components/notes/keepUtils.ts',
  'src/components/todo/weekly/weeklyHelpers.ts',
  'src/components/todo/todoUtils.ts',
]





export default defineConfig([
  globalIgnores(['dist', '.tmp-get-based']),
  {
    files: ['scripts/**/*.{js,cjs,mjs}'],
    extends: [
      js.configs.recommended,
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: ['scripts/**', ...LEGACY_FILES],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // base rule off — TS version below handles it with better type-awareness
      'no-unused-vars': 'off',
      // warn (not error) so --max-warnings threshold controls CI gate
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
      // allow ts-ignore only when it carries a reason comment
      '@typescript-eslint/ban-ts-comment': ['warn', { 'ts-ignore': 'allow-with-description' }],
      // empty catch blocks are intentional (localStorage fallbacks etc.)
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-restricted-syntax': 'off',
    }
  },
  {
    // Hooks are the data-fetching layer — they legitimately mix fetch logic with
    // exported types/interfaces. Line limits don't apply (see FRONTEND_GUIDE.md §1).
    files: ['src/hooks/**/*.{ts,tsx}', 'src/components/**/hooks/**/*.{ts,tsx}', 'src/components/core/morningPlan/*.{ts,tsx}'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    }
  },
  {
    // Legacy exceptions list (can only decrease in size over time)
    files: LEGACY_FILES,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      '@typescript-eslint/ban-ts-comment': ['warn', { 'ts-ignore': 'allow-with-description' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-restricted-syntax': 'off',
      // React Compiler bail-outs on pre-existing legacy hooks are debt to fix, not new
      // regressions to block on — downgrade so CI stays green while it's tracked here.
      'react-hooks/preserve-manual-memoization': 'warn',
    }
  },
  {
    // Refactored legacy files: enforce 300-line limits and warning-only for no-explicit-any,
    // but relax function line limits since some components still contain large functions.
    files: LEGACY_REFACTORED_FILES,
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    }
  },
  {
    // Specific size exception for split file still slightly over 300 lines.
    files: ['src/components/projects/ProjectCardExpanded.tsx'],
    rules: {
      'max-lines': 'off',
    }
  },

  // ── Frontend boundary rules (docs/FRONTEND_GUIDE.md) ──────────────────────
  // Each targets one recurring pattern from the 2026-07-09 frontend audit. Scoped narrowly
  // (own `ignores`) so they don't touch LEGACY_FILES' existing exemptions — a file can be
  // strict here while still being legacy for max-lines/no-explicit-any, or vice versa.
  //
  // IMPORTANT — ESLint flat config does not merge multiple config objects that set the same
  // rule name for the same file; the last matching object wins and silently replaces the
  // earlier one. The supabase.from ban and the date-format ban both use `no-restricted-syntax`
  // and both match src/components/**, so they MUST live in one block with one combined
  // selector array — do not split them into separate blocks, it will silently disable one.

  {
    // Component boundary: no direct Supabase calls, no inline pl-PL date formatting.
    // Hooks under components/*/hooks/ are exempt — they are the data-fetching layer
    // (see docs/FRONTEND_GUIDE.md §1: "src/hooks/ = fetch orchestration").
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: [
      ...LEGACY_FILES,
      ...LEGACY_REFACTORED_FILES,
      ...NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS,
      ...CANONICAL_DATE_FORMATTERS,
      'src/components/**/hooks/**',
    ],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.object.name='supabase'][callee.property.name='from']",
        message: 'No direct supabase.from() in components — add/use a *Api.ts data-access module. See docs/FRONTEND_GUIDE.md.',
      }, {
        selector: "CallExpression[callee.object.object.name='supabase'][callee.object.property.name='storage'][callee.property.name='from']",
        message: 'No direct supabase.storage.from() in components — wrap it in a *Api.ts data-access module. See docs/FRONTEND_GUIDE.md.',
      }, {
        selector: "CallExpression[callee.property.name='toLocaleDateString'][arguments.0.value='pl-PL']",
        message: "No inline toLocaleDateString('pl-PL', ...) — use lib/date.ts (getTodayWarsaw/formatWarsawDate) or the module's canonical *Helpers.ts formatter. See docs/FRONTEND_GUIDE.md.",
      }],
    },
  },
  {
    // window.alert() ban — separate rule name (no-restricted-globals) from the block above,
    // so its own exception list doesn't cross-exempt the supabase.from/date-format rule.
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: [...LEGACY_FILES, ...LEGACY_REFACTORED_FILES, 'src/components/**/hooks/**'],
    rules: {
      'no-restricted-globals': ['error', {
        name: 'alert',
        message: "Use notify(message, 'error') from lib/notify instead of alert(). See docs/FRONTEND_GUIDE.md.",
      }],
    },
  },
  {
    // Inline pl-PL date formatting in hooks (no supabase.from/alert collision risk here).
    files: ['src/hooks/**/*.{ts,tsx}', 'src/components/**/hooks/**/*.{ts,tsx}'],
    ignores: [...LEGACY_FILES, ...LEGACY_REFACTORED_FILES],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.property.name='toLocaleDateString'][arguments.0.value='pl-PL']",
        message: "No inline toLocaleDateString('pl-PL', ...) — use lib/date.ts (getTodayWarsaw/formatWarsawDate). See docs/FRONTEND_GUIDE.md.",
      }],
    },
  },
  {
    // src/lib is the domain layer — it must not import from src/components (inverted
    // dependency behind the goalSpine.ts import cycles; see lessons.md / FRONTEND_GUIDE.md).
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/components/**'],
          message: 'src/lib must not import from src/components — move the shared logic into src/lib or packages/domain. See docs/FRONTEND_GUIDE.md.',
        }],
      }],
    },
  },
])
