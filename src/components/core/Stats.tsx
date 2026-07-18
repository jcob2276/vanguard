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
import { BodyMetricsSection } from './stats/BodyMetricsSection';
import { DataExportSection } from './stats/DataExportSection';
import { FoodAnalysisSection } from './stats/FoodAnalysisSection';
import { mergeLatestBodyMetrics } from '../../lib/health/bodyMetrics';
import { useStatsData } from './hooks/useStatsData';

export default function Stats({ topSlot = null, runningSlot = null }: { topSlot?: ReactNode; runningSlot?: ReactNode }) {
  const {
    userId,
    loading,
    bodyData,
    recentSessions,
    newMetric, setNewMetric,
    heightCm,
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
    trends,
    isAnalyzingTraining,
    trainingAnalysis,
    saveMetrics,
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

  const mergedBody = mergeLatestBodyMetrics(bodyData);
  const latestBody = mergedBody
    ? {
        weight: mergedBody.weight,
        waist: mergedBody.waist,
        neck: mergedBody.neck,
        belly: mergedBody.belly,
        hips: mergedBody.hips,
        chest: mergedBody.chest,
        thigh: mergedBody.thigh,
        biceps_l: mergedBody.biceps_l,
        calf: mergedBody.calf,
        body_fat: mergedBody.body_fat,
      }
    : null;

  return (
    <div className="space-y-6 pb-4">

      <BodyMetricsSection
        trends={trends}
        newMetric={newMetric}
        setNewMetric={setNewMetric}
        latestBody={latestBody}
        heightCm={heightCm}
        saveMetrics={saveMetrics}
      />

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
