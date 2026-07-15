import { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';

interface ExerciseLog {
  exercise_name: string;
  weight: number | string | null;
  reps: number | string | null;
  muscle_tags?: string[];
}

interface SessionItem {
  id: string;
  date: string | null;
  workout_day: string | null;
  session_rpe: number | null;
  exercise_logs: ExerciseLog[];
}

interface HeatmapCellData {
  vol: number;
  wellness: boolean;
  name: string | null;
  exercises: string[];
  rpe: number | null;
}

interface HeatmapDay {
  date: string;
  future: boolean;
  data: HeatmapCellData | null;
}

interface StravaActivity {
  sport_type: string | null;
  distance: number | null;
  start_date: string | null;
}

interface HeatmapProps {
  sessions: SessionItem[];
  strava: StravaActivity[];
}

import { isLogWellness, sessionVol } from '../../biometrics/workout/workoutUtils';

export default function Heatmap({ sessions, strava = [] }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    day: HeatmapDay;
    kmRun: number;
    rect: DOMRect;
  } | null>(null);

  const todayStr = getTodayWarsaw();

  const dateMap: Record<string, HeatmapCellData> = {};
  for (const s of sessions) {
    if (!s.date) continue;
    const vol = sessionVol(s);
    const wellness = (s.exercise_logs || []).length > 0 && (s.exercise_logs || []).every(l => isLogWellness(l));
    const exercises = [...new Set((s.exercise_logs || []).map(l => l.exercise_name))].slice(0, 3);
    dateMap[s.date] = { vol, wellness, name: s.workout_day, exercises, rpe: s.session_rpe };
  }

  const runMap: Record<string, number> = {};
  for (const a of strava) {
    if (!a.sport_type || !a.start_date || !a.distance) continue;
    if (!['Run', 'TrailRun', 'VirtualRun'].includes(a.sport_type)) continue;
    const d = a.start_date.slice(0, 10);
    runMap[d] = (runMap[d] || 0) + (Number(a.distance) || 0) / 1000;
  }

  const dow = new Date(todayStr + 'T12:00:00Z').getUTCDay();
  const offsetToMonday = -(dow === 0 ? 6 : dow - 1);
  const mondayStr = shiftDateStr(todayStr, offsetToMonday);
  const startStr = shiftDateStr(mondayStr, -12 * 7);

  const weeks: HeatmapDay[][] = [];
  let currentStr = startStr;
  while (weeks.length < 13) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: currentStr, future: currentStr > todayStr, data: dateMap[currentStr] || null });
      currentStr = shiftDateStr(currentStr, 1);
    }
    weeks.push(week);
  }

  const cellColor = ({ future, date, data }: HeatmapDay) => {
    if (future) return 'bg-transparent border border-border-custom/20';
    const hasRun = !!runMap[date];
    const hasGym = !!data;
    if (!hasRun && !hasGym) return 'bg-border-custom';
    if (data?.wellness && !hasRun) return 'bg-info/50';
    if (hasRun && !hasGym) {
      const km = runMap[date];
      if (km < 5)  return 'bg-warning/40';
      if (km < 12) return 'bg-warning/60';
      return 'bg-warning/80';
    }
    // both gym + run
    if (hasRun && hasGym) return 'bg-primary/70';
    const v = data!.vol;
    if (v < 3000)  return 'bg-primary/30';
    if (v < 8000)  return 'bg-primary/55';
    if (v < 15000) return 'bg-primary/80';
    return 'bg-primary';
  };

  const DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

  return (
    <div>
      <div className="flex gap-1.5 items-start">
        <div className="flex flex-col gap-[var(--ds-arbitrary-5px-coll-2)] pt-7 mr-1">
          {DAYS.map(d => <div key={d} className="text-2xs text-text-muted w-4 h-3.5 flex items-center">{d}</div>)}
        </div>
        <div className="flex gap-1 flex-1 overflow-hidden">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[var(--ds-arbitrary-5px-coll-2)] flex-1">
              <div className="text-2xs text-text-muted h-6 flex items-end pb-0.5">
                {wi % 3 === 0 ? format(parseISO(week[0].date), 'dd.MM') : ''}
              </div>
              {week.map((day, di) => {
                const hasActivity = !!day.data || !!runMap[day.date];
                return (
                  <div
                    key={di}
                    className={`h-3.5 rounded-sm transition-opacity ${hasActivity ? 'cursor-pointer hover:opacity-[var(--opacity-70)]' : 'cursor-default'} ${cellColor({ ...day, date: day.date })}`}
                    onMouseEnter={hasActivity ? (e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ day, kmRun: runMap[day.date] || 0, rect });
                    } : undefined}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: Math.min(tooltip.rect.right + 10, window.innerWidth - 190),
            top: Math.max(8, tooltip.rect.top - 36),
            zIndex: 'var(--ds-inline-style-9999)',
            pointerEvents: 'none',
          }}
          className="rounded-[var(--radius-md)] border border-border-custom bg-surface shadow-xl px-3.5 py-2.5 min-w-[var(--ds-w-160px)]"
        >
          <p className="text-2xs font-black text-text-muted mb-1">{tooltip.day.date}</p>
          {tooltip.kmRun > 0 && (
            <p className="text-xs font-bold text-warning mt-0.5">{tooltip.kmRun.toFixed(1)} km biegu</p>
          )}
          {tooltip.day.data && (
            <>
              {tooltip.day.data.name && <p className="text-sm font-black text-text-primary leading-tight">{tooltip.day.data.name}</p>}
              {tooltip.day.data.wellness ? (
                <p className="text-xs text-info font-bold mt-0.5">Wellness</p>
              ) : (
                <>
                  {tooltip.day.data.vol > 0 && <p className="text-xs font-bold text-primary mt-0.5">{(tooltip.day.data.vol / 1000).toFixed(1)} Mg</p>}
                  {tooltip.day.data.rpe && <p className="text-2xs text-text-muted mt-0.5">RPE <span className="font-black">{tooltip.day.data.rpe}</span></p>}
                </>
              )}
              {tooltip.day.data.exercises?.length > 0 && (
                <p className="text-2xs text-text-muted mt-1 leading-relaxed">{tooltip.day.data.exercises.join(' · ')}</p>
              )}
            </>
          )}
        </div>,
        document.body
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-custom">
        <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Legenda:</span>
        {[
          { color: 'bg-border-custom',  label: 'Odpoczynek' },
          { color: 'bg-info/50',    label: 'Wellness' },
          { color: 'bg-warning/40',   label: 'Bieg <5km' },
          { color: 'bg-warning/60',   label: 'Bieg 5-12km' },
          { color: 'bg-warning/80',   label: 'Bieg >12km' },
          { color: 'bg-primary/30',  label: '<3 Mg' },
          { color: 'bg-primary/55',  label: '3–8 Mg' },
          { color: 'bg-primary/80',  label: '8–15 Mg' },
          { color: 'bg-primary',     label: '>15 Mg' },
          { color: 'bg-primary/70',  label: 'Bieg+Siłownia' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-2xs text-text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
