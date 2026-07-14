import { RefreshCw } from 'lucide-react';
import { CONF_PILL, CONF_LABEL, READINESS_MAP } from './dailyStrainCardStyles';
import Button from '../ui/Button';

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
            <span className="text-[8px] font-bold text-warning uppercase tracking-wider">
              (Dane z {date})
            </span>
          )}
        </div>
        <Button onClick={onRefresh} variant="secondary" icon={<RefreshCw size={11} className={refreshing ? 'animate-spin text-primary' : ''} />} className="rounded-xl p-2" title="Sync + przelicz" />
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
