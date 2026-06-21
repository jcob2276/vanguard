import { useMemo } from 'react';
import { Panel } from './Panel';
import { daysBefore } from './desktopUtils';
import { Activity } from 'lucide-react';

interface FitnessScorePanelProps {
  oura: any[];
  nutrition: any[];
  sessions: any[];
  strava: any[];
  habits: any[];
  habitLogs: any[];
  moves: any[];
  volData: any[];
  theme: string;
  grid: string;
}

export default function FitnessScorePanel({
  oura,
  nutrition,
  sessions,
  strava,
  habits,
  habitLogs,
  moves,
  volData,
  theme,
  grid,
}: FitnessScorePanelProps) {

  const scores = useMemo(() => {
    // 1. Consistency (Regularność treningowa i nawykowa)
    const workouts7d = sessions.filter(s => s.date >= daysBefore(7)).length;
    const strava7d = strava.filter(a => a.start_date.slice(0, 10) >= daysBefore(7)).length;
    
    const habitLogs7d = habitLogs.filter(l => l.date >= daysBefore(7) && l.completed).length;
    const activeHabitsCount = habits.length || 1;
    const habitRate = habitLogs7d / (activeHabitsCount * 7);
    
    // Scale to 1-10
    const consistencyScore = Math.min(10, Math.max(1, parseFloat(((workouts7d + strava7d) * 1.5 + habitRate * 4).toFixed(1))));

    // 2. Endurance (Kardio/Wydolność)
    let aerobicPoints = 0;
    strava.filter(a => a.start_date.slice(0, 10) >= daysBefore(7)).forEach(a => {
      const distKm = (a.distance || 0) / 1000;
      if (a.sport_type === 'Run' || a.sport_type === 'TrailRun') {
        aerobicPoints += distKm * 0.4;
      } else if (a.sport_type === 'Ride' || a.sport_type === 'VirtualRide') {
        aerobicPoints += distKm * 0.1;
      } else {
        aerobicPoints += (a.moving_time || 0) / 60 * 0.05; // 0.05 points per minute of other activities
      }
    });
    const enduranceScore = Math.min(10, Math.max(0, parseFloat(aerobicPoints.toFixed(1))));

    // 3. Strength (Siła/Intensywność)
    const workouts14d = sessions.filter(s => s.date >= daysBefore(14));
    const totalMSP14d = workouts14d.reduce((sum, s) => {
      const logs = s.exercise_logs || [];
      const mspCount = logs.filter((l: any) => l.is_pws_or_msp).length;
      return sum + mspCount;
    }, 0);
    const avgRpe14d = workouts14d.length > 0 ? (workouts14d.reduce((sum, s) => sum + (s.session_rpe || 5), 0) / workouts14d.length) : 5;
    const strengthScore = Math.min(10, Math.max(1, parseFloat((totalMSP14d * 0.8 + avgRpe14d * 0.5).toFixed(1))));

    // 4. Habits (Nawyki/Wellness)
    const oura7d = oura.slice(-7);
    const avgSleepScore = oura7d.length > 0 ? (oura7d.reduce((sum, o) => sum + (o.score_sleep || 70), 0) / oura7d.length) : 75;
    const sleepPoints = (avgSleepScore - 50) / 5; // score of 80 is 6 points
    
    const nutr7d = nutrition.filter(n => n.date >= daysBefore(7));
    const proteinTargetMetRate = nutr7d.length > 0 ? (nutr7d.filter(n => n.protein >= 140).length / nutr7d.length) : 1;
    const nutritionPoints = proteinTargetMetRate * 4;
    const habitsScore = Math.min(10, Math.max(1, parseFloat((sleepPoints + nutritionPoints).toFixed(1))));

    // 5. Progress (Postęp/Aktywność)
    const completedMovesCount = (moves || []).filter(m => m.status === 'done' && (m.completed_at || '').slice(0, 10) >= daysBefore(14)).length;
    const oura14d = oura.slice(-14);
    const first7dHRV = oura14d.slice(0, 7).reduce((sum, o) => sum + (o.hrv_avg || 45), 0) / 7;
    const last7dHRV = oura14d.slice(-7).reduce((sum, o) => sum + (o.hrv_avg || 45), 0) / 7;
    const hrvTrend = last7dHRV >= first7dHRV ? 1.5 : -1;
    const progressScore = Math.min(10, Math.max(1, parseFloat((5 + completedMovesCount * 0.7 + hrvTrend).toFixed(1))));

    // 6. Volume (Objętość Mg)
    const currentWeekVolObj = volData[volData.length - 1];
    const currentWeekVolMg = currentWeekVolObj ? currentWeekVolObj.vol : 0;
    const volumeScore = Math.min(10, Math.max(1, parseFloat((currentWeekVolMg > 0 ? (currentWeekVolMg * 0.5) + 1 : 1).toFixed(1))));

    const sum = consistencyScore + enduranceScore + strengthScore + habitsScore + progressScore + volumeScore;
    const fitnessScore = Math.round((sum / 60) * 1000);

    return {
      consistency: consistencyScore,
      endurance: enduranceScore,
      strength: strengthScore,
      habits: habitsScore,
      progress: progressScore,
      volume: volumeScore,
      fitnessScore,
    };
  }, [oura, nutrition, sessions, strava, habits, habitLogs, moves, volData]);

  // SVG Radar Settings
  const cx = 160;
  const cy = 135;
  const r = 75;

  const labels = [
    { name: 'Endurance', key: 'endurance', align: 'start', xOff: 8, yOff: -3 },
    { name: 'Strength', key: 'strength', align: 'start', xOff: 10, yOff: 4 },
    { name: 'Habits', key: 'habits', align: 'start', xOff: 8, yOff: 10 },
    { name: 'Progress', key: 'progress', align: 'end', xOff: -8, yOff: 10 },
    { name: 'Volume', key: 'volume', align: 'end', xOff: -10, yOff: 4 },
    { name: 'Consistency', key: 'consistency', align: 'end', xOff: -8, yOff: -3 },
  ] as const;

  return (
    <Panel title="Hybrydowy Profil & Fitness Score">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-center p-2.5">
        
        {/* Left: Overall Score display */}
        <div className="flex flex-col items-center justify-center py-6 border-b md:border-b-0 md:border-r border-border-custom">
          <div className="flex items-center gap-1.5 mb-1.5 text-primary">
            <Activity size={15} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Fitness Score</span>
          </div>
          <p className="text-[60px] font-black italic tracking-tighter leading-none text-text-primary font-display drop-shadow-[0_4px_12px_rgba(79,70,229,0.15)]">
            {scores.fitnessScore}
          </p>
          <p className="text-[10px] font-bold text-text-muted mt-2 uppercase tracking-widest">
            Skala hybrydowa (0 - 1000)
          </p>
        </div>

        {/* Right: SVG Hexagon Radar Chart */}
        <div className="flex justify-center items-center">
          <svg width={320} height={260} className="overflow-visible">
            <defs>
              <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Concentric grid lines (scale 2, 4, 6, 8, 10) */}
            {[2, 4, 6, 8, 10].map(k => {
              const points = [0, 1, 2, 3, 4, 5].map(index => {
                const angle = (index * 60 - 60) * Math.PI / 180;
                const val = k / 10;
                return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
              }).join(' ');
              return (
                <polygon
                  key={k}
                  points={points}
                  fill="none"
                  stroke={grid}
                  strokeWidth="1"
                  strokeDasharray={k === 10 ? "none" : "2,3"}
                  className="opacity-70"
                />
              );
            })}

            {/* Axis lines */}
            {[0, 1, 2, 3, 4, 5].map(index => {
              const angle = (index * 60 - 60) * Math.PI / 180;
              const x = cx + r * Math.cos(angle);
              const y = cy + r * Math.sin(angle);
              return (
                <line
                  key={index}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke={grid}
                  strokeWidth="1"
                  className="opacity-50"
                />
              );
            })}

            {/* Value Polygon */}
            <polygon
              points={[0, 1, 2, 3, 4, 5].map(index => {
                const key = keys[index];
                const score = scores[key];
                const angle = (index * 60 - 60) * Math.PI / 180;
                const val = score / 10;
                return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
              }).join(' ')}
              fill="rgba(163, 230, 53, 0.08)"
              stroke="rgb(163, 230, 53)"
              strokeWidth="2"
              filter="url(#radar-glow)"
            />

            {/* Value dots */}
            {[0, 1, 2, 3, 4, 5].map(index => {
              const key = keys[index];
              const score = scores[key];
              const angle = (index * 60 - 60) * Math.PI / 180;
              const val = score / 10;
              const x = cx + r * val * Math.cos(angle);
              const y = cy + r * val * Math.sin(angle);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="rgb(163, 230, 53)"
                  stroke={theme === 'dark' ? '#000' : '#fff'}
                  strokeWidth="1"
                />
              );
            })}

            {/* Labels and values */}
            {labels.map((lbl, index) => {
              const angle = (index * 60 - 60) * Math.PI / 180;
              const score = scores[lbl.key];
              const x = cx + (r + 12) * Math.cos(angle) + lbl.xOff;
              const y = cy + (r + 12) * Math.sin(angle) + lbl.yOff;
              return (
                <g key={index}>
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
                    y={y + 11}
                    textAnchor={lbl.align}
                    className="text-[10px] font-black italic fill-primary font-display"
                  >
                    {score.toFixed(1)}<tspan className="text-[8px] font-normal fill-text-muted not-italic">/10</tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

      </div>
    </Panel>
  );
}

const keys = ['endurance', 'strength', 'habits', 'progress', 'volume', 'consistency'] as const;
