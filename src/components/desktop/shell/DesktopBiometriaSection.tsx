import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Panel, Tip } from './Panel';
import { C } from '../desktopUtils';

interface DesktopBiometriaSectionProps {
  sleepData: Record<string, unknown>[];
  volData: Record<string, unknown>[];
  nutrData: Record<string, unknown>[];
  grid: string;
  tick: string;
}

export default function DesktopBiometriaSection({
  sleepData, volData, nutrData, grid, tick,
}: DesktopBiometriaSectionProps) {
  return (
    <section id="biometria" className="scroll-mt-28 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="pixel-label">Biometria & paliwo</span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>
      <div className="grid grid-cols-3 gap-5">
        <Panel title="Sen & HRV — 14 dni">
          <ResponsiveContainer width="100%" height={190} minWidth={0} minHeight={0}>
            <LineChart data={sleepData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={2} />
              <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} domain={[4, 10]} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} domain={[20, 100]} />
              <Tooltip content={<Tip />} />
              <Line yAxisId="l" type="monotone" dataKey="Sen" stroke={C.indigo}  strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="r" type="monotone" dataKey="HRV" stroke={C.emerald} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-2xs text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.indigo }} /> Sen (h)</span>
            <span className="flex items-center gap-1.5 text-2xs text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.emerald }} /> HRV (ms)</span>
          </div>
        </Panel>

        <Panel title="Objętość treningowa — 10 tygodni (Mg)">
          <ResponsiveContainer width="100%" height={190} minWidth={0} minHeight={0}>
            <BarChart data={volData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: tick }} />
              <YAxis tick={{ fontSize: 9, fill: tick }} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="vol" name="Mg" fill={C.amber} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Żywienie — 14 dni">
          <ResponsiveContainer width="100%" height={190} minWidth={0} minHeight={0}>
            <AreaChart data={nutrData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.rose} stopOpacity={0.25}/><stop offset="95%" stopColor={C.rose} stopOpacity={0}/></linearGradient>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.sky}  stopOpacity={0.25}/><stop offset="95%" stopColor={C.sky}  stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={2} />
              <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} domain={[0, 250]} />
              <Tooltip content={<Tip />} />
              <Area yAxisId="l" type="monotone" dataKey="Kcal"   stroke={C.rose} fill="url(#gK)" strokeWidth={2} dot={false} />
              <Area yAxisId="r" type="monotone" dataKey="Białko" stroke={C.sky}  fill="url(#gP)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-2xs text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.rose }} /> Kcal</span>
            <span className="flex items-center gap-1.5 text-2xs text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.sky  }} /> Białko (g)</span>
          </div>
        </Panel>
      </div>
    </section>
  );
}
