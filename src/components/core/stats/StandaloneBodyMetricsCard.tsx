import { BodyMetricsSection } from './BodyMetricsSection';
import { FoodAnalysisSection } from './FoodAnalysisSection';
import { TrainingAnalysisSection } from './TrainingAnalysisSection';
import { useStatsData } from '../hooks/useStatsData';
import { mergeLatestBodyMetrics } from '../../../lib/health/bodyMetrics';

export default function StandaloneBodyMetricsCard() {
  const {
    userId,
    loading,
    bodyData,
    newMetric,
    setNewMetric,
    heightCm,
    trends,
    saveMetrics,
    analyzePeriod,
    setAnalyzePeriod,
    analyzeResult,
    setAnalyzeResult,
    analyzeDate,
    setAnalyzeDate,
    analyzeFood,
    isAnalyzing,
    trainingAnalysis,
    analyzeTrainingLoad,
    isAnalyzingTraining,
  } = useStatsData();

  if (!userId || loading) return null;

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
    <div className="space-y-4">
      <BodyMetricsSection
        trends={trends}
        newMetric={newMetric}
        setNewMetric={setNewMetric}
        latestBody={latestBody}
        heightCm={heightCm}
        saveMetrics={saveMetrics}
      />

      <div className="card p-5 space-y-4">
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
      </div>

      <TrainingAnalysisSection
        trainingAnalysis={trainingAnalysis}
        analyzeTrainingLoad={analyzeTrainingLoad}
        isAnalyzingTraining={isAnalyzingTraining}
      />
    </div>
  );
}
