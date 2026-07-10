import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info, RefreshCw, ChevronDown, ChevronUp, Moon, Apple, Award, Zap } from 'lucide-react';
import { notify } from '../../../lib/notify';
import { fetchSystemHealthData, type AuditEvent, type DataCoverage } from '../../../lib/systemApi';

export default function SystemHealth({ userId }: { userId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [coverage, setCoverage] = useState<DataCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSystemHealthData(userId);
      setEvents(data.events);
      setCoverage(data.coverage);
    } catch (err: unknown) {
      console.error('[Health Error]', err);
      notify('Nie udało się pobrać danych diagnostycznych systemu', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void (async () => { await fetchLogs(); })();
  }, [fetchLogs]);

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical':
      case 'error':
        return <AlertOctagon className="text-rose-500 shrink-0" size={16} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500 shrink-0" size={16} />;
      default:
        return <Info className="text-sky-400 shrink-0" size={16} />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">CRITICAL</span>;
      case 'error':
        return <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">ERROR</span>;
      case 'warning':
        return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">WARNING</span>;
      default:
        return <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">INFO</span>;
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
      if (v >= 85) return 'text-emerald-500 dark:text-emerald-400';
      if (v >= 60) return 'text-amber-500 dark:text-amber-400';
      return 'text-rose-500';
    };

    const getBarColor = (v: number) => {
      if (v >= 85) return 'bg-emerald-500 dark:bg-emerald-400';
      if (v >= 60) return 'bg-amber-500 dark:bg-amber-400';
      return 'bg-rose-500';
    };

    return (
      <div className="bg-surface border border-border-custom/50 rounded-2xl p-4 space-y-3.5 transition-all duration-150 hover:border-border-custom hover:shadow-lg">
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
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[800px] mx-auto p-5 pb-20 animate-fade-in">
      {/* Diagnostics / Coverage */}
      {coverage && (
        <div className="space-y-3.5">
          <div>
            <h2 className="text-[15px] font-black text-text-primary flex items-center gap-2">
              <Zap className="text-amber-400 fill-amber-400/20" size={18} />
              Pokrycie Danych (Logging Hygiene)
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">Kompletność danych wejściowych w oknach czasowych 30 i 90 dni.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderCoverageCard('Oura summary', coverage.oura_30, coverage.oura_90, <Moon size={16} />, 'text-indigo-400')}
            {renderCoverageCard('Odżywianie', coverage.nutrition_30, coverage.nutrition_90, <Apple size={16} />, 'text-emerald-400')}
            {renderCoverageCard('Dziennik / Wins', coverage.wins_30, coverage.wins_90, <Award size={16} />, 'text-amber-400')}
            {renderCoverageCard('Higiena ogólna', coverage.overall_30, coverage.overall_90, <Zap size={16} />, 'text-rose-400')}
          </div>
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
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="btn-press flex items-center gap-1.5 bg-surface border border-border-custom/80 px-3.5 py-2 rounded-xl text-[11px] font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Odśwież
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <RefreshCw className="animate-spin mb-2 text-primary" size={24} />
          <p className="text-[12px] font-bold">Ładowanie zdarzeń audytowych...</p>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-20 border border-dashed border-border-custom/60 rounded-2xl bg-surface/20">
          <ShieldCheck className="mx-auto mb-2 text-emerald-400" size={32} />
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
