import type { Tables } from '../../../lib/database.types';

export function calculateProjection(
  data: Tables<'body_metrics'>[] | null | undefined,
  field: keyof Tables<'body_metrics'>,
  daysIntoFuture = 42
) {
  if (!data || data.length < 3) return null;

  const recentData = data.slice(-14);
  const validData = recentData
    .map((d) => ({
      ...d,
      value: Number(d[field]),
      time: d.date ? new Date(`${d.date}T12:00:00Z`).getTime() : NaN
    }))
    .filter((d) => !isNaN(d.value) && d.value !== 0 && !isNaN(d.time));
  if (validData.length < 2) return null;

  const firstTime = validData[0].time;
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let lastValidVal: number | null = null;
  let lastValidX = 0;

  validData.forEach((d) => {
    const x = (d.time - firstTime) / 86400000;
    sumX += x;
    sumY += d.value;
    sumXY += x * d.value;
    sumXX += x * x;
    n++;
    lastValidX = x;
    lastValidVal = d.value;
  });

  if (n < 2) return null;
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const projectedValue = slope * (lastValidX + daysIntoFuture) + intercept;
  const currentActual = lastValidVal ?? 0;

  return {
    value: projectedValue.toFixed(1),
    change: (projectedValue - currentActual).toFixed(1),
  };
}

