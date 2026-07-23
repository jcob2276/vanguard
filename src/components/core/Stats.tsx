/**
 * @component Stats
 * @role Hub zakładki Historia → Stats: ciało, treningi, dieta, eksport danych.
 * @folders stats/ = sekcje (TrainingAnalysisSection, WorkoutHistorySection, BodyMetricsSection,
 *          DataExportSection, FoodAnalysisSection -> stats/foodAnalysis/{Range,Single})
 * @usedBy DashboardHistoriaTab
 */
import Button from '../ui/Button';
import type { ReactNode } from 'react';
import { TrainingAnalysisSection } from './stats/TrainingAnalysisSection';
import { WorkoutHistorySection } from './stats/WorkoutHistorySection';
import { DataExportSection } from './stats/DataExportSection';
import { FoodAnalysisSection } from './stats/FoodAnalysisSection';
import { useStatsData } from './hooks/useStatsData';

export default function Stats({ topSlot = null, runningSlot = null }: { topSlot?: ReactNode; runningSlot?: ReactNode }) {
  const {
    userId,
    loading,
    recentSessions,
    dateRange, setDateRange,
    isExporting,
    isExportingOura,
    includeNutrition, setIncludeNutrition,
    includeJournal, setIncludeJournal,
    includeOura, setIncludeOura,
    includeHabits, setIncludeHabits,
    includeWorkouts, setIncludeWorkouts,
    includeBody, setIncludeBody,
    includeActivityWatch, setIncludeActivityWatch,
    isAnalyzing,
    analyzeDate, setAnalyzeDate,
    analyzePeriod, setAnalyzePeriod,
    analyzeResult, setAnalyzeResult,
    editingSession, setEditingSession,
    showAllSessions, setShowAllSessions,
    editForm, setEditForm,
    isAnalyzingTraining,
    trainingAnalysis,
    deleteSession,
    analyzeFood,
    analyzeTrainingLoad,
    startEditing,
    updateSession,
    deleteLog,
    exportData,
    exportOuraCSV,
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
          includeOura={includeOura}
          setIncludeOura={setIncludeOura}
          includeHabits={includeHabits}
          setIncludeHabits={setIncludeHabits}
          includeActivityWatch={includeActivityWatch}
          setIncludeActivityWatch={setIncludeActivityWatch}
          exportData={exportData}
          isExporting={isExporting}
        />

        <FoodAnalysisSection
          analyzePeriod={analyzePeriod}
          setAnalyzePeriod={setAnalyzePeriod}
          analyzeResult={analyzeResult}
          setAnalyzeResult={setAnalyzeResult}
          analyzeDate={analyzeDate}
          setAnalyzeDate={setAnalyzeDate}
          analyzeFood={analyzeFood}
          isAnalyzing={isAnalyzing}
        />

        <Button
          variant="outline"
          onClick={exportOuraCSV}
          disabled={isExportingOura}
          className="w-full"
        >
          {isExportingOura ? 'Generowanie...' : 'Pobierz Oura (.csv)'}
        </Button>
      </section>

      {topSlot}

      <TrainingAnalysisSection
        trainingAnalysis={trainingAnalysis}
        analyzeTrainingLoad={analyzeTrainingLoad}
        isAnalyzingTraining={isAnalyzingTraining}
      />

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
