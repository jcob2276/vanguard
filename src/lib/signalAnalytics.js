/**
 * VANGUARD SIGNAL ANALYTICS v1.1
 * Core Behavioral Metrics Engine (Deterministic)
 */

export const calculateVanguardSignals = (data = {}) => {
  const { stayfree = [], oura = [], todayWin = null, nutrition = null } = data;

  // 1. DIGITAL EXPOSURE VECTOR
  const exposureLoad = stayfree?.reduce((acc, curr) => acc + curr.duration_seconds, 0) || 0;
  const durationByDevice = stayfree?.reduce((acc, curr) => {
    acc[curr.device_name] = (acc[curr.device_name] || 0) + curr.duration_seconds;
    return acc;
  }, {}) || {};
  const realTimeEstimate = Math.max(...Object.values(durationByDevice), 0);
  const overlapFactor = realTimeEstimate > 0 ? (exposureLoad / realTimeEstimate) : 1.0;
  
  const unlocks = Math.max(...(stayfree?.map(d => d.unlocks) || [0]), 0);
  const fragmentation = unlocks / ((realTimeEstimate / 60) || 1);

  // 2. BIOLOGICAL RECOVERY VECTOR
  const latestOura = oura?.[0] || {};
  const sleepDuration = (latestOura.total_sleep_duration || 0) / 3600;
  const hrv = latestOura.hrv_average || 0;
  const rhr = latestOura.rhr_average || 0;

  // 3. EXECUTION VECTOR (Daily Wins)
  let completedTasks = 0;
  if (todayWin) {
    for (let i = 1; i <= 5; i++) {
      if (todayWin[`done_${i}`]) completedTasks++;
    }
  }
  const executionRatio = completedTasks / 5;

  // 4. COMPLEX VANGUARD SIGNALS (V1 Architecture)
  
  // Avoidance Index = High intent (Power List started) + Low execution + High escape behavior (social media)
  const socialTime = stayfree?.filter(i => /messenger|facebook|instagram|tiktok|youtube/i.test(i.app_name))
    .reduce((acc, curr) => acc + curr.duration_seconds, 0) || 0;
  const avoidanceIndex = (1 - executionRatio) * (socialTime / 3600);

  // Dopamine Load = (Social Media Time / Total Time) * Overlap Factor * Fragmentation
  const dopamineLoad = (socialTime / (exposureLoad || 1)) * overlapFactor * fragmentation;

  // Recovery Debt = Based on deviation (placeholder until baselines are ready)
  const recoveryDebt = (8 - sleepDuration) + (rhr > 60 ? 1 : 0);

  return {
    metrics: {
      exposureLoad: Math.round(exposureLoad / 60),
      realTimeEstimate: Math.round(realTimeEstimate / 60),
      overlapFactor: parseFloat(overlapFactor.toFixed(2)),
      fragmentationIndex: parseFloat(fragmentation.toFixed(2)),
      avoidanceIndex: parseFloat(avoidanceIndex.toFixed(2)),
      dopamineLoad: parseFloat(dopamineLoad.toFixed(2)),
      recoveryDebt: parseFloat(recoveryDebt.toFixed(2)),
      executionRatio
    },
    confidence: (stayfree?.length > 0 && oura?.length > 0) ? 1.0 : 0.5
  };
};

/**
 * VANGUARD BEHAVIORAL STATE MACHINE
 * Deterministic transitions between operational states.
 */
export const determineVanguardState = (signals) => {
  const m = signals.metrics;

  if (m.dopamineLoad > 1.5 && m.fragmentationIndex > 1.2) return 'DOPAMINE_LOOP';
  if (m.avoidanceIndex > 1.0 && m.executionRatio < 0.4) return 'AVOIDANCE';
  if (m.recoveryDebt > 3.0 || m.overlapFactor > 2.0) return 'OVERLOADED';
  if (m.executionRatio === 1.0 && m.overlapFactor < 1.3) return 'LOCKED_IN';
  if (m.executionRatio >= 0.8) return 'STABLE';
  if (m.recoveryDebt > 1.0) return 'RECOVERY';
  
  return 'STABLE';
};
