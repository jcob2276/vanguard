import React from 'react';

export interface KpiUpdateModalProps {
  activeKpis: any[];
  kpiUpdateIdx: number;
  kpiUpdateVal: string;
  setKpiUpdateVal: (val: string) => void;
  lastSnapshotByKpi: Record<string, any>;
  onClose: () => void;
  onNext: () => void;
  busy: boolean;
}

export default function KpiUpdateModal({
  activeKpis,
  kpiUpdateIdx,
  kpiUpdateVal,
  setKpiUpdateVal,
  lastSnapshotByKpi,
  onClose,
  onNext,
  busy
}: KpiUpdateModalProps) {
  const kpi = activeKpis[kpiUpdateIdx];
  const last = lastSnapshotByKpi[kpi.id];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-xl p-5 space-y-4 animate-fadeIn">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">
            KPI {kpiUpdateIdx + 1} / {activeKpis.length}
          </p>
          <h3 className="text-[17px] font-black text-text-primary leading-tight">{kpi.name}</h3>
          <div className="flex items-center gap-3 mt-1">
            {kpi.target != null && (
              <span className="text-[12px] text-text-muted">
                cel: {kpi.target} {kpi.unit}
              </span>
            )}
            {last != null && (
              <span className="text-[12px] text-text-muted">
                poprzednio: {last.value}
              </span>
            )}
          </div>
        </div>
        <input
          autoFocus
          type="number"
          value={kpiUpdateVal}
          onChange={e => setKpiUpdateVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onNext();
          }}
          placeholder={kpi.unit || 'wartość'}
          className="w-full rounded-[14px] border border-border-custom bg-surface-solid/40 px-4 py-4 text-[28px] font-black text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/30 text-center tracking-tight"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border-custom py-3 px-4 text-[12px] font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Anuluj
          </button>
          <button
            onClick={onNext}
            disabled={busy}
            className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {kpiUpdateIdx < activeKpis.length - 1 ? 'Dalej →' : 'Zapisz wszystko'}
          </button>
        </div>
      </div>
    </div>
  );
}
