import { Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Sparkline from './Sparkline';

export type Kpi = {
  id: string;
  name: string;
  unit: string;
  higher_is_better: boolean;
  target: number | null;
  pillar: string | null;
};

export interface KpiEntryCardProps {
  kpi: Kpi;
  pillarMeta: {
    border: string;
    bg: string;
  };
  prev: number | null;
  curStr: string;
  onCurStrChange: (val: string) => void;
  onBlur: (val: string) => void;
  isSaved: boolean;
  hist: number[];
  setupMode: boolean;
  onDeleteKpi: (id: string) => void;
}

export default function KpiEntryCard({
  kpi,
  pillarMeta,
  prev,
  curStr,
  onCurStrChange,
  onBlur,
  isSaved,
  hist,
  setupMode,
  onDeleteKpi,
}: KpiEntryCardProps) {
  const cur = curStr !== '' ? parseFloat(curStr) : null;
  const delta = cur !== null && prev !== null ? cur - prev : null;
  const pct = delta !== null && prev !== null && prev !== 0 ? (delta / Math.abs(prev)) * 100 : null;
  const better = delta === null ? null : (kpi.higher_is_better ? delta > 0 : delta < 0);
  const neutral = delta !== null && Math.abs(delta) < 0.01;
  const targetPct = kpi.target && kpi.target > 0 && cur !== null
    ? Math.min(Math.round((cur / kpi.target) * 100), 999)
    : null;

  return (
    <div className={`rounded-[20px] border ${pillarMeta.border} ${pillarMeta.bg} px-4 py-3 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-text-primary flex-1">{kpi.name}</span>
        {kpi.unit && <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">{kpi.unit}</span>}
        
        {/* Sparkline */}
        {!setupMode && hist.length >= 2 && (
          <Sparkline data={hist} higherIsBetter={kpi.higher_is_better} />
        )}
        
        {setupMode && (
          <button
            onClick={() => onDeleteKpi(kpi.id)}
            className="p-1 rounded text-text-muted/30 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {!setupMode && (
        <>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/60 mb-0.5">poprz.</p>
              <p className="text-[14px] font-black text-text-muted/50">{prev !== null ? prev : '—'}</p>
            </div>
            <div className="text-text-muted/30 text-lg">→</div>
            <div className="flex-1">
              <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/60 mb-0.5">ten tydzień</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  value={curStr}
                  onChange={(e) => onCurStrChange(e.target.value)}
                  onBlur={(e) => onBlur(e.target.value)}
                  placeholder="wpisz..."
                  className="w-full bg-transparent text-[18px] font-black text-text-primary outline-none placeholder:text-text-muted/25 placeholder:text-[14px] placeholder:font-medium"
                />
                {/* Auto-saved tick */}
                {isSaved && (
                  <span className="shrink-0 text-[10px] font-black text-emerald-500/60">✓</span>
                )}
              </div>
            </div>
            {delta !== null && !neutral && (
              <div className={`flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-black ${
                better ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
              }`}>
                {better ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {delta > 0 ? '+' : ''}{pct !== null ? `${pct.toFixed(0)}%` : delta.toFixed(1)}
              </div>
            )}
            {neutral && delta !== null && (
              <div className="flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-black text-text-muted bg-surface">
                <Minus size={11} /> bez zmian
              </div>
            )}
          </div>

          {/* Target progress */}
          {kpi.target != null && (
            <div className="space-y-1 pt-0.5">
              <div className="h-[3px] w-full rounded-full bg-border-custom/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    targetPct !== null && targetPct >= 100 ? 'bg-emerald-500' : 'bg-primary/50'
                  }`}
                  style={{ width: `${Math.min(targetPct ?? 0, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-text-muted/50">cel: {kpi.target}{kpi.unit ? ` ${kpi.unit}` : ''}</span>
                {targetPct !== null && (
                  <span className={`text-[8px] font-black ${
                    targetPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted/60'
                  }`}>
                    {targetPct}%
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
