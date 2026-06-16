export interface DigestData {
  sessions: number;
  totalVol: number;
  kmRun: number;
  avgSleep: number | null;
  avgReadiness: number | null;
  wellness: number;
}

interface WeeklyDigestProps {
  digest: DigestData | null;
  movesDoneThisWeek: number;
  streak: number;
}

interface DigestItem {
  label: string;
  value: string;
  color: string;
}

export default function WeeklyDigest({ digest, movesDoneThisWeek, streak }: WeeklyDigestProps) {
  if (!digest) return null;

  const items: DigestItem[] = [
    digest.sessions > 0 ? { label: 'treningi', value: `${digest.sessions}×`, color: 'text-indigo-500' } : null,
    digest.totalVol > 0 ? { label: 'objętość', value: `${(digest.totalVol / 1000).toFixed(1)} Mg`, color: 'text-indigo-400' } : null,
    digest.kmRun > 0.1 ? { label: 'km biegu', value: digest.kmRun.toFixed(1), color: 'text-amber-500' } : null,
    movesDoneThisWeek > 0 ? { label: 'ruchy kariery', value: `${movesDoneThisWeek}×`, color: 'text-amber-400' } : null,
    digest.avgSleep ? { label: 'śr. sen', value: `${digest.avgSleep.toFixed(1)}h`, color: digest.avgSleep >= 7 ? 'text-emerald-500' : 'text-amber-500' } : null,
    digest.avgReadiness ? { label: 'śr. readiness', value: `${Math.round(digest.avgReadiness)}/100`, color: digest.avgReadiness >= 70 ? 'text-emerald-500' : 'text-amber-500' } : null,
    digest.wellness > 0 ? { label: 'wellness', value: `${digest.wellness}×`, color: 'text-teal-500' } : null,
    streak > 1 ? { label: 'tyg. z rzędu', value: `${streak}×`, color: 'text-violet-400' } : null,
  ].filter((item): item is DigestItem => item !== null);

  if (!items.length) return null;

  return (
    <div className="rounded-[16px] border border-border-custom bg-surface/60 px-5 py-3 flex items-center gap-8">
      <span className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted shrink-0">Ten tydzień</span>
      <div className="flex items-center gap-8 flex-wrap">
        {items.map(({ label, value, color }) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className={`font-display text-[19px] font-black leading-none ${color}`}>{value}</span>
            <span className="text-[8px] text-text-muted font-bold">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
