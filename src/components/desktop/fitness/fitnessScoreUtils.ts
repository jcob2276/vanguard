import { daysBefore } from '../desktopUtils';
import { getSaunaStats, isWellnessOnlySession, sessionDateKey } from '../../../lib/health/workoutLogging';
import { getTodayWarsaw } from '../../../lib/date';
import { getWeekStartWarsaw } from '../../../lib/growth/growth';
import {
  bodyCompositionBonus,
  cooperBestKm,
  cooperToPoints,
  computeHabitConsistency,
  extractLiftPRs,
  strengthCapacityScore,
  type BodyRow,
} from '@vanguard/domain';
import { mergeLatestBodyMetrics } from '../../../lib/health/bodyMetrics';
import { stravaDay, countQualityStrengthSets, summarizeStravaWindow } from './fitnessScoreHelpers';

export type ScoreKey = 'consistency' | 'endurance' | 'strength' | 'habits' | 'progress' | 'volume';

export type DimensionBreakdown = {
  key: ScoreKey;
  label: string;
  score: number;
  detail: string;
  group: 'capability' | 'process';
};

export function computeFitnessProfile(input: {
  oura: any[];
  nutrition: any[];
  sessions: any[];
  strava: any[];
  habits: any[];
  habitLogs: any[];
  volData: any[];
  body: BodyRow[];
  heightCm: number | null;
  today: string;
}) {
  const { oura, nutrition, sessions, strava, habits, habitLogs, volData, body, heightCm, today } = input;
  const since7 = daysBefore(7);
  const since14 = daysBefore(14);
  const weekStart = getWeekStartWarsaw(getTodayWarsaw());

  const trainingSessions7d = sessions.filter(
    (s) => sessionDateKey(s.date) >= since7 && !isWellnessOnlySession(s),
  ).length;
  const strava7dActivities = strava.filter((a) => stravaDay(a) >= since7);
  const strava7d = strava7dActivities.length;
  const strava7dStats = summarizeStravaWindow(strava7dActivities);

  const habitConsistency = computeHabitConsistency(habits, habitLogs, today);
  const { habitRate, successTotal: habitSuccessTotal, slotTotal: habitSlotTotal, summaryLabel: habitSummaryLabel } =
    habitConsistency;
  const consistencyScore = Math.min(
    10,
    Math.max(1, parseFloat(((trainingSessions7d + strava7d) * 1.5 + habitRate * 4).toFixed(1))),
  );

  const aerobicPoints = Math.min(
    10,
    Math.max(
      0,
      parseFloat(
        (
          strava7dStats.runKm * 0.4 +
          strava7dStats.walkKm * 0.15 +
          strava7dStats.otherMin * 0.05
        ).toFixed(1),
      ),
    ),
  );
  const enduranceScore = (() => {
    const cooperKm = cooperBestKm(strava);
    const cooperPts = cooperToPoints(cooperKm);
    if (cooperPts.score <= 0) return aerobicPoints;
    return Math.min(
      10,
      Math.max(
        0,
        parseFloat((aerobicPoints * 0.55 + cooperPts.score * 0.45).toFixed(1)),
      ),
    );
  })();
  const cooperKm = cooperBestKm(strava);
  const cooperPts = cooperToPoints(cooperKm);

  const workouts14d = sessions.filter((s) => s.date >= since14 && !isWellnessOnlySession(s));
  const qualitySets14d = workouts14d.reduce(
    (sum, s) => sum + countQualityStrengthSets(s.exercise_logs),
    0,
  );
  const avgRpe14d =
    workouts14d.length > 0
      ? workouts14d.reduce((sum, s) => sum + (s.session_rpe || 5), 0) / workouts14d.length
      : 0;
  const recentStrengthScore =
    workouts14d.length === 0
      ? 0
      : Math.min(
          10,
          Math.max(
            0,
            parseFloat((qualitySets14d * 0.65 + avgRpe14d * 0.25).toFixed(1)),
          ),
        );

  const mergedBody = mergeLatestBodyMetrics(body);
  const latestWeight = mergedBody?.weight ?? null;
  const weightAsOf = mergedBody?.asOfDate ?? null;
  const liftPRs = extractLiftPRs(sessions, today);
  const capacity = strengthCapacityScore(liftPRs, latestWeight, weightAsOf);
  const strengthScore =
    capacity.score > 0
      ? Math.min(
          10,
          Math.max(
            0,
            parseFloat((recentStrengthScore * 0.4 + capacity.score * 0.6).toFixed(1)),
          ),
        )
      : recentStrengthScore;

  const oura7d = oura.filter((o) => o.date >= since7);
  const avgSleepScore =
    oura7d.length > 0
      ? oura7d.reduce((sum, o) => {
          const sleepScore =
            o.sleep_score ??
            (o.total_sleep_hours ? Math.min(100, (o.total_sleep_hours / 8) * 100) : null) ??
            o.readiness_score ??
            70;
          return sum + sleepScore;
        }, 0) / oura7d.length
      : 70;
  const sleepPoints = (avgSleepScore - 50) / 5;

  const nutr7d = nutrition.filter((n) => n.date >= since7);
  const proteinDays = nutr7d.filter((n) => n.protein >= 140).length;
  const proteinTargetMetRate = proteinDays / 7;
  const nutritionPoints = proteinTargetMetRate * 4;

  const { sessionsCount: saunaCount7d, totalMinutes: saunaMinutes7d } = getSaunaStats(sessions, since7);
  const saunaPoints = Math.min(
    4,
    parseFloat((saunaCount7d * 1.2 + saunaMinutes7d * 0.06).toFixed(1)),
  );

  const bodyBonus = bodyCompositionBonus(body, heightCm);

  const habitsScore = Math.min(
    10,
    Math.max(
      1,
      parseFloat((sleepPoints + nutritionPoints + saunaPoints + bodyBonus.score).toFixed(1)),
    ),
  );

  const oura14d = oura.filter((o) => o.date >= since14);
  const ouraPrev7d = oura14d.filter((o) => o.date < since7);
  const first7dHRV =
    ouraPrev7d.length >= 3
      ? ouraPrev7d.reduce((sum, o) => sum + (o.hrv_avg || 45), 0) / ouraPrev7d.length
      : null;
  const last7dHRV =
    oura7d.length > 0 ? oura7d.reduce((sum, o) => sum + (o.hrv_avg || 45), 0) / oura7d.length : null;
  const hrvTrend = first7dHRV != null && last7dHRV != null && last7dHRV >= first7dHRV ? 1.5 : -1;

  const activity7d = trainingSessions7d + strava7d;
  const activityPrev7d =
    sessions.filter((s) => s.date >= daysBefore(14) && s.date < since7 && !isWellnessOnlySession(s)).length +
    strava.filter((a) => {
      const d = stravaDay(a);
      return d >= daysBefore(14) && d < since7;
    }).length;
  const activityTrend =
    activity7d >= activityPrev7d + 2 ? 1 : activity7d <= activityPrev7d - 2 ? -0.5 : 0;

  const avgReadiness7d = (() => {
    const rows = oura7d.filter((o) => o.readiness_score != null);
    return rows.length ? rows.reduce((sum, o) => sum + Number(o.readiness_score), 0) / rows.length : null;
  })();
  const avgReadinessPrev7d = (() => {
    const rows = ouraPrev7d.filter((o) => o.readiness_score != null);
    return rows.length ? rows.reduce((sum, o) => sum + Number(o.readiness_score), 0) / rows.length : null;
  })();
  const readinessTrend =
    avgReadiness7d != null && avgReadinessPrev7d != null
      ? avgReadiness7d >= avgReadinessPrev7d + 3
        ? 1
        : avgReadiness7d <= avgReadinessPrev7d - 3
          ? -1
          : 0
      : 0;

  const progressScore = Math.min(
    10,
    Math.max(1, parseFloat((5 + hrvTrend + readinessTrend + activityTrend).toFixed(1))),
  );

  const weekStrava = strava.filter((a) => stravaDay(a) >= weekStart);
  const weekStravaStats = summarizeStravaWindow(weekStrava);
  const currentWeekVolObj = volData[volData.length - 1];
  const strengthMg = currentWeekVolObj?.vol ?? 0;
  const loadPoints =
    Math.min(3.5, strengthMg * 0.3) +
    Math.min(3.5, weekStravaStats.runKm * 0.18) +
    Math.min(2, weekStravaStats.walkKm * 0.35 + weekStravaStats.otherMin * 0.04);
  const volumeScore = Math.min(10, Math.max(1, parseFloat((1 + loadPoints).toFixed(1))));

  const capabilityScore = Math.round(((enduranceScore + strengthScore) / 20) * 100);
  const processScore = Math.round(
    ((consistencyScore + habitsScore + progressScore + volumeScore) / 40) * 100,
  );

  const cardioParts: string[] = [];
  if (strava7dStats.runKm > 0) cardioParts.push(`${strava7dStats.runKm.toFixed(1)} km biegu`);
  if (strava7dStats.walkKm > 0) cardioParts.push(`${strava7dStats.walkKm.toFixed(1)} km marszu`);
  if (strava7dStats.otherMin > 0) cardioParts.push(`${Math.round(strava7dStats.otherMin)} min innych`);
  const cardioSummary =
    cardioParts.length > 0 ? cardioParts.join(', ') : 'brak aktywności cardio w Strava (7 dni)';

  const loadParts: string[] = [];
  if (strengthMg > 0) loadParts.push(`${strengthMg.toFixed(1)} Mg siłowo`);
  if (weekStravaStats.runKm > 0) loadParts.push(`${weekStravaStats.runKm.toFixed(1)} km biegu`);
  if (weekStravaStats.walkKm > 0) loadParts.push(`${weekStravaStats.walkKm.toFixed(1)} km marszu`);
  const loadSummary =
    loadParts.length > 0 ? loadParts.join(' + ') : 'brak zarejestrowanego obciążenia w tym tygodniu';

  const breakdowns: DimensionBreakdown[] = [
    {
      key: 'consistency',
      label: 'Regularność',
      score: consistencyScore,
      group: 'process',
      detail:
        `${trainingSessions7d} sesji siłowych + ${strava7d} cardio (7 dni). Nawyki — ${habitSummaryLabel}` +
        (habitSlotTotal > 0
          ? ` (łącznie ${habitSuccessTotal}/${habitSlotTotal}, ${Math.round(habitRate * 100)}%).`
          : '.') +
        ` Wzór: (trening + cardio) × 1,5 + nawyki × 4.` +
        (saunaCount7d > 0
          ? ` Sauna: ${saunaCount7d}× / ${saunaMinutes7d} min — liczy się w „Regeneracja & wellness", nie w regularności.`
          : ' Sauna/wellness liczy się osobno w „Regeneracja & wellness".'),
    },
    {
      key: 'endurance',
      label: 'Wydolność',
      score: enduranceScore,
      group: 'capability',
      detail:
        cooperPts.score > 0
          ? `Strava 7d → ${aerobicPoints.toFixed(1)} pkt (${cardioSummary}). ${cooperPts.detail} Blend: 55% tyg. + 45% max Cooper.`
          : `Strava 7d → ${aerobicPoints.toFixed(1)} pkt (${cardioSummary}). Bieg × 0,4/km, marsz × 0,15/km, reszta × 0,05/min.`,
    },
    {
      key: 'strength',
      label: 'Siła',
      score: strengthScore,
      group: 'capability',
      detail:
        capacity.score > 0
          ? `Ostatnie 14 dni: ${workouts14d.length} sesji, ${qualitySets14d} serii jakościowych, śr. RPE ${avgRpe14d.toFixed(1)} → ${recentStrengthScore.toFixed(1)}/10. Kapitał (maxy ×BW, decay do 3 lat): ${capacity.detail} Blend: 40% ostatnie + 60% maxy.`
          : workouts14d.length > 0
            ? `${workouts14d.length} sesji (14 dni), ${qualitySets14d} serii blisko max (MSP/PWS lub RIR≤1), śr. RPE ${avgRpe14d.toFixed(1)}. Brak maxów w historii — liczy się tylko ostatnia praca.`
            : 'Brak sesji siłowych w ostatnich 14 dniach.',
    },
    {
      key: 'habits',
      label: 'Regeneracja & wellness',
      score: habitsScore,
      group: 'process',
      detail:
        (bodyBonus.detail
          ? `${bodyBonus.detail}. `
          : '') +
        (saunaCount7d > 0
          ? `Sen: śr. ${avgSleepScore.toFixed(0)}/100. Białko ≥140 g: ${proteinDays}/7 dni (${Math.round(proteinTargetMetRate * 100)}%). Sauna: ${saunaCount7d}× / ${saunaMinutes7d} min → +${saunaPoints.toFixed(1)} pkt.`
          : `Sen: śr. ${avgSleepScore.toFixed(0)}/100. Białko ≥140 g: ${proteinDays}/7 dni (${Math.round(proteinTargetMetRate * 100)}%). Sauna: brak w 7 dniach.`),
    },
    {
      key: 'progress',
      label: 'Adaptacja',
      score: progressScore,
      group: 'process',
      detail:
        first7dHRV != null && last7dHRV != null
          ? `Trendy 7 vs poprzednie 7 dni — HRV: ${last7dHRV.toFixed(0)} vs ${first7dHRV.toFixed(0)} ms (${hrvTrend > 0 ? '+1,5' : '−1'}), readiness: ${avgReadiness7d?.toFixed(0) ?? '—'} vs ${avgReadinessPrev7d?.toFixed(0) ?? '—'} (${readinessTrend >= 0 ? '+' : ''}${readinessTrend}), aktywność: ${activity7d} vs ${activityPrev7d} sesji/cardio (${activityTrend >= 0 ? '+' : ''}${activityTrend}). To nie są zadania kariery — tylko sygnały regeneracji i obciążenia.`
          : `Aktywność 7d: ${activity7d} vs poprzednie ${activityPrev7d}. Brak pełnych danych HRV do porównania tygodni.`,
    },
    {
      key: 'volume',
      label: 'Obciążenie tygodnia',
      score: volumeScore,
      group: 'process',
      detail: `Hybrydowe obciążenie bieżącego tygodnia: ${loadSummary}. Wzór: Mg siłowo (max 3,5) + km biegu (max 3,5) + marsz/min inne (max 2) + baza 1.`,
    },
  ];

  return {
    consistency: consistencyScore,
    endurance: enduranceScore,
    strength: strengthScore,
    habits: habitsScore,
    progress: progressScore,
    volume: volumeScore,
    capabilityScore,
    processScore,
    breakdowns,
  };
}
