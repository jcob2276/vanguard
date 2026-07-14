import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info, RefreshCw, ChevronDown, ChevronUp, Moon, Apple, Award, Zap, Target, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { fetchSystemHealthData } from '../../../lib/systemApi';
import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import { Card } from '../../ui/Card';

export default function SystemHealth({ userId }: { userId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const healthQuery = useQuery({
    queryKey: ['system-health', userId],
    queryFn: () => fetchSystemHealthData(userId),
    enabled: !!userId,
  });

  const events = healthQuery.data?.events ?? [];
  const coverage = healthQuery.data?.coverage ?? null;
  const loading = healthQuery.isLoading;

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical':
      case 'error':
        return <AlertOctagon className="text-danger shrink-0" size={16} />;
      case 'warning':
        return <AlertTriangle className="text-warning shrink-0" size={16} />;
      default:
        return <Info className="text-info shrink-0" size={16} />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <span className="bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">CRITICAL</span>;
      case 'error':
        return <span className="bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">ERROR</span>;
      case 'warning':
        return <span className="bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">WARNING</span>;
      default:
        return <span className="bg-info/10 text-info border border-info/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">INFO</span>;
    }
  };

  const renderCoverageCard = (
    title: string,
    val30: number | undefined,
    val90: number | undefined,
    icon: React.ReactNode,
    colorClass: string
  ) => {
    const pct30 = val30 != null ? Math.round(val30 * 100) : 0;
    const pct90 = val90 != null ? Math.round(val90 * 100) : 0;

    const getStatusColor = (v: number) => {
      if (v >= 85) return 'text-success dark:text-success';
      if (v >= 60) return 'text-warning dark:text-warning';
      return 'text-danger';
    };

    const getBarColor = (v: number) => {
      if (v >= 85) return 'bg-success dark:bg-success';
      if (v >= 60) return 'bg-warning dark:bg-warning';
      return 'bg-danger';
    };

    return (
      <Card padding="1rem" className="space-y-3.5 transition-all duration-150 hover:border-border-custom hover:shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-black text-text-secondary">{title}</span>
          <div className={`${colorClass} opacity-80`}>{icon}</div>
        </div>

        <div className="space-y-2">
          {/* 30 Days */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-text-muted">30 dni</span>
              <span className={getStatusColor(pct30)}>{pct30}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
              <div className={`h-full ${getBarColor(pct30)} transition-all duration-500`} style={{ width: `${pct30}%` }} />
            </div>
          </div>

          {/* 90 Days */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-text-muted">90 dni</span>
              <span className={getStatusColor(pct90)}>{pct90}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
              <div className={`h-full ${getBarColor(pct90)} transition-all duration-500`} style={{ width: `${pct90}%` }} />
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-[800px] mx-auto p-5 pb-20 animate-fade-in">
      {/* Diagnostics / Coverage */}
      {coverage && (
        <div className="space-y-3.5">
          <div>
            <h2 className="text-[15px] font-black text-text-primary flex items-center gap-2">
              <Zap className="text-warning fill-warning/20" size={18} />
              Pokrycie Danych (Logging Hygiene)
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">Kompletność danych wejściowych w oknach czasowych 30 i 90 dni.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderCoverageCard('Oura summary', coverage.oura_30, coverage.oura_90, <Moon size={16} />, 'text-primary')}
            {renderCoverageCard('Odżywianie', coverage.nutrition_30, coverage.nutrition_90, <Apple size={16} />, 'text-success')}
            {renderCoverageCard('Dziennik / Wins', coverage.wins_30, coverage.wins_90, <Award size={16} />, 'text-warning')}
            {renderCoverageCard('Higiena ogólna', coverage.overall_30, coverage.overall_90, <Zap size={16} />, 'text-danger')}
          </div>
        </div>
      )}

      <div className="h-px bg-border-custom/60" />

      {/* Prediction Calibration */}
      {healthQuery.data && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[15px] font-black text-text-primary flex items-center gap-2">
              <Target className="text-primary" size={18} />
              Kalibracja Modelu (Prediction Accuracy)
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Średni błąd bezwzględny (MAE) prognoz parametrów dobowych (łącznie {healthQuery.data.calibrationSummary.total_resolved} prognoz).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card padding="1rem" className="flex flex-col justify-between space-y-1.5 transition-all duration-150 hover:border-border-custom hover:shadow-lg">
              <span className="text-[9.5px] font-black text-text-muted uppercase tracking-wider">Błąd Snu</span>
              <span className="text-[18px] font-black text-primary">
                {healthQuery.data.calibrationSummary.sleep_mae !== null
                  ? `±${healthQuery.data.calibrationSummary.sleep_mae} h`
                  : 'brak'}
              </span>
              <span className="text-[9px] text-text-muted leading-snug">Średni błąd (MAE) snu</span>
            </Card>

            <Card padding="1rem" className="flex flex-col justify-between space-y-1.5 transition-all duration-150 hover:border-border-custom hover:shadow-lg">
              <span className="text-[9.5px] font-black text-text-muted uppercase tracking-wider">Błąd Gotowości</span>
              <span className="text-[18px] font-black text-primary">
                {healthQuery.data.calibrationSummary.readiness_mae !== null
                  ? `±${healthQuery.data.calibrationSummary.readiness_mae} pkt`
                  : 'brak'}
              </span>
              <span className="text-[9px] text-text-muted leading-snug">Średni błąd (MAE) gotowości</span>
            </Card>

            <Card padding="1rem" className="flex flex-col justify-between space-y-1.5 transition-all duration-150 hover:border-border-custom hover:shadow-lg">
              <span className="text-[9.5px] font-black text-text-muted uppercase tracking-wider">Błąd Wykonania</span>
              <span className="text-[18px] font-black text-primary">
                {healthQuery.data.calibrationSummary.execution_mae !== null
                  ? `±${healthQuery.data.calibrationSummary.execution_mae}%`
                  : 'brak'}
              </span>
              <span className="text-[9px] text-text-muted leading-snug">Średni błąd (MAE) zadań</span>
            </Card>
          </div>

          {healthQuery.data.calibrationHistory.length > 0 && (
            <div className="bg-surface border border-border-custom/50 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-text-secondary uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp size={12} className="text-success" />
                  Trend błędu predykcji
                </span>
                <span className="text-[9px] text-text-muted">Chronologicznie</span>
              </div>
              <div className="h-[200px] w-full text-[10px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={healthQuery.data.calibrationHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-white/[0.04]" />
                    <XAxis dataKey="date" stroke="currentColor" className="text-text-muted" fontSize={9} tickLine={false} />
                    <YAxis stroke="currentColor" className="text-text-muted" fontSize={9} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-bg-surface, #1e293b)',
                        borderColor: 'var(--color-border-custom, #334155)',
                        fontSize: '11px',
                        borderRadius: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line type="monotone" name="Błąd Snu (h)" dataKey="sleep_error" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                    <Line type="monotone" name="Błąd Gotowości" dataKey="readiness_error" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                    <Line type="monotone" name="Błąd Wykonania (%)" dataKey="execution_error" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="h-px bg-border-custom/60" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-black text-text-primary flex items-center gap-2">
            <ShieldCheck className="text-primary" size={18} />
            Dziennik Audytu (System Logs)
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">Ostatnie 50 zarejestrowanych operacji, błędów i potoków synchronizacji.</p>
        </div>
        <Button
          onClick={() => void healthQuery.refetch()}
          variant="secondary"
          icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />}
          className="rounded-xl px-3.5 py-2 text-[11px]"
        >
          Odśwież
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <Spinner size="md" />
          <p className="text-[12px] font-bold mt-2">Ładowanie zdarzeń audytowych...</p>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border-custom/60 rounded-2xl bg-surface/20">
          <ShieldCheck className="mx-auto mb-2 text-success" size={32} />
          <p className="text-[12px] font-bold text-text-primary">System w pełni zdrowy!</p>
          <p className="text-[10px] text-text-muted mt-1">Brak zapisanych zdarzeń w dzienniku audytu.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-2.5">
          {events.map((ev) => {
            const isExpanded = expandedId === ev.id;
            const hasMeta = ev.metadata && Object.keys(ev.metadata).length > 0;
            return (
              <div
                key={ev.id}
                className="bg-surface border border-border-custom/50 rounded-2xl overflow-hidden transition-all duration-150"
              >
                {/* Header Row */}
                <div
                  onClick={() => hasMeta && setExpandedId(isExpanded ? null : ev.id)}
                  className={`p-4 flex items-start justify-between gap-3 cursor-pointer ${
                    hasMeta ? 'hover:bg-slate-50 dark:hover:bg-white/[0.015]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {getSeverityIcon(ev.severity)}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black text-text-primary px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04]">
                          {ev.event_type}
                        </span>
                        {getSeverityBadge(ev.severity)}
                        <span className="text-[10px] text-text-muted font-medium">
                          {new Date(ev.created_at).toLocaleString('pl-PL')}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-text-secondary font-medium leading-relaxed">
                        {ev.message || '—'}
                      </p>
                      {ev.related_table && (
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                          Tabela: {ev.related_table} {ev.related_id ? `(${ev.related_id})` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {hasMeta && (
                    <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/[0.04] text-text-muted">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  )}
                </div>

                {/* Metadata JSON Drawer */}
                {isExpanded && hasMeta && (
                  <div className="border-t border-border-custom/40 bg-slate-950/20 px-4 py-3 text-[11px] font-mono overflow-x-auto text-text-secondary select-text">
                    <pre className="whitespace-pre">{JSON.stringify(ev.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
