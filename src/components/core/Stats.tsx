/**
 * @component Stats
 * @role Hub zakładki Historia → Stats: ciało, treningi, dieta, eksport danych.
 * @folders stats/ = sekcje (TrainingAnalysisSection, WorkoutHistorySection, BodyMetricsSection,
 *          DataExportSection, FoodAnalysisSection -> stats/foodAnalysis/{Range,Single})
 * @usedBy DashboardHistoriaTab
 */
import type { ReactNode } from 'react';
import { WorkoutHistorySection } from './stats/WorkoutHistorySection';
import { DataExportSection } from './stats/DataExportSection';
import { useStatsData } from './hooks/useStatsData';

export default function Stats({ topSlot = null, runningSlot = null }: { topSlot?: ReactNode; runningSlot?: ReactNode }) {
  const {
    userId,
    loading,
    recentSessions,
    dateRange, setDateRange,
    isExporting,
    includeNutrition, setIncludeNutrition,
    includeJournal, setIncludeJournal,
    includeWorkouts, setIncludeWorkouts,
    includeBody, setIncludeBody,
    editingSession, setEditingSession,
    showAllSessions, setShowAllSessions,
    editForm, setEditForm,
    deleteSession,
    startEditing,
    updateSession,
    deleteLog,
    exportData,
  } = useStatsData();

  if (!userId) return null;
  if (loading) return <div className="p-8 text-center text-text-muted uppercase font-black animate-pulse tracking-widest">Wczytywanie...</div>;

  return (
    <div className="space-y-6 pb-4">
      <section className="card p-5 space-y-4">
        <DataExportSection
          dateRange={dateRange}
          setDateRange={setDateRange}
          includeWorkouts={includeWorkouts}
          setIncludeWorkouts={setIncludeWorkouts}
          includeBody={includeBody}
          setIncludeBody={setIncludeBody}
          includeNutrition={includeNutrition}
          setIncludeNutrition={setIncludeNutrition}
          includeJournal={includeJournal}
          setIncludeJournal={setIncludeJournal}
          exportData={exportData}
          isExporting={isExporting}
        />
      </section>

      {topSlot}

      <WorkoutHistorySection

        recentSessions={recentSessions}
        showAllSessions={showAllSessions}
        setShowAllSessions={setShowAllSessions}
        editingSession={editingSession}
        editForm={editForm}
        setEditForm={setEditForm}
        startEditing={startEditing}
        updateSession={updateSession}
        deleteSession={deleteSession}
        deleteLog={deleteLog}
        setEditingSession={setEditingSession}
      />

      {runningSlot}
    </div>
  );
}
