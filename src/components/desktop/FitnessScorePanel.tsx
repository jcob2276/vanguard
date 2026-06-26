import { useMemo } from 'react';
import { Panel } from './Panel';
import { daysBefore, isLogWellness, weekStartDate } from './desktopUtils';
import { getSaunaStats, isWellnessOnlySession } from '../../lib/workoutLogging';
import { getTodayWarsaw } from '../../lib/date';
import {
  bodyCompositionBonus,
  cooperBestKm,
  cooperToPoints,
  extractLiftPRs,
  strengthCapacityScore,
  type BodyRow,
} from '../../lib/fitnessScore';
import { Activity } from 'lucide-react';

interface FitnessScorePanelProps {
  oura: any[];
  nutrition: any[];
  sessions: any[];
  strava: any[];
  habits: any[];
  habitLogs: any[];
  volData: any[];
  body: BodyRow[];
  heightCm: number | null;
  theme: string;
  grid: string;
}

type ScoreKey = 'consistency' | 'endurance' | 'strength' | 'habits' | 'progress' | 'volume';

type DimensionBreakdown = {
  key: ScoreKey;
  label: string;
  score: number;
  detail: string;
};

function stravaDay(a: { start_date?: string }) {
  return (a.start_date || '').slice(0, 10);
}

function countQualityStrengthSets(logs: any[]) {
  return (logs || []).filter((l) => {
    if (isLogWellness(l)) return false;
    if (l.is_pws_or_msp) return true;
    if (l.rir != null && Number(l.rir) <= 1) return true;
    return false;
  }).length;
}

function summarizeStravaWindow(activities: any[]) {
  let runKm = 0;
  let walkKm = 0;
  let otherMin = 0;
  activities.forEach((a) => {
    const distKm = (a.distance || 0) / 1000;
    const sport = a.sport_type || '';
    if (['Run', 'TrailRun', 'VirtualRun'].includes(sport)) runKm += distKm;
    else if (['Walk', 'Hike'].includes(sport)) walkKm += distKm;
    else otherMin += (a.moving_time || 0) / 60;
  });
  return { runKm, walkKm, otherMin, count: activities.length };
}

function computeFitnessProfile(input: {
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
  const weekStart = weekStartDate();

  const trainingSessions7d = sessions.filter(
    (s) => s.date >= since7 && !isWellnessOnlySession(s),
  ).length;
  const strava7dActivities = strava.filter((a) => stravaDay(a) >= since7);
  const strava7d = strava7dActivities.length;
  const strava7dStats = summarizeStravaWindow(strava7dActivities);

  const habitLogs7d = habitLogs.filter((l) => l.date >= since7 && l.completed).length;
  const activeHabitsCount = habits.length || 1;
  const habitRate = habitLogs7d / (activeHabitsCount * 7);
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
        1,
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
      ? 1
      : Math.min(
          10,
          Math.max(
            1,
            parseFloat((qualitySets14d * 0.65 + avgRpe14d * 0.25).toFixed(1)),
          ),
        );

  const latestWeight =
    [...body].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))[0]?.weight ?? null;
  const liftPRs = extractLiftPRs(sessions, today);
  const capacity = strengthCapacityScore(liftPRs, latestWeight ?? null);
  const strengthScore =
    capacity.score > 0
      ? Math.min(
          10,
          Math.max(
            1,
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

  const sum =
    consistencyScore + enduranceScore + strengthScore + habitsScore + progressScore + volumeScore;
  const fitnessScore = Math.round((sum / 60) * 1000);

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
      detail: `${trainingSessions7d} sesji treningowych + ${strava7d} cardio (7 dni, bez sauny). Nawyki: ${habitLogs7d}/${activeHabitsCount * 7} (${Math.round(habitRate * 100)}%). Wzór: (trening + cardio) × 1,5 + nawyki × 4.`,
    },
    {
      key: 'endurance',
      label: 'Wydolność',
      score: enduranceScore,
      detail:
        cooperPts.score > 0
          ? `Strava 7d → ${aerobicPoints.toFixed(1)} pkt (${cardioSummary}). ${cooperPts.detail} Blend: 55% tyg. + 45% max Cooper.`
          : `Strava 7d → ${aerobicPoints.toFixed(1)} pkt (${cardioSummary}). Bieg × 0,4/km, marsz × 0,15/km, reszta × 0,05/min.`,
    },
    {
      key: 'strength',
      label: 'Siła',
      score: strengthScore,
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
      detail:
        first7dHRV != null && last7dHRV != null
          ? `Trendy 7 vs poprzednie 7 dni — HRV: ${last7dHRV.toFixed(0)} vs ${first7dHRV.toFixed(0)} ms (${hrvTrend > 0 ? '+1,5' : '−1'}), readiness: ${avgReadiness7d?.toFixed(0) ?? '—'} vs ${avgReadinessPrev7d?.toFixed(0) ?? '—'} (${readinessTrend >= 0 ? '+' : ''}${readinessTrend}), aktywność: ${activity7d} vs ${activityPrev7d} sesji/cardio (${activityTrend >= 0 ? '+' : ''}${activityTrend}). To nie są zadania kariery — tylko sygnały regeneracji i obciążenia.`
          : `Aktywność 7d: ${activity7d} vs poprzednie ${activityPrev7d}. Brak pełnych danych HRV do porównania tygodni.`,
    },
    {
      key: 'volume',
      label: 'Obciążenie tygodnia',
      score: volumeScore,
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
    fitnessScore,
    sum,
    breakdowns,
  };
}

const RADAR_KEYS: ScoreKey[] = ['endurance', 'strength', 'habits', 'progress', 'volume', 'consistency'];

const RADAR_LABELS = [
  { key: 'endurance' as const, name: 'Wydolność', align: 'start' as const, xOff: 8, yOff: -3 },
  { key: 'strength' as const, name: 'Siła', align: 'start' as const, xOff: 10, yOff: 4 },
  { key: 'habits' as const, name: 'Regeneracja', align: 'start' as const, xOff: 8, yOff: 10 },
  { key: 'progress' as const, name: 'Adaptacja', align: 'end' as const, xOff: -8, yOff: 10 },
  { key: 'volume' as const, name: 'Obciążenie', align: 'end' as const, xOff: -10, yOff: 4 },
  { key: 'consistency' as const, name: 'Regularność', align: 'end' as const, xOff: -8, yOff: -3 },
];

export default function FitnessScorePanel({
  oura,
  nutrition,
  sessions,
  strava,
  habits,
  habitLogs,
  volData,
  body,
  heightCm,
  theme,
  grid,
}: FitnessScorePanelProps) {
  const today = getTodayWarsaw();
  const profile = useMemo(
    () =>
      computeFitnessProfile({
        oura,
        nutrition,
        sessions,
        strava,
        habits,
        habitLogs,
        volData,
        body,
        heightCm,
        today,
      }),
    [oura, nutrition, sessions, strava, habits, habitLogs, volData, body, heightCm, today],
  );

  const cx = 190;
  const cy = 155;
  const r = 92;

  return (
    <Panel title="Hybrydowy Profil & Fitness Score" className="h-full flex flex-col">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 items-center flex-1">
        <div className="flex flex-col items-center justify-center py-4 xl:py-8 xl:min-h-[280px] border-b xl:border-b-0 xl:border-r border-border-custom">
          <div className="flex items-center gap-1.5 mb-2 text-primary">
            <Activity size={16} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">
              Fitness Score
            </span>
          </div>
          <p className="text-[72px] xl:text-[84px] font-black italic tracking-tighter leading-none text-text-primary font-display drop-shadow-[0_4px_12px_rgba(79,70,229,0.15)]">
            {profile.fitnessScore}
          </p>
          <p className="text-[10px] font-bold text-text-muted mt-3 uppercase tracking-widest text-center">
            Skala hybrydowa (0 – 1000)
          </p>
          <p className="text-[11px] text-text-secondary mt-4 max-w-[260px] text-center leading-relaxed">
            6 wymiarów hybrydy (siła + cardio + regeneracja). Suma {profile.sum.toFixed(1)}/60 → skala 1000.
          </p>
        </div>

        <div className="flex justify-center items-center py-2">
          <svg width="100%" height={320} viewBox="0 0 380 320" className="overflow-visible max-w-[380px]">
            <defs>
              <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {[2, 4, 6, 8, 10].map((k) => {
              const points = [0, 1, 2, 3, 4, 5]
                .map((index) => {
                  const angle = ((index * 60 - 60) * Math.PI) / 180;
                  const val = k / 10;
                  return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
                })
                .join(' ');
              return (
                <polygon
                  key={k}
                  points={points}
                  fill="none"
                  stroke={grid}
                  strokeWidth="1"
                  strokeDasharray={k === 10 ? 'none' : '2,3'}
                  className="opacity-70"
                />
              );
            })}

            {[0, 1, 2, 3, 4, 5].map((index) => {
              const angle = ((index * 60 - 60) * Math.PI) / 180;
              return (
                <line
                  key={index}
                  x1={cx}
                  y1={cy}
                  x2={cx + r * Math.cos(angle)}
                  y2={cy + r * Math.sin(angle)}
                  stroke={grid}
                  strokeWidth="1"
                  className="opacity-50"
                />
              );
            })}

            <polygon
              points={[0, 1, 2, 3, 4, 5]
                .map((index) => {
                  const key = RADAR_KEYS[index];
                  const score = profile[key];
                  const angle = ((index * 60 - 60) * Math.PI) / 180;
                  const val = score / 10;
                  return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
                })
                .join(' ')}
              fill="rgba(163, 230, 53, 0.08)"
              stroke="rgb(163, 230, 53)"
              strokeWidth="2"
              filter="url(#radar-glow)"
            />

            {[0, 1, 2, 3, 4, 5].map((index) => {
              const key = RADAR_KEYS[index];
              const score = profile[key];
              const angle = ((index * 60 - 60) * Math.PI) / 180;
              const val = score / 10;
              return (
                <circle
                  key={index}
                  cx={cx + r * val * Math.cos(angle)}
                  cy={cy + r * val * Math.sin(angle)}
                  r="4"
                  fill="rgb(163, 230, 53)"
                  stroke={theme === 'dark' ? '#000' : '#fff'}
                  strokeWidth="1.5"
                />
              );
            })}

            {RADAR_LABELS.map((lbl, index) => {
              const angle = ((index * 60 - 60) * Math.PI) / 180;
              const score = profile[lbl.key];
              const x = cx + (r + 16) * Math.cos(angle) + lbl.xOff;
              const y = cy + (r + 16) * Math.sin(angle) + lbl.yOff;
              return (
                <g key={lbl.key}>
                  <text
                    x={x}
                    y={y}
                    textAnchor={lbl.align}
                    className="text-[9px] font-black uppercase tracking-wider fill-text-primary"
                  >
                    {lbl.name}
                  </text>
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor={lbl.align}
                    className="text-[11px] font-black italic fill-primary font-display"
                  >
                    {score.toFixed(1)}
                    <tspan className="text-[8px] font-normal fill-text-muted not-italic">/10</tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-border-custom">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted mb-3">
          Skąd te oceny?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profile.breakdowns.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-border-custom/80 bg-surface-solid/30 px-3.5 py-3"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-[11px] font-black text-text-primary">{item.label}</span>
                <span className="text-[12px] font-black italic text-primary font-display shrink-0">
                  {item.score.toFixed(1)}/10
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-text-secondary">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-3 leading-relaxed">
          Hybrydowy profil = siła + cardio + regeneracja. Siła i wydolność łączą ostatnią pracę z maxami (wycisk / przysiad / martwy, Cooper) względem masy ciała — PR starsze niż ~3 lata wypadają. Regeneracja uwzględnia BMI, WHR i BF%.
        </p>
      </div>
    </Panel>
  );
}
