import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPln, formatPct } from '../../lib/finance/formatMoney';
import type { MonteCarloResult } from '@vanguard/domain';
import { FinanceSection } from './financeUi';

interface MonteCarloPanelProps {
  result: MonteCarloResult;
  fireTarget: number;
}

export function MonteCarloPanel({ result, fireTarget }: MonteCarloPanelProps) {
  const chartData = useMemo(
    () => result.yearlyMedian.map((_, i) => ({
      year: i,
      p10: Math.round(result.yearlyP10[i] ?? 0),
      p50: Math.round(result.yearlyMedian[i] ?? 0),
      p90: Math.round(result.yearlyP90[i] ?? 0),
      fire: fireTarget,
    })),
    [result, fireTarget],
  );

  const probColor = result.successProbability >= 0.75 ? 'text-success' : result.successProbability >= 0.5 ? 'text-warning' : 'text-danger';

  return (
    <FinanceSection title="Monte Carlo" subtitle="400 symulacji · rynek bywa kapryśny">
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
        <div>
          {result.medianYearsToFire != null && (
            <p className="text-sm text-text-secondary">
              Mediana: <span className="font-medium text-text-primary">{result.medianYearsToFire.toFixed(1)} lat</span>
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-3xl font-semibold tabular-nums tracking-[-0.03em] ${probColor}`}>
            {formatPct(result.successProbability * 100)}
          </p>
          <p className="text-xs text-text-muted">szans na cel</p>
        </div>
      </div>
      <div className="h-56 w-full px-2 pb-4 pt-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={chartData.slice(0, 31)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" opacity={0.5} />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'lat', position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={36} />
            <Tooltip formatter={(v) => formatPln(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="p10" name="P10" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.05} strokeWidth={1} />
            <Area type="monotone" dataKey="p50" name="Mediana" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="p90" name="P90" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.05} strokeWidth={1} />
            <Line type="monotone" dataKey="fire" name="FIRE" stroke="var(--color-warning)" strokeDasharray="4 4" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </FinanceSection>
  );
}
