export function detectSpirals(biometrics: any[], frictionEvents: any[]) {
  if (!biometrics || biometrics.length < 4) return null;

  const chronological = [...biometrics].sort((a, b) => a.date.localeCompare(b.date));
  const last4 = chronological.slice(-4);

  // 1. Downward spiral check
  let readinessDeclining = true;
  let executionLow = true;

  for (let i = 1; i < last4.length; i++) {
    const prev = last4[i - 1];
    const curr = last4[i];

    if (curr.readiness_score != null && prev.readiness_score != null) {
      if (curr.readiness_score > prev.readiness_score && curr.readiness_score >= 60) {
        readinessDeclining = false;
      }
    } else {
      readinessDeclining = false;
    }

    if (curr.execution_score != null && curr.execution_score > 0.55) {
      executionLow = false;
    }
  }

  const threeDaysAgoStr = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentFrictions = frictionEvents.filter(f => {
    const dateStr = typeof f.occurred_at === 'string' ? f.occurred_at.split('T')[0] : '';
    return dateStr >= threeDaysAgoStr;
  });

  if (readinessDeclining && (executionLow || recentFrictions.length >= 2)) {
    return {
      type: 'downward_spiral',
      reason: `Wykryto spiralę spadkową: spadek regeneracji przez 4 dni z rzędu (${last4.map(b => b.readiness_score ?? '—').join(' -> ')}) w połączeniu z niskim wykonaniem lub ${recentFrictions.length} tarciami behawioralnymi.`
    };
  }

  // 2. Upward momentum check
  let readinessHigh = true;
  let executionHigh = true;

  for (let i = 0; i < last4.length; i++) {
    const curr = last4[i];
    if (curr.readiness_score == null || curr.readiness_score < 72) readinessHigh = false;
    if (curr.execution_score == null || curr.execution_score < 0.75) executionHigh = false;
  }

  if (readinessHigh && executionHigh && recentFrictions.length === 0) {
    return {
      type: 'upward_momentum',
      reason: `Wykryto silną trajektorię wzrostową (momentum): wysoka regeneracja (${last4.map(b => b.readiness_score).join(', ')}) oraz świetna realizacja celów (${last4.map(b => Math.round(b.execution_score * 100) + '%').join(', ')}) bez żadnych tarć w ostatnich 3 dniach.`
    };
  }

  return null;
}
