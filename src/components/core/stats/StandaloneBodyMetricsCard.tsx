import { BodyMetricsSection } from './BodyMetricsSection';
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
    <BodyMetricsSection
      trends={trends}
      newMetric={newMetric}
      setNewMetric={setNewMetric}
      latestBody={latestBody}
      heightCm={heightCm}
      saveMetrics={saveMetrics}
    />
  );
}
