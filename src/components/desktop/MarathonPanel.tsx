import React from 'react';
import { differenceInDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RACE_DATE, C, weeklyRunKm, avg } from './desktopUtils';
import { Panel, Tip } from './Panel';
import { nowWarsaw } from '../../lib/date';

export interface MarathonPanelProps {
  strava: any[];
  grid: string;
  tick: string;
}

export default function MarathonPanel({ strava, grid, tick }: MarathonPanelProps) {
  const daysLeft = differenceInDays(RACE_DATE, nowWarsaw());
  const weeksLeft = Math.ceil(daysLeft / 7);
  const kmData = weeklyRunKm(strava);
  const recent4 = kmData.slice(-4);
  const avgKm = recent4.length ? Math.round((avg(recent4.map(w => w.km)) ?? 0) * 10) / 10 : null;
  const bestKm = kmData.length ? Math.max(...kmData.map(w => w.km)) : null;

  return (
    <Panel title="Maraton Gdańsk — 04.10.2026">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="font-display text-[40px] font-black leading-none text-text-primary">{daysLeft}</p>
          <p className="text-[10px] font-bold text-text-muted mt-1">dni do startu · {weeksLeft} tygodni</p>
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
        <ResponsiveContainer width="100%" height={140}>
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
