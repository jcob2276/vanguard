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
  'src/components/medical/EndMyopiaCalculator.tsx',
  // EditNoteModal.tsx cleaned 2026-07-16 — raw supabase replaced with invokeEdge/createTodoItem
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
]

const NO_BUTTON_GUARD_EXCEPTIONS = [
  // Color picker swatches — raw <button> is correct for small circular interactive widgets
  'src/components/notes/InlineEditor.tsx',
  // Quick capture category pills — small chip buttons inside a form widget
  'src/components/finance/FinanceQuickCapture.tsx',
  // CSV import — "select all" toggle and drag-drop zone are complex widgets
  'src/components/finance/FinanceCsvImportPanel.tsx',
  'src/components/finance/FinanceCsvPreview.tsx',
  // EMF sensor — interactive "Measure" trigger button in a biometric sensor widget
  'src/components/biometrics/oura/OuraEmfSensorCard.tsx',
  // Physique Analysis Modal — close/action buttons in a fullscreen overlay modal
  'src/components/identity/PhysiqueAnalysisModal.tsx',
  // Food Quick Capture — macro targets and category chips
  'src/components/core/nutrition/FoodQuickCapture.tsx',
  // Caffeine decay card — interactive caffeine log entry buttons
  'src/components/biometrics/oura/OuraCaffeineDecayCard.tsx',
  // Oura Health Page — full-screen biometric hub tab switcher
  'src/components/biometrics/OuraHealthPage.tsx',
]

const NO_COLOR_GUARD_EXCEPTIONS = [
  // Oura Health Page — dark biometric hub palette styling
  'src/components/biometrics/OuraHealthPage.tsx',
  // Sleep-environment analysis cards — semantic color coding (green=good/red=bad) is intentional
  // and cannot be expressed through neutral theme tokens without losing UX meaning.
  'src/components/biometrics/oura/OuraScreenTimeCorrelationCard.tsx',
  'src/components/biometrics/oura/OuraWeatherBarometerCard.tsx',
  'src/components/biometrics/oura/OuraEmfSensorCard.tsx',
  'src/components/biometrics/oura/OuraSleepTab.tsx',
  'src/components/biometrics/oura/OuraCaffeineDecayCard.tsx',
  // Photos timeline — progress badge colors are semantic (analysis status indicator)
  'src/components/identity/PhotosTimelineList.tsx',
  // Physique Modal — muscle group score colors are semantic (strong/weak/balanced)
  'src/components/identity/PhysiqueAnalysisModal.tsx',
  // Food Quick Capture — macro confidence indicator colors
  'src/components/core/nutrition/FoodQuickCapture.tsx',
  // Sleep simulator lab — interactive prediction status colors
  'src/components/biometrics/oura/OuraBioSimulatorLabCard.tsx',
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
  globalIgnores(['dist', '.tmp-get-based', 'coverage', 'android/app/build']),
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
    // Component boundary: no direct Supabase calls, no inline pl-PL date formatting,
    // and no hardcoded Tailwind palette colors.
    // Hooks under components/*/hooks/ are exempt — they are the data-fetching layer
    // (see docs/FRONTEND_GUIDE.md §1: "src/hooks/ = fetch orchestration").
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: [
      ...LEGACY_FILES,
      ...LEGACY_REFACTORED_FILES,
      ...NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS,
      ...NO_COLOR_GUARD_EXCEPTIONS,
      ...NO_BUTTON_GUARD_EXCEPTIONS,
      ...CANONICAL_DATE_FORMATTERS,
      'src/components/**/hooks/**',
      'src/components/ui/**', // UI components are exempt from hardcoded Tailwind color check
    ],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.object.name='supabase'][callee.property.name='from']",
        message: 'No direct supabase.from() in components — add/use a *Api.ts data-access module. See docs/FRONTEND_GUIDE.md.',
      }, {
        selector: "CallExpression[callee.object.object.name='supabase'][callee.object.property.name='storage'][callee.property.name='from']",
        message: 'No direct supabase.storage.from() in components — wrap it in a *Api.ts data-access module. See docs/FRONTEND_GUIDE.md.',
      }, {
        selector: "CallExpression[callee.object.object.name='supabase'][callee.object.property.name='functions'][callee.property.name='invoke']",
        message: 'No direct supabase.functions.invoke() in components — use invokeEdge() from lib/supabase.ts. See docs/FRONTEND_GUIDE.md.',
      }, {
        selector: "CallExpression[callee.property.name='toLocaleDateString'][arguments.0.value='pl-PL']",
        message: "No inline toLocaleDateString('pl-PL', ...) — use lib/date.ts (getTodayWarsaw/formatWarsawDate) or the module's canonical *Helpers.ts formatter. See docs/FRONTEND_GUIDE.md.",
      }, {
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\b(bg|text|border|from|to|via|decoration|ring|outline|divide|accent|caret|fill|stroke)-(red|blue|green|amber|rose|emerald|indigo|slate)-\\d{3}\\b/]",
        message: 'No hardcoded Tailwind palette colors (red/blue/green/amber/rose/emerald/indigo/slate) in className. Use CSS variables or theme tokens. See docs/FRONTEND_GUIDE.md.',
      }, {
        selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\b(bg|text|border|from|to|via|decoration|ring|outline|divide|accent|caret|fill|stroke)-(red|blue|green|amber|rose|emerald|indigo|slate)-\\d{3}\\b/]",
        message: 'No hardcoded Tailwind palette colors (red/blue/green/amber/rose/emerald/indigo/slate) in className. Use CSS variables or theme tokens. See docs/FRONTEND_GUIDE.md.',
      }, {
        // Button structural guard: catch hand-rolled buttons with primary-button styling.
        // shadow-primary is the strongest signal (progress bars/badges never use it).
        // bg-primary + text-white + px/py is the specific "filled button" signature.
        // NOTE: AST selectors can't filter by parent element, so some <div>/<span> false
        // positives are possible — add them to NO_COLOR_GUARD_EXCEPTIONS if needed.
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\bshadow-primary\\b/]",
        message: 'shadow-primary in className — likely a hand-rolled button. Use <Button variant="primary"> from ui/Button. See docs/DESIGN_SYSTEM.md.',
      }, {
        selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\bshadow-primary\\b/]",
        message: 'shadow-primary in className — likely a hand-rolled button. Use <Button variant="primary"> from ui/Button. See docs/DESIGN_SYSTEM.md.',
      }, {
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\bbg-primary\\b.*\\btext-white\\b.*\\b(p[xy])-/]",
        message: 'bg-primary + text-white + px/py — hand-rolled filled button. Use <Button variant="primary"> from ui/Button. See docs/DESIGN_SYSTEM.md.',
      }, {
        selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\bbg-primary\\b.*\\btext-white\\b.*\\b(p[xy])-/]",
        message: 'bg-primary + text-white + px/py — hand-rolled filled button. Use <Button variant="primary"> from ui/Button. See docs/DESIGN_SYSTEM.md.',
      }, {
        // Typography guard: catch arbitrary text-[Npx] — use typography tokens instead.
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\btext-\\[\\d+\\.?\\d*px\\]/]",
        message: 'Arbitrary text-[Npx] — use a typography token (text-3xs through text-6xl). See docs/DESIGN_SYSTEM.md §2.8.',
      }, {
        selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\btext-\\[\\d+\\.?\\d*px\\]/]",
        message: 'Arbitrary text-[Npx] — use a typography token (text-3xs through text-6xl). See docs/DESIGN_SYSTEM.md §2.8.',
      }, {
        // Hardcoded brand-rgba guard: catch indigo rgba() in Tailwind arbitrary values (shadow-[...], bg-[...]).
        // Use derived tokens (--primary-N) or color-mix(in srgb, var(--primary) N%, transparent) instead.
        selector: "JSXAttribute[name.name='className'] Literal[value=/rgba\\(\\s*?(99|79)\\s*,\\s*?(102|70)\\s*,\\s*?(241|229)/]",
        message: 'Hardcoded indigo rgba() in className — use --primary-N token or color-mix(in srgb, var(--primary) N%, transparent). See docs/DESIGN_SYSTEM.md.',
      }, {
        selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/rgba\\(\\s*?(99|79)\\s*,\\s*?(102|70)\\s*,\\s*?(241|229)/]",
        message: 'Hardcoded indigo rgba() in className — use --primary-N token or color-mix(in srgb, var(--primary) N%, transparent). See docs/DESIGN_SYSTEM.md.',
      }, {
        // Button structural guard: block raw <button> outside ui/ — use <Button> instead.
        // Exemptions: files where <button> is semantically correct (drag handles, complex
        // interactive widgets, tab-like controls) or where migration is tracked separately.
        selector: "JSXOpeningElement[name.name='button']",
        message: 'Raw <button> — use <Button variant="..."> from ui/Button. See docs/DESIGN_SYSTEM.md §0. If this <button> is a drag handle, tab switcher, or complex widget, add the file to NO_BUTTON_GUARD_EXCEPTIONS.',
      }, {
        // Arbitrary-value escape hatch: bg-[#hex] etc. bypasses the named-palette guard above.
        selector: "JSXAttribute[name.name='className'] Literal[value=/\\b(bg|text|border|from|to|via|decoration|ring|outline|divide|accent|caret|fill|stroke|shadow)-\\[#[0-9a-fA-F]{3,8}\\]/]",
        message: 'No arbitrary hex Tailwind values (bg-[#hex] etc.) in className — use a CSS variable or theme token. See docs/DESIGN_SYSTEM.md.',
      }, {
        selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\b(bg|text|border|from|to|via|decoration|ring|outline|divide|accent|caret|fill|stroke|shadow)-\\[#[0-9a-fA-F]{3,8}\\]/]",
        message: 'No arbitrary hex Tailwind values (bg-[#hex] etc.) in className — use a CSS variable or theme token. See docs/DESIGN_SYSTEM.md.',
      }, {
        // Inline style hex: the className guards above can't see style={{...}} objects.
        selector: "JSXAttribute[name.name='style'] Property[value.type='Literal'][value.value=/^#[0-9a-fA-F]{3,8}$/]",
        message: "No hardcoded hex color in inline style={{...}} — use style={{color: 'var(--color-token)'}} instead. See docs/DESIGN_SYSTEM.md.",
      }],
    },
  },
  {
    // UI components: allow hardcoded Tailwind palette colors, but enforce no direct Supabase calls and no inline pl-PL date formatting.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    ignores: [
      ...LEGACY_FILES,
      ...LEGACY_REFACTORED_FILES,
      ...NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS,
      ...CANONICAL_DATE_FORMATTERS,
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
    // window.alert() and window.confirm() ban — use lib/notify wrappers instead.
    // Separate rule name (no-restricted-globals) so its exception list doesn't
    // cross-exempt the supabase.from/date-format rule above.
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: [...LEGACY_FILES, ...LEGACY_REFACTORED_FILES, 'src/components/**/hooks/**'],
    rules: {
      'no-restricted-globals': ['error', {
        name: 'alert',
        message: "Use notify(message, 'error') from lib/notify instead of alert(). See docs/FRONTEND_GUIDE.md.",
      }, {
        name: 'confirm',
        message: "Use confirmDialog(message) from lib/notify instead of confirm(). See docs/FRONTEND_GUIDE.md.",
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
