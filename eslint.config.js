import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const LEGACY_FILES = [
  'src/components/biometrics/DailyStrainCard.tsx',
  'src/components/biometrics/SaunaLoggerModal.tsx',
  'src/components/calendar/CalendarEventModal.tsx',
  'src/components/calendar/CalendarGrid.tsx',
  'src/components/calendar/grid/CalendarGridBlocks.tsx',
  'src/components/calendar/grid/CalendarGridColumns.tsx',
  'src/components/calendar/grid/CalendarDayView.tsx',
  'src/components/calendar/grid/CalendarWeekView.tsx',
  'src/components/calendar/grid/CalendarAgendaView.tsx',
  'src/components/calendar/grid/types.ts',
  'src/components/core/DailyShutdownModal.tsx',
  'src/components/core/MorningPlanModal.tsx',
  'src/components/core/nutrition/FoodQuickCapture.tsx',
  'src/components/desktop/shell/DesktopDashboard.tsx',
  'src/components/desktop/fitness/FitnessScorePanel.tsx',
  'src/components/desktop/fitness/fitnessScoreUtils.ts',
  'src/components/desktop/fitness/fitnessScoreHelpers.ts',
  'src/components/desktop/health/SupplementsPanel.tsx',
  'src/components/desktop/desktopUtils.ts',
  'src/components/growth/GrowthView.tsx',
  'src/components/lifestyle/DirectionPlanningMode.tsx',
  'src/components/lifestyle/LinksInbox.tsx',
  'src/components/lifestyle/usePowerListData.ts',
  'src/components/medical/EndMyopiaCalculator.tsx',
  'src/components/notes/EditNoteModal.tsx',
  'src/components/notes/RichEditor.tsx',
  'src/components/todo/TodoCard.tsx',
  'src/components/todo/TodoCardExpandedPanel.tsx',
  'src/components/todo/TodoCardSubtasks.tsx',
  'src/components/todo/useTodoCardAttachments.ts',
  'src/components/todo/useTodoCardSwipe.ts',
  'src/lib/database.types.ts',
]

// Targeted debt lists for the frontend boundary rules below (see docs/FRONTEND_GUIDE.md).
// Unlike LEGACY_FILES these do NOT relax max-lines/no-explicit-any/unused-vars — they only
// exempt the one specific rule they're listed under. Fix and remove entries over time;
// scripts/ops/check-frontend-ratchets.mjs fails CI if any of these lists grows.

const NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS = [
  'src/components/core/morningPlan/useMorningPlanActions.ts',
  'src/components/core/morningPlan/useMorningPlanData.ts',
  'src/components/desktop/health/useHabitsData.ts',
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
    ignores: [...LEGACY_FILES, 'src/components/**/hooks/**'],
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
    ignores: [...LEGACY_FILES],
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
