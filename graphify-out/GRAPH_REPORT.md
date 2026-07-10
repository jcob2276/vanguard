# Graph Report - .  (2026-07-09)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2829 nodes · 7291 edges · 154 communities (136 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `23fd635d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- reconcile.ts
- biologyScoresLite.ts
- CalendarView.tsx
- index.ts
- interceptors.ts
- createServiceClient
- getTodayWarsaw
- FitnessScorePanel.tsx
- WorkoutLogger.tsx
- telegram.ts
- deepseekChat
- TodoCard.tsx
- useTodoData.ts
- CardFactory.tsx
- audit-registry.mjs
- getWarsawDateString
- supabase.ts
- ProjectCard.tsx
- MuscleHeatmap.tsx
- GeneralView.tsx
- metrics_strain.ts
- todo.ts
- index.ts
- InsightsDashboard.tsx
- Stats.tsx
- correlations.ts
- desktopUtils.ts
- growth.ts
- useDirectionContext.ts
- goalSpineGuide.ts
- OracleCard.tsx
- Dashboard.tsx
- GrowthView.tsx
- LinksInbox.tsx
- foodLogging.ts
- useFoodEntryData.ts
- usePowerListData.ts
- compilerOptions
- workoutLogging.ts
- DesktopDashboard.tsx
- analysis.ts
- getWeekStartWarsaw
- PowerList.tsx
- goalSpine.queries.ts
- database.types.ts
- plyoMarathonProgram.ts
- correlationDiscovery.ts
- goalSpine.mutations.ts
- VanguardCore
- smoke-vanguard.mjs
- nutritionContext.ts
- bodyMetrics.ts
- fetchGoalSpine
- Projects.tsx
- monthReview.ts
- index.ts
- useDirection.ts
- parseTodoQuickInput
- scripts
- TaskAnalyticsCard.tsx
- devDependencies
- DesktopHero.tsx
- notify.ts
- dependencies
- MorningPlanModal.tsx
- DirectionMonthlyMode.tsx
- send.ts
- correlations.ts
- index.ts
- notify
- sprintReview.ts
- WeeklyReviewModal.tsx
- warsawDayBoundsISO
- DailyStrainCard.tsx
- goalSpine.ts
- BehaviorCapturePanel.tsx
- Keep.tsx
- unwrapList
- WeekHub.tsx
- magazineBar.ts
- lifeGoals.ts
- offlineQueue.ts
- strava.ts
- App.tsx
- DashboardHeader.tsx
- SupplementsPanel.tsx
- backtest-brain.mjs
- HexagonPanel.tsx
- GrowthCockpit.tsx
- weekly-recap.ts
- timeseries.ts
- oss-audit.mjs
- useNutritionData.ts
- useTodayCalendarEvents.ts
- Heatmap.tsx
- SkillRadarPanel.tsx
- PatternsView.tsx
- correlationSeries.ts
- HtmlCard.tsx
- ErrorBoundary.tsx
- correlationInterest.ts
- knip.json
- ClarificationRequestCard.tsx
- Fundament.tsx
- EisenhowerMatrix.tsx
- growthSeed.ts
- outcomes.ts
- DataStateNotice.tsx
- package.json
- backfill_triads.mjs
- restore-vanguard.mjs
- Card.tsx
- notesApi.ts
- backup-vanguard.mjs
- generate_magic_link.mjs
- import-pzh-xlsx.ts
- query_user.mjs
- task.tsx
- check-edge-functions.mjs
- inspect_chunk.mjs
- map_stack_trace.mjs
- smoke-ui.mjs
- procedure.tsx
- routine.tsx
- conversation.tsx
- DashboardNavBar.tsx
- imports
- analyze-weak-plans.mjs
- check-migration-drift.mjs
- query_sourcemap_range.mjs
- person.tsx
- place.tsx
- spec_sheet.tsx
- transaction.tsx
- rating.tsx
- compact.tsx
- snippet.tsx
- gallery.tsx
- snapshot.tsx
- video.tsx
- eslint.config.js
- vercel.json

## God Nodes (most connected - your core abstractions)
1. `getTodayWarsaw()` - 137 edges
2. `supabase` - 97 edges
3. `createServiceClient()` - 72 edges
4. `getWarsawDateString()` - 63 edges
5. `deepseekChat()` - 56 edges
6. `notify()` - 52 edges
7. `safeSendTelegram()` - 50 edges
8. `formatWarsawDate()` - 44 edges
9. `resolveUserScope()` - 43 edges
10. `corsHeaders` - 41 edges

## Surprising Connections (you probably didn't know these)
- `fetchWorldState()` --indirect_call--> `diff()`  [INFERRED]
  supabase/functions/_shared/worldState.ts → scripts/analysis/audit-registry.mjs
- `useLifeScoreboard()` --indirect_call--> `sleep()`  [INFERRED]
  src/hooks/useLifeScoreboard.ts → scripts/analysis/run_eval.mjs
- `CalendarView()` --indirect_call--> `step()`  [INFERRED]
  src/components/calendar/CalendarView.tsx → scripts/ops/e2e-daily-loop.mjs
- `CorrelationsPage()` --indirect_call--> `isInterestingCorrelationClient()`  [INFERRED]
  src/components/correlations/CorrelationsPage.tsx → packages/domain/src/correlations.ts
- `OracleCard()` --calls--> `getTodayWarsaw()`  [EXTRACTED]
  src/components/ai/OracleCard.tsx → packages/domain/src/date.ts

## Import Cycles
- 3-file cycle: `src/lib/goalSpine.queries.ts -> src/lib/longTermBridge.ts -> src/lib/goalSpine.ts -> src/lib/goalSpine.queries.ts`
- 3-file cycle: `src/lib/goalSpine.queries.ts -> src/lib/projects.ts -> src/lib/goalSpine.ts -> src/lib/goalSpine.queries.ts`
- 3-file cycle: `supabase/functions/_shared/foodParse/matching.ts -> supabase/functions/_shared/foodParseCore.ts -> supabase/functions/_shared/foodParse/normalize.ts -> supabase/functions/_shared/foodParse/matching.ts`
- 4-file cycle: `src/lib/goalSpine.mutations.ts -> src/lib/goalSpine.queries.ts -> src/lib/longTermBridge.ts -> src/lib/goalSpine.ts -> src/lib/goalSpine.mutations.ts`
- 4-file cycle: `src/lib/goalSpine.mutations.ts -> src/lib/goalSpine.queries.ts -> src/lib/projects.ts -> src/lib/goalSpine.ts -> src/lib/goalSpine.mutations.ts`

## Communities (154 total, 18 thin omitted)

### Community 0 - "reconcile.ts"
Cohesion: 0.05
Nodes (86): APPLY, EntryRow, fetchLibrary(), isCompoundName(), main(), parseGrams(), pickGenericMatch(), pickLibraryMatch() (+78 more)

### Community 1 - "biologyScoresLite.ts"
Cohesion: 0.06
Nodes (79): ScoreCard(), MedicalDesktopTeaser(), BodyCompositionSection(), CategorySection(), KeyMarkerCards(), MarkerTable(), PanelTimeline(), SectionShell() (+71 more)

### Community 2 - "CalendarView.tsx"
Cohesion: 0.06
Nodes (67): suncalc, db, __dirname, missingEnv, results, ROOT, secondaryCrons, step() (+59 more)

### Community 3 - "index.ts"
Cohesion: 0.05
Nodes (65): getStreamCutoffs(), deprecateSupersededLinks(), computeTrend(), diffDays(), fetchMedicalContext(), formatMedicalContextBlock(), freshness(), markerPriority() (+57 more)

### Community 4 - "interceptors.ts"
Cohesion: 0.08
Nodes (52): sendChatAction(), fetchWorldState(), saveWorldState(), WorldStateMeta, handleDietaCommand(), handleInteractivePromptCommand(), handleKeepCommand(), handleKoniecCommand() (+44 more)

### Community 5 - "createServiceClient"
Cohesion: 0.08
Nodes (24): getAccessToken(), getVanguardUserId(), sendMessage(), mintRecordFactId(), ewmaBaseline(), runComputeIllnessSignal(), corsHeaders, createServiceClient() (+16 more)

### Community 6 - "getTodayWarsaw"
Cohesion: 0.08
Nodes (34): formatWarsawDate(), getTodayWarsaw(), DailyShutdownModal(), Props, DailySnapshotCard(), MODE_STYLE, SCORES, DashboardModals() (+26 more)

### Community 7 - "FitnessScorePanel.tsx"
Cohesion: 0.07
Nodes (46): BENCH_PATTERNS, bestFromSessions(), bodyCompositionBonus(), BodyMetricRow, BodyRow, computeBmi(), computeHabitConsistency(), cooperBestKm() (+38 more)

### Community 8 - "WorkoutLogger.tsx"
Cohesion: 0.18
Nodes (25): useStopwatch(), WorkoutLogger(), useWorkoutResume(), confirmDialog(), clearPlyoCheckoff(), draftKey(), initPlyoCheckoff(), isPlyoSessionComplete() (+17 more)

### Community 9 - "telegram.ts"
Cohesion: 0.15
Nodes (25): answerCallbackQuery(), clearInlineKeyboard(), editMessageText(), updatePatternFeedback(), ANALYSIS_ACTION_CALLBACKS, handleAnalysisActionCallback(), handleClosureCallback(), isClosureCallback() (+17 more)

### Community 10 - "deepseekChat"
Cohesion: 0.07
Nodes (43): compressHistoryIfNeeded(), estimateTokens(), HistoryMsg, preTrim(), deepseekChat(), DeepSeekChatParams, DeepSeekChatResult, DeepSeekMessage (+35 more)

### Community 11 - "TodoCard.tsx"
Cohesion: 0.07
Nodes (33): CalendarSidebarTodosProps, PILLAR_CHIP, SidebarTodo, DragGhost(), DragGhostProps, Item, KanbanView(), Props (+25 more)

### Community 12 - "useTodoData.ts"
Cohesion: 0.10
Nodes (36): combineDateTimeWarsawISO(), getPastWeekStarts(), StreamCutoffs, warsawDayStartUTCMs(), warsawOffsetSuffix(), warsawTimeOfDay(), matchesSmartQuery(), nextOccurrenceDate() (+28 more)

### Community 13 - "CardFactory.tsx"
Cohesion: 0.06
Nodes (29): AiCardRenderer(), CardFactory(), renderInner(), TEMPLATE_VARIANTS, LinkCard(), LinkCardData, MetricCard(), MetricCardData (+21 more)

### Community 14 - "audit-registry.mjs"
Cohesion: 0.05
Nodes (34): activeNoJwtRegistry, deployAllBlock, deployNoJwt, deployNoJwtPath, deployScript, deprecatedNoJwtRegistry, diff(), __dirname (+26 more)

### Community 15 - "getWarsawDateString"
Cohesion: 0.17
Nodes (23): getWarsawDateString(), getWarsawDayBoundaries(), runWeeklySynthesis(), runSaveDailyAggregate(), DetectorResult, insightToDetector(), runDetectPatterns(), supabase (+15 more)

### Community 16 - "supabase.ts"
Cohesion: 0.08
Nodes (23): fetchDashboardFallback(), mapTodoToMove(), useDesktopData(), DreamRow, UseDreamsDataProps, VisionBoardItemRow, AddPrescriptionModal(), AddPrescriptionModalProps (+15 more)

### Community 17 - "ProjectCard.tsx"
Cohesion: 0.10
Nodes (32): GoalCreateModalProps, HEALTH_TOOLTIP, HealthScore(), HealthScoreProps, Draft, draftFrom(), LifeGoalsCard(), Props (+24 more)

### Community 18 - "MuscleHeatmap.tsx"
Cohesion: 0.11
Nodes (29): BodyModel(), MuscleHeatmap(), PERIODS, TAG_COLORS, tagColor(), tagsForLog(), ExerciseNameInput(), ExerciseNameInputProps (+21 more)

### Community 19 - "GeneralView.tsx"
Cohesion: 0.08
Nodes (24): DreamsPanelProps, buildSleepHrvScatter(), buildTimeline(), GeneralView(), READINESS_COLOR, ChartTooltipPayload, Panel(), PanelProps (+16 more)

### Community 20 - "metrics_strain.ts"
Cohesion: 0.09
Nodes (27): ANON_KEY, BATCH_SIZE, __dirname, dotenv, __filename, getStatus(), renderProgress(), sleep() (+19 more)

### Community 21 - "todo.ts"
Cohesion: 0.10
Nodes (19): BucketHeaderProps, ContextMenuProps, Todo(), ExtractedTask, TodoScanTextModal(), TodoScanTextModalProps, TodoNavDest, TodoSidebarProps (+11 more)

### Community 22 - "index.ts"
Cohesion: 0.12
Nodes (22): buildReflectionPrompt(), compactRows(), runDailyReconciliation(), sendTelegram(), StreamRow, getAuditClient(), logAuditEvent(), logCriticalError() (+14 more)

### Community 23 - "InsightsDashboard.tsx"
Cohesion: 0.10
Nodes (21): CardTemplateId, InsightCard(), InsightCardData, InsightCardProps, InsightsDashboard(), MetricPillProps, MiniBarChartProps, Props (+13 more)

### Community 24 - "Stats.tsx"
Cohesion: 0.09
Nodes (25): BodyMetricRow, DataExportSection(), DataExportSectionProps, EditableExerciseLog, EditFormState, ExerciseLogRow, downloadBlob(), exportOuraCsv() (+17 more)

### Community 25 - "correlations.ts"
Cohesion: 0.12
Nodes (25): BEHAVIOR_LABELS, BehaviorEffectResult, behaviorLabel(), CATEGORY_LABELS, CONFIDENCE_LABELS, CorrelationCategory, CorrelationCore, CorrelationResult (+17 more)

### Community 26 - "desktopUtils.ts"
Cohesion: 0.14
Nodes (27): avg(), C, cleanIntelText(), computeDayOfWeekReadiness(), computeLenieInsight(), computeNarrativeInsights(), computeNutritionImpact(), computeSleepBuckets() (+19 more)

### Community 27 - "growth.ts"
Cohesion: 0.17
Nodes (19): GrowthMediaQueue(), linkMeta(), MediaRow(), SlotSection(), pinResourceType(), pinTitle(), GrowthCheckpoint, GrowthLinkRow (+11 more)

### Community 28 - "useDirectionContext.ts"
Cohesion: 0.10
Nodes (18): DirectionPlanningMode(), Phase1Recap, Phase2Recap, Props, WeekFacts, WeekPlanningRecap(), WeekLoopSummary(), EMPTY_CHECKPOINTS (+10 more)

### Community 29 - "goalSpineGuide.ts"
Cohesion: 0.14
Nodes (22): SpineGuideStrip(), daysSince(), useSpineGuidance(), useWarsawDayChange(), fetchLatestCompletedWeeklyReviewDate(), DailyWinLike, dayStepStatus(), DayWinState (+14 more)

### Community 30 - "OracleCard.tsx"
Cohesion: 0.13
Nodes (23): getOracleUserConf(), AiMessageItem(), ChatItem, ErrorItem(), formatTimestamp(), SendActionMessage(), shouldShowTimeDivider(), SystemReminderItem() (+15 more)

### Community 31 - "Dashboard.tsx"
Cohesion: 0.09
Nodes (24): CalendarView, DailySnapshotCard, DailyStrainCard, Dashboard(), Direction, Fundament, InsightsDashboard, isAfter20() (+16 more)

### Community 32 - "GrowthView.tsx"
Cohesion: 0.14
Nodes (21): KIND_ICON, GrowthSkillsList(), matchLinkToSkill(), scoreBar(), GrowthView(), matchLinkToSkill(), PinPickerModal(), GrowthWeekNote (+13 more)

### Community 33 - "LinksInbox.tsx"
Cohesion: 0.12
Nodes (22): CATEGORIES, CATEGORY_COLORS, getYouTubeId(), LinksInbox(), SavedLink, STATUS_TABS, TriageSuggestion, Keep() (+14 more)

### Community 34 - "foodLogging.ts"
Cohesion: 0.16
Nodes (22): getYesterdayWarsaw(), FavoriteChip, FoodQuickCapture(), getYesterdayLabel(), defaultMealType(), FOOD_STAPLES, FoodFavoriteRow, FoodParseMeta (+14 more)

### Community 35 - "useFoodEntryData.ts"
Cohesion: 0.13
Nodes (20): BarcodeScannerProps, Window, FoodEntryModal(), FoodEntryModalProps, MEAL_TYPES, FoodRowProps, dayLabel(), defaultMealType() (+12 more)

### Community 36 - "usePowerListData.ts"
Cohesion: 0.17
Nodes (22): EMPTY_SLOT, PowerListDraft, powerListDraftKey(), powerListKpiKey(), usePowerListData(), UsePowerListDataProps, markCheckpointDone(), buildDailyPlanProposal() (+14 more)

### Community 37 - "compilerOptions"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, ignoreDeprecations (+17 more)

### Community 38 - "workoutLogging.ts"
Cohesion: 0.11
Nodes (34): SaunaLoggerModal(), TrainingSaunaQuickBar(), ExerciseCard(), ExerciseCardProps, epley(), ExerciseHistoryRow, formatLastSession(), getSuggestion() (+26 more)

### Community 39 - "DesktopDashboard.tsx"
Cohesion: 0.11
Nodes (17): DesktopDashboard(), Fundament, MedicalDesktopTeaser, MuscleHeatmap, WorkoutLogger, SECTIONS, computeAlerts(), sessionVol() (+9 more)

### Community 40 - "analysis.ts"
Cohesion: 0.19
Nodes (22): getWeekdayAbbr(), NutritionChart(), NutritionChartProps, analyzeTrainingLoad(), avg(), classifyFatigue(), classifyRun(), dayDiff() (+14 more)

### Community 41 - "getWeekStartWarsaw"
Cohesion: 0.15
Nodes (22): BudgetBounds, emptyBudgetMap(), polarPoint(), polygonPoints(), TodoItemRow, WeeklyBalanceHexagon(), KpiTrendSparkline(), KpiTrendSparklineProps (+14 more)

### Community 42 - "PowerList.tsx"
Cohesion: 0.09
Nodes (15): PowerList(), PowerListProps, PRIORITY_DOT, SPHERE_SLOTS, TodoPickerProps, PowerListKpiProps, COLOR_DOT, PowerListTaskProps (+7 more)

### Community 43 - "goalSpine.queries.ts"
Cohesion: 0.17
Nodes (20): loadWeekGoals(), resolveWeekGoals(), WEEK_GOAL_COLUMNS, weekGoalsAreEmpty(), weekGoalsFromReview(), DreamRow, GoalKpiRow, GoalSpine (+12 more)

### Community 44 - "database.types.ts"
Cohesion: 0.12
Nodes (13): calculateProjection(), colorMap, emptyVault, VaultField, VaultState, CompositeTypes, Constants, DatabaseWithoutInternals (+5 more)

### Community 45 - "plyoMarathonProgram.ts"
Cohesion: 0.11
Nodes (28): PlyoBlock(), PlyoBlockProps, PlyoExerciseRow(), advancePlyoProgram(), applyWeekModifiers(), DELOAD, formatPlyoPrescription(), isDeloadWeek() (+20 more)

### Community 46 - "correlationDiscovery.ts"
Cohesion: 0.16
Nodes (22): appendBehaviorLogMetrics(), appendHabitLogMetrics(), behaviorMetricId(), behaviorMetricLabel(), DISCOVERY_LAGS, discoveryScore(), EKRAN_METRICS, habitMetricId() (+14 more)

### Community 47 - "goalSpine.mutations.ts"
Cohesion: 0.16
Nodes (21): getSprintInfo(), invalidateGoalSpineCache(), addProjectKpi(), applyKpiRollup(), completeMonthlyReview(), completeSprintClose(), completeWeeklyReview(), markDailyWinsPartial() (+13 more)

### Community 48 - "VanguardCore"
Cohesion: 0.14
Nodes (5): computeSignals(), getWarsawDateMinusDays(), getWarsawDateString(), VANGUARD_STATES, VanguardCore

### Community 49 - "smoke-vanguard.mjs"
Cohesion: 0.10
Nodes (14): CRON_DASHBOARD_ONLY, CRON_FROM_MIGRATIONS, CRON_REMOVED, NO_VERIFY_JWT_FUNCTIONS, SMOKE_TARGETS, args, __dirname, headers() (+6 more)

### Community 50 - "nutritionContext.ts"
Cohesion: 0.18
Nodes (17): TRAJECTORY_LABEL, TRAJECTORY_STYLE, NutritionTrainingBarCard(), TodayNutritionSnapshot, buildTrainingLabel(), ensureNutritionTargetForDate(), fetchNutritionDayContext(), foodLogClosedKey() (+9 more)

### Community 51 - "bodyMetrics.ts"
Cohesion: 0.17
Nodes (16): BodyMetricsSection(), BodyMetricsSectionProps, NewMetricState, TrendPoint, Stats(), TrendArrow(), BodyMetricRow, bodyTrend() (+8 more)

### Community 52 - "fetchGoalSpine"
Cohesion: 0.19
Nodes (20): PILLAR_OPTIONS, ProjectLite, ProjectWeekKpis(), spineKey(), withCache(), fetchGoalSpine(), fetchKpisForProject(), fetchLatestKpiValues() (+12 more)

### Community 53 - "Projects.tsx"
Cohesion: 0.23
Nodes (17): COLOR_PILLAR, PillarFilter, Projects(), RetroModalProps, createProject(), createProjectCheckpoint(), deleteProject(), deleteProjectCheckpoint() (+9 more)

### Community 54 - "monthReview.ts"
Cohesion: 0.20
Nodes (17): gatherDailyWinsContext(), goalSpineAiSnapshot(), loadMonthlySlice(), strategicGapsFromSpine(), avgScores(), calendarMonthStart(), closingMonthStartForReview(), dayOfMonthWarsaw() (+9 more)

### Community 55 - "index.ts"
Cohesion: 0.18
Nodes (15): clamp(), mean(), runComputeRecoveryForecast(), sampleSD(), slopePerDay(), generateTomorrowPredictions(), resolvePastPredictions(), RecommendationRow (+7 more)

### Community 56 - "useDirection.ts"
Cohesion: 0.15
Nodes (17): Direction(), calculateWeekFacts(), CalendarRow, DailyWinRow, MonthRecap, Phase1Recap, Phase2Recap, PillarScores (+9 more)

### Community 57 - "parseTodoQuickInput"
Cohesion: 0.18
Nodes (18): addDaysToKey(), MONTH_LABELS, nextWeekendKey(), TodoDatePickerPopover(), TodoDatePickerPopoverProps, toKey(), WEEKDAY_LABELS, weekdayShort() (+10 more)

### Community 58 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, audit:knip, audit:registry, build, db:check-drift, db:update-types, dev, e2e:loop (+11 more)

### Community 59 - "TaskAnalyticsCard.tsx"
Cohesion: 0.16
Nodes (15): getDaysAgoWarsaw(), DAY_LABELS, DoneTask, Props, TaskAnalyticsCard(), warsawDayOfWeek(), KIND_LABEL, ProjectEvidenceStrip() (+7 more)

### Community 60 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+10 more)

### Community 61 - "DesktopHero.tsx"
Cohesion: 0.19
Nodes (14): OuraData, StrainData, cockpitDecision(), DesktopHero(), DesktopHeroProps, LIMITER_PL, SPRINT_SEASON, BodyMetric (+6 more)

### Community 62 - "notify.ts"
Cohesion: 0.17
Nodes (16): ICONS, ToastHost(), TONE, ConfirmListener, confirmListeners, dismissToast(), emitConfirm(), emitToasts() (+8 more)

### Community 63 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, date-fns, exifr, lucide-react, @mediapipe/tasks-vision, react, react-body-highlighter, react-dom (+9 more)

### Community 64 - "MorningPlanModal.tsx"
Cohesion: 0.18
Nodes (14): addMinutes(), CalEvent, isoDateStr(), isoDurationMin(), isoMinutesOfDay(), MorningPlanModal(), PRIORITY_COLORS, Props (+6 more)

### Community 65 - "DirectionMonthlyMode.tsx"
Cohesion: 0.15
Nodes (9): MonthRecap, Props, MonthCarryPlan, monthCarryToWeekPlan(), MonthReviewCarry, strongestPillar(), facts, weakestPillar() (+1 more)

### Community 66 - "send.ts"
Cohesion: 0.19
Nodes (13): editMessageReplyMarkup(), getTelegramFilePath(), queueOutbox(), SendMessageOptions, telegramFileUrl(), TelegramSendResult, transcribeAudio(), openaiChat() (+5 more)

### Community 67 - "correlations.ts"
Cohesion: 0.24
Nodes (13): ConfidenceTier, CorrelationMethod, dualCorrelation(), interpretR(), laggedPairs(), ScatterPoint, shiftDay(), CorrelationCategory (+5 more)

### Community 68 - "index.ts"
Cohesion: 0.21
Nodes (11): logGamma(), regularizedIncompleteBeta(), studentTPValue(), cohensD(), erfApprox(), mean(), normalCDF(), olsSlope() (+3 more)

### Community 69 - "notify"
Cohesion: 0.18
Nodes (9): SearchModal(), SearchResult, AuditEvent, DataCoverage, SystemHealth(), RichEditor(), SettingsView(), useSyncActions() (+1 more)

### Community 70 - "sprintReview.ts"
Cohesion: 0.18
Nodes (8): Json, MonthPillarAverages, avgPillarScores(), gatherSprintFacts(), SprintFacts, SprintKpiSummary, SprintProjectDecision, weekStartsInSprint()

### Community 71 - "WeeklyReviewModal.tsx"
Cohesion: 0.30
Nodes (12): Props, WeeklyReviewModal(), createCustomPrediction(), listWeeklyPredictions(), Prediction, resolveCustomPrediction(), deleteStreamEntry(), isVoiceEntry() (+4 more)

### Community 72 - "warsawDayBoundsISO"
Cohesion: 0.35
Nodes (12): warsawDayBoundsISO(), useGrowthData(), fetchGrowthPrevWeekSummary(), GrowthWeekRecap, useGrowthWeekRecap(), partitionSkillTree(), shiftWeekStart(), computePowerListWeekStats() (+4 more)

### Community 73 - "DailyStrainCard.tsx"
Cohesion: 0.21
Nodes (12): CONF_LABEL, CONF_PILL, DailyStrainCard(), LIMITER_PL, READINESS_MAP, SIGNAL_PILL, STATUS_GLOW, STATUS_RING (+4 more)

### Community 74 - "goalSpine.ts"
Cohesion: 0.24
Nodes (9): BORN, FUEL, OrientationFooter(), useGoalSpineInvalidation(), useLifeGoals(), cache, CacheEntry, invalidateListeners (+1 more)

### Community 75 - "BehaviorCapturePanel.tsx"
Cohesion: 0.26
Nodes (11): BehaviorCapturePanel(), BehaviorCapturePanelProps, BEHAVIOR_CAPTURE_ENTRIES, BEHAVIOR_CONFOUNDERS, BehaviorCaptureEntry, BehaviorCaptureStore, BehaviorConfounderKey, storeLabel() (+3 more)

### Community 76 - "Keep.tsx"
Cohesion: 0.38
Nodes (9): EditNoteModal(), COLORS, getColor(), highlightHtml(), Note, relativeDate(), sanitizeHtml(), MasonryGrid() (+1 more)

### Community 77 - "unwrapList"
Cohesion: 0.26
Nodes (10): BrainHealth(), BrainHealthRow, fmtDate(), fmtPace(), fmtTime(), isRun(), RunRow(), StravaWidget() (+2 more)

### Community 78 - "WeekHub.tsx"
Cohesion: 0.41
Nodes (9): WeekHub(), ActionCenterSheet(), PendingClarification, usePendingActionCount(), SystemProposalCard(), fetchPendingProposals(), resolveProposal(), syncFrictionProposals() (+1 more)

### Community 79 - "magazineBar.ts"
Cohesion: 0.26
Nodes (9): MagazineBar(), buildMagazineFromDirection(), dayLabel(), loadOracleScheduleOverride(), mergeMagazineView(), CompletedItem, ScheduleItem, ScheduleViewData (+1 more)

### Community 80 - "lifeGoals.ts"
Cohesion: 0.18
Nodes (10): DreamPillarSource, LIFE_GOAL_PILLARS, LifeGoalDateKey, LifeGoalDisplayRow, lifeGoalDisplayRowsFromProjects(), LifeGoalKey, LifeGoalPillarId, PROJECT_COLOR_PILLAR (+2 more)

### Community 81 - "offlineQueue.ts"
Cohesion: 0.31
Nodes (11): flushOfflineQueue(), getQueuedWriteCount(), getQueuedWrites(), initOfflineSync(), isOfflineError(), openDb(), QueueEntry, queueOfflineWrite() (+3 more)

### Community 82 - "strava.ts"
Cohesion: 0.26
Nodes (12): detectFrozenSensor(), fetchActivities(), fetchActivityDetail(), getAccessToken(), INITIAL_SYNC_FROM, isOuraDuplicate(), mergeHRIntoSplits(), pairOuraDuplicates() (+4 more)

### Community 83 - "App.tsx"
Cohesion: 0.21
Nodes (8): AppRoutes(), CorrelationsPage, DesktopDashboard, EndMyopiaCalculator, GrowthView, MedicalStudiesPage, getWarsawHourMinute(), useNotifications()

### Community 84 - "DashboardHeader.tsx"
Cohesion: 0.21
Nodes (8): DashboardHeader(), DashboardHeaderProps, BrandTitle(), BrandTitleProps, CharacterAvatar(), CharacterAvatarProps, PersonaAvatarButton(), PersonaAvatarButtonProps

### Community 85 - "SupplementsPanel.tsx"
Cohesion: 0.30
Nodes (9): SupplementsPanel(), SupplementsPanelProps, addSupplementLog(), fetchSupplementLogsSince(), fetchSupplements(), saveSupplement(), Supplement, SupplementLog (+1 more)

### Community 86 - "backtest-brain.mjs"
Cohesion: 0.18
Nodes (6): ANON_KEY, __dirname, dotenv, __filename, LIMIT_DAYS, OUT_FILE

### Community 87 - "HexagonPanel.tsx"
Cohesion: 0.24
Nodes (9): CHART_LABELS, DEFAULT_SCORES, formatSavedAt(), HexagonPanel(), HexagonScores, normalizeScores(), parseStoredPref(), SCORE_KEYS (+1 more)

### Community 88 - "GrowthCockpit.tsx"
Cohesion: 0.20
Nodes (8): GrowthCockpit(), GrowthContextData, computeTheoryPracticeBalance(), pinResourceKind(), FocusProposal, GrowthPrevWeekSummary, PowerListWeekStats, WeekDirectionGoals

### Community 89 - "weekly-recap.ts"
Cohesion: 0.38
Nodes (10): addDaysStr(), avgBedtimeLabel(), factsToPrompt(), gatherWeekFacts(), getSprintInfoForDate(), isVoiceEntry(), mean(), monthThemeSourceForWeek() (+2 more)

### Community 90 - "timeseries.ts"
Cohesion: 0.33
Nodes (10): avgOf(), corsHeaders, expandPhase(), expandSeries(), fetchAllPages(), fetchHeartrateWindowed(), PHASE_MAP, runTimeseries() (+2 more)

### Community 91 - "oss-audit.mjs"
Cohesion: 0.22
Nodes (8): checks, findings, gitVisibleFiles(), ignoredDirs, ignoredFiles, localOnlyFiles, root, walk()

### Community 92 - "useNutritionData.ts"
Cohesion: 0.33
Nodes (7): NutritionCard(), NutritionCardProps, qualityColor(), DailyNutritionRow, TodayEntry, useNutritionData(), UseNutritionDataProps

### Community 93 - "useTodayCalendarEvents.ts"
Cohesion: 0.36
Nodes (6): TodayEventsCard(), CAT_DOT, fmt(), TodayEventsPanel(), TodayCalEvent, useTodayCalendarEvents()

### Community 94 - "Heatmap.tsx"
Cohesion: 0.31
Nodes (8): ExerciseLog, Heatmap(), HeatmapProps, isLogWellness(), SessionItem, sessionVol(), StravaActivity, WELLNESS_NAMES

### Community 95 - "SkillRadarPanel.tsx"
Cohesion: 0.31
Nodes (5): polar(), SkillRadarPanel(), LearningSkillSnapshot, SCORE_LABELS, SCORE_RUBRICS

### Community 96 - "PatternsView.tsx"
Cohesion: 0.28
Nodes (7): PATTERN_EMOJI, PatternCard(), PatternCardProps, PatternData, PatternsView(), PatternsViewProps, STATUS_ORDER

### Community 97 - "correlationSeries.ts"
Cohesion: 0.32
Nodes (6): SeriesPoint, aggregateStravaRuns(), buildMetricSeries(), emptySeries(), SeriesBuildInput, warsawHour()

### Community 98 - "HtmlCard.tsx"
Cohesion: 0.36
Nodes (6): HtmlCard(), HtmlCardProps, sanitizeHtml(), HTML_CARD_TEMPLATE_IDS, HTML_CARD_TEMPLATES, resolveHtmlTemplate()

### Community 99 - "ErrorBoundary.tsx"
Cohesion: 0.32
Nodes (4): ErrorBoundary, isChunkLoadError(), Props, State

### Community 100 - "correlationInterest.ts"
Cohesion: 0.32
Nodes (7): BehaviorEffectLike, correlationInterestScore(), CorrelationLike, isInterestingBehaviorEffect(), isInterestingCorrelation(), isPrivateBehaviorKey(), isPrivateBehaviorMetric()

### Community 101 - "knip.json"
Cohesion: 0.29
Nodes (6): entry, ignore, ignoreDependencies, project, $schema, knip

### Community 102 - "ClarificationRequestCard.tsx"
Cohesion: 0.29
Nodes (6): ClarificationRequest, ClarificationRequestCard(), Option, OTHER_OPT, Props, UNCERTAIN_OPT

### Community 104 - "EisenhowerMatrix.tsx"
Cohesion: 0.38
Nodes (6): EisenhowerMatrix(), isUrgent(), Item, Props, quadrantOf(), QUADRANTS

### Community 105 - "growthSeed.ts"
Cohesion: 0.38
Nodes (5): insertDefaultSkillTree(), restoreDefaultSkillTree(), DEFAULT_SKILL_TREE, DefaultSkillTreeNode, DefaultSubSkill

### Community 106 - "outcomes.ts"
Cohesion: 0.48
Nodes (6): formatAvg(), isMetricSuccessful(), mapCatalogMetricToColumn(), runPatternOutcomes(), supabase, thresholdLabel()

### Community 108 - "package.json"
Cohesion: 0.33
Nodes (5): license, name, private, type, version

### Community 109 - "backfill_triads.mjs"
Cohesion: 0.33
Nodes (3): __dirname, __filename, KEY

### Community 110 - "restore-vanguard.mjs"
Cohesion: 0.53
Nodes (5): ensureBucketExists(), getFilesRecursive(), main(), supabase, uploadFile()

### Community 111 - "Card.tsx"
Cohesion: 0.33
Nodes (5): CardFactoryProps, Card(), CardProps, CardVariant, VARIANTS

### Community 113 - "backup-vanguard.mjs"
Cohesion: 0.60
Nodes (4): downloadFile(), listAllFiles(), main(), supabase

### Community 114 - "generate_magic_link.mjs"
Cohesion: 0.40
Nodes (3): env, envContent, supabase

### Community 115 - "import-pzh-xlsx.ts"
Cohesion: 0.50
Nodes (4): config, importPzhXlsx(), supabase, upsertBatch()

### Community 116 - "query_user.mjs"
Cohesion: 0.40
Nodes (3): env, envContent, supabase

### Community 117 - "task.tsx"
Cohesion: 0.40
Nodes (4): PRIORITY_COLOR, TaskCard(), TaskCardData, TaskItem

### Community 118 - "check-edge-functions.mjs"
Cohesion: 0.50
Nodes (3): files, functionsDir, result

### Community 119 - "inspect_chunk.mjs"
Cohesion: 0.50
Nodes (3): content, end, start

### Community 120 - "map_stack_trace.mjs"
Cohesion: 0.50
Nodes (3): consumer, originalPos, rawSourceMap

### Community 121 - "smoke-ui.mjs"
Cohesion: 0.67
Nodes (3): child, wait(), waitForServer()

### Community 122 - "procedure.tsx"
Cohesion: 0.50
Nodes (3): ProcedureCard(), ProcedureData, Step

### Community 123 - "routine.tsx"
Cohesion: 0.50
Nodes (3): RoutineCard(), RoutineData, RoutineItem

### Community 124 - "conversation.tsx"
Cohesion: 0.50
Nodes (3): ConversationCard(), ConversationData, Message

### Community 125 - "DashboardNavBar.tsx"
Cohesion: 0.50
Nodes (3): DashboardNavBar(), DashboardNavBarProps, NavItem

### Community 126 - "imports"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

## Knowledge Gaps
- **691 isolated node(s):** `LEGACY_FILES`, `$schema`, `entry`, `project`, `ignore` (+686 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getTodayWarsaw()` connect `getTodayWarsaw` to `biologyScoresLite.ts`, `CalendarView.tsx`, `FitnessScorePanel.tsx`, `WorkoutLogger.tsx`, `useTodoData.ts`, `supabase.ts`, `MuscleHeatmap.tsx`, `GeneralView.tsx`, `todo.ts`, `Stats.tsx`, `desktopUtils.ts`, `growth.ts`, `useDirectionContext.ts`, `goalSpineGuide.ts`, `OracleCard.tsx`, `Dashboard.tsx`, `GrowthView.tsx`, `foodLogging.ts`, `useFoodEntryData.ts`, `usePowerListData.ts`, `workoutLogging.ts`, `DesktopDashboard.tsx`, `getWeekStartWarsaw`, `goalSpine.queries.ts`, `database.types.ts`, `goalSpine.mutations.ts`, `nutritionContext.ts`, `bodyMetrics.ts`, `fetchGoalSpine`, `Projects.tsx`, `monthReview.ts`, `useDirection.ts`, `TaskAnalyticsCard.tsx`, `MorningPlanModal.tsx`, `WeeklyReviewModal.tsx`, `DailyStrainCard.tsx`, `BehaviorCapturePanel.tsx`, `Keep.tsx`, `WeekHub.tsx`, `magazineBar.ts`, `lifeGoals.ts`, `App.tsx`, `SupplementsPanel.tsx`, `HexagonPanel.tsx`, `useNutritionData.ts`, `useTodayCalendarEvents.ts`, `Heatmap.tsx`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **Why does `getWarsawDateString()` connect `getWarsawDateString` to `correlationSeries.ts`, `send.ts`, `correlations.ts`, `index.ts`, `createServiceClient`, `getTodayWarsaw`, `interceptors.ts`, `analysis.ts`, `index.ts`, `telegram.ts`, `deepseekChat`, `useTodoData.ts`, `correlationDiscovery.ts`, `metrics_strain.ts`, `index.ts`, `index.ts`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `formatWarsawDate()` connect `getTodayWarsaw` to `useFoodEntryData.ts`, `usePowerListData.ts`, `useDirection.ts`, `growth.ts`, `getWeekStartWarsaw`, `useTodoData.ts`, `Keep.tsx`, `getWarsawDateString`, `goalSpine.mutations.ts`, `magazineBar.ts`, `bodyMetrics.ts`, `Projects.tsx`, `Stats.tsx`, `desktopUtils.ts`, `TaskAnalyticsCard.tsx`, `useNutritionData.ts`, `Heatmap.tsx`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **What connects `LEGACY_FILES`, `$schema`, `entry` to the rest of the system?**
  _691 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `reconcile.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05029890744176459 - nodes in this community are weakly interconnected._
- **Should `biologyScoresLite.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06293393057110862 - nodes in this community are weakly interconnected._
- **Should `CalendarView.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06238030095759234 - nodes in this community are weakly interconnected._