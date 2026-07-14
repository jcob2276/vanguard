import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Panel, Tip } from '../../shell/Panel';
import { C } from '../../desktopUtils';
import ScoreBar from './ScoreBar';

const READINESS_COLOR: Record<string, string> = {
  primed: 'var(--color-success)',
  balanced: 'var(--color-info)',
  strained: 'var(--color-warning)',
  rundown: 'var(--color-danger)',
  insufficient: 'var(--text-muted)',
};

import { TimelineItem } from './generalViewUtils';

interface ChartProps {
  timelineData: TimelineItem[];
  tick: string;
}

function VitalBandsChart({ timelineData, tick }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={190} minWidth={0} minHeight={0}>
      <LineChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
        <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={9} />
        <YAxis domain={[-3, 3]} tick={{ fontSize: 9, fill: tick }} />
        <Tooltip content={<Tip />} />
        <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeOpacity={0.3} />
        <ReferenceLine y={1} stroke={C.emerald} strokeDasharray="3 3" strokeOpacity={0.4} />
        <ReferenceLine y={-1} stroke={C.amber} strokeDasharray="3 3" strokeOpacity={0.4} />
        <ReferenceLine y={-2} stroke={C.rose} strokeDasharray="3 3" strokeOpacity={0.4} />
        <Line type="monotone" dataKey="hrv_z" stroke={C.emerald} strokeWidth={1.5} dot={false} connectNulls name="HRV z" />
        <Line type="monotone" dataKey="rhr_z" stroke={C.indigo} strokeWidth={1.5} dot={false} connectNulls name="RHR z" />
        <Line type="monotone" dataKey="sleep_z" stroke={C.sky} strokeWidth={1.5} dot={false} connectNulls name="Sleep z" />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface SleepChartItem {
  d: string;
  value: number | null;
}

function SleepScoreChart({
  sleepChartData,
  sleepUsesHours,
  tick,
}: {
  sleepChartData: SleepChartItem[];
  sleepUsesHours: boolean;
  tick: string;
}) {
  return sleepChartData.length === 0 ? (
    <p className="text-xs text-text-muted py-8 text-center">Brak danych Oura — uruchom sync (S)</p>
  ) : (
    <ResponsiveContainer width="100%" height={190} minWidth={0} minHeight={0}>
      <AreaChart data={sleepChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gSleep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={C.indigo} stopOpacity={0.4} />
            <stop offset="95%" stopColor={C.indigo} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
        <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={9} />
        <YAxis domain={sleepUsesHours ? [4, 10] : [40, 100]} tick={{ fontSize: 9, fill: tick }} />
        <Tooltip content={<Tip />} />
        {!sleepUsesHours && <ReferenceLine y={80} stroke={C.emerald} strokeDasharray="4 4" strokeOpacity={0.4} />}
        <Area type="monotone" dataKey="value" stroke={C.indigo} fill="url(#gSleep)" strokeWidth={2} dot={false} connectNulls name={sleepUsesHours ? 'Sen (h)' : 'Sleep score'} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface SleepHrvCorrItem {
  sleep: number | null;
  hrvNext: number | null;
}

function SleepHrvScatterChart({
  sleepHrvCorr,
  tick,
}: {
  sleepHrvCorr: SleepHrvCorrItem[];
  tick: string;
}) {
  return sleepHrvCorr.length === 0 ? (
    <p className="text-xs text-text-muted py-8 text-center">Za mało par sen/HRV (min. 2 dni Oura)</p>
  ) : (
    <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
      <ScatterChart data={sleepHrvCorr} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
        <XAxis dataKey="sleep" name="Sen (h)" type="number" tick={{ fontSize: 9, fill: tick }} domain={['auto', 'auto']} label={{ value: 'Sen (h)', position: 'insideBottom', offset: -2, fontSize: 9, fill: tick }} />
        <YAxis dataKey="hrvNext" name="HRV next" type="number" tick={{ fontSize: 9, fill: tick }} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<Tip />} />
        <Scatter data={sleepHrvCorr} fill={C.emerald} fillOpacity={0.6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function HrvRhrChart({ timelineData, tick }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
      <LineChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
        <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={9} />
        <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} />
        <Tooltip content={<Tip />} />
        <Line yAxisId="l" type="monotone" dataKey="hrv" stroke={C.emerald} strokeWidth={2} dot={false} connectNulls name="HRV" />
        <Line yAxisId="r" type="monotone" dataKey="rhr" stroke={C.rose} strokeWidth={2} dot={false} connectNulls name="RHR" />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface GeneralHealthChartsProps {
  timelineData: TimelineItem[];
  sleepChartData: SleepChartItem[];
  sleepUsesHours: boolean;
  sleepHrvCorr: SleepHrvCorrItem[];
  readinessCounts: Record<string, number>;
  strainLength: number;
  tick: string;
}

export default function GeneralHealthCharts({
  timelineData,
  sleepChartData,
  sleepUsesHours,
  sleepHrvCorr,
  readinessCounts,
  strainLength,
  tick,
}: GeneralHealthChartsProps) {
  return (
    <div className="space-y-5">
      {/* Recovery + Strain timeline */}
      <Panel title="Recovery & Strain — 90 dni">
        <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
          <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gRecovery" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.emerald} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gStrain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.rose} stopOpacity={0.2} />
                <stop offset="95%" stopColor={C.rose} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
            <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={6} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: tick }} />
            <Tooltip content={<Tip />} />
            <ReferenceLine y={70} stroke={C.emerald} strokeDasharray="4 4" strokeOpacity={0.4} />
            <ReferenceLine y={40} stroke={C.rose} strokeDasharray="4 4" strokeOpacity={0.4} />
            <Area type="monotone" dataKey="recovery" stroke={C.emerald} fill="url(#gRecovery)" strokeWidth={2} dot={false} connectNulls />
            <Area type="monotone" dataKey="strain" stroke={C.rose} fill="url(#gStrain)" strokeWidth={1.5} dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span><span className="inline-block w-2 h-2 rounded-full bg-success mr-1" />Recovery</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-danger mr-1" />Strain</span>
          <span className="ml-auto opacity-[var(--opacity-60)]">linia: 70 (dobry recovery) / 40 (niski)</span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* VitalBands z-scores */}
        <Panel title="VitalBands z-scores — 90 dni">
          <VitalBandsChart timelineData={timelineData} tick={tick} />
          <div className="flex gap-3 mt-1 text-xs text-text-muted">
            <span><span className="text-success">●</span> HRV z</span>
            <span><span className="text-primary">●</span> RHR z</span>
            <span><span className="text-info">●</span> Sleep z</span>
          </div>
        </Panel>

        {/* Sleep score */}
        <Panel title={sleepUsesHours ? 'Sen — 90 dni (h)' : 'Sleep score — 90 dni'}>
          <SleepScoreChart sleepChartData={sleepChartData} sleepUsesHours={sleepUsesHours} tick={tick} />
        </Panel>

        {/* Readiness distribution */}
        <Panel title="Readiness — rozkład">
          <div className="space-y-2.5 mt-2">
            {(['primed', 'balanced', 'strained', 'rundown', 'insufficient'] as const).map((level) => {
              const count = readinessCounts[level] || 0;
              const total = strainLength || 1;
              const pct = Math.round((count / total) * 100);
              const labels: Record<string, string> = {
                primed: '⚡ Gotowy',
                balanced: '✓ Zbalansowany',
                strained: '⚠ Zmęczony',
                rundown: '↓ Wyczerpany',
                insufficient: '– Brak danych',
              };
              return (
                <div key={level}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-text-secondary" style={{ color: READINESS_COLOR[level] }}>{labels[level]}</span>
                    <span className="text-text-muted">{count}d · {pct}%</span>
                  </div>
                  <ScoreBar value={pct} color={READINESS_COLOR[level]} />
                </div>
              );
            })}
          </div>
          <p className="text-2xs text-text-muted mt-3">Łącznie: {strainLength} dni z danymi</p>
        </Panel>
      </div>

      {/* Korelacja: sen → HRV następnego dnia */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Panel title="Korelacja: długość snu → HRV następnego dnia">
          <SleepHrvScatterChart sleepHrvCorr={sleepHrvCorr} tick={tick} />
          <p className="text-xs text-text-muted mt-1">Każdy punkt = jeden dzień. Więcej snu → wyższe HRV jutro?</p>
        </Panel>

        {/* HRV raw */}
        <Panel title="HRV & RHR — 90 dni">
          <HrvRhrChart timelineData={timelineData} tick={tick} />
          <div className="flex gap-4 mt-1 text-xs text-text-muted">
            <span><span className="text-success">●</span> HRV (L)</span>
            <span><span className="text-danger">●</span> RHR (R)</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
