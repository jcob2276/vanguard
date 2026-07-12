import { RefreshCw } from 'lucide-react';
import { CONF_PILL, CONF_LABEL, READINESS_MAP } from './dailyStrainCardStyles';

interface DailyStrainHeaderProps {
  isStale: boolean;
  date: string;
  refreshing: boolean;
  onRefresh: () => void;
  readinessLevel: string | null;
  strConf?: keyof typeof CONF_PILL | null;
  recConf?: keyof typeof CONF_PILL | null;
}

export default function DailyStrainHeader({
  isStale,
  date,
  refreshing,
  onRefresh,
  readinessLevel,
  strConf,
  recConf,
}: DailyStrainHeaderProps) {
  const readinessInfo = readinessLevel ? READINESS_MAP[readinessLevel] : null;

  return (
    <>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="pixel-label text-[10px]">Stan gotowości</span>
          {isStale && (
            <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wider">
              (Dane z {date})
            </span>
          )}
        </div>
        <button onClick={onRefresh} disabled={refreshing} title="Sync + przelicz"
          className="rounded-xl border border-border-custom bg-surface-solid/40 p-2 text-text-muted transition-all hover:bg-surface-solid hover:text-text-primary active:scale-95 disabled:opacity-50">
          <RefreshCw size={11} className={refreshing ? 'animate-spin text-primary' : ''} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap relative z-10">
        {readinessInfo && (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${readinessInfo.bg} ${readinessInfo.color}`}>
            {readinessInfo.label}
          </span>
        )}
        {strConf && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${CONF_PILL[strConf]}`}>
            Strain · {CONF_LABEL[strConf]}
          </span>
        )}
        {recConf && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${CONF_PILL[recConf]}`}>
            Recovery · {CONF_LABEL[recConf]}
          </span>
        )}
      </div>
    </>
  );
}
