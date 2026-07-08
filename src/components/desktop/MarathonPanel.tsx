import React from 'react';
import { differenceInDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RACE_DATE, C, weeklyRunKm, avg } from './desktopUtils';
import { Panel, Tip } from './Panel';

export interface MarathonPanelProps {
  strava: any[];
  grid: string;
  tick: string;
  marathon?: {
    name: string;
    date: string;
    target_time?: any;
    status: string;
  } | null;
}

function formatInterval(t: any): string | null {
  if (!t) return null;
  if (typeof t === 'string') {
    const parts = t.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      return `${h}h ${m}m`;
    }
    return t;
  }
  if (typeof t === 'object') {
    const h = t.hours || 0;
    const m = t.minutes || 0;
    return `${h}h ${m}m`;
  }
  return null;
}

export default function MarathonPanel({ strava, grid, tick, marathon }: MarathonPanelProps) {
  const raceDate = marathon?.date ? new Date(marathon.date + 'T00:00:00') : RACE_DATE;
  const raceName = marathon?.name || "Maraton Gdańsk";
  const targetTime = formatInterval(marathon?.target_time);

  const daysLeft = differenceInDays(raceDate, new Date());
  const weeksLeft = Math.ceil(daysLeft / 7);
  const kmData = weeklyRunKm(strava);
  const recent4 = kmData.slice(-4);
  const avgKm = recent4.length ? Math.round((avg(recent4.map(w => w.km)) ?? 0) * 10) / 10 : null;
  const bestKm = kmData.length ? Math.max(...kmData.map(w => w.km)) : null;

  const formattedDate = marathon?.date
    ? new Date(marathon.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '04.10.2026';

  return (
    <Panel title={`${raceName} — ${formattedDate}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-display text-[40px] font-black leading-none text-text-primary">
            {daysLeft >= 0 ? daysLeft : 0}
          </p>
          <p className="text-[10px] font-bold text-text-muted mt-1">
            {daysLeft >= 0 ? `dni do startu · ${weeksLeft} tygodni` : 'Wydarzenie zakończone'}
          </p>
          {targetTime && (
            <div className="mt-2.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Cel czasowy</p>
              <p className="font-display text-[15px] font-black text-amber-500 leading-none mt-0.5">
                {targetTime}
              </p>
            </div>
          )}
        </div>
        <div className="text-right space-y-2">
          {avgKm !== null && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Avg 4 tygodnie</p>
              <p className="font-display text-[22px] font-black text-amber-500 leading-none">
                {avgKm} <span className="text-[11px] text-text-muted">km/tyg</span>
              </p>
            </div>
          )}
          {bestKm !== null && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Rekord tyg.</p>
              <p className="font-display text-[18px] font-black text-text-primary leading-none">
                {bestKm} <span className="text-[11px] text-text-muted">km</span>
              </p>
            </div>
          )}
        </div>
      </div>
      {kmData.length > 1 ? (
        <ResponsiveContainer width="100%" height={140} minWidth={0} minHeight={0}>
          <AreaChart data={kmData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="gRun" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.amber} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} />
            <XAxis dataKey="week" tick={{ fontSize: 9, fill: tick }} />
            <YAxis tick={{ fontSize: 9, fill: tick }} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="km" name="km" stroke={C.amber} fill="url(#gRun)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-24 text-[11px] text-text-muted">
          Brak danych — zsynchronizuj Stravę
        </div>
      )}
    </Panel>
  );
}
