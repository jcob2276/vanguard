import { GraduationCap } from 'lucide-react';import type { GrowthWeekRecap } from '../../hooks/useGrowthWeekRecap';

export default function GrowthWeekRecapCard({ recap }: { recap: GrowthWeekRecap }) {
  const hasAny =
    recap.focusSkillLabel || recap.mustTotal > 0 || recap.notesCount > 0 || recap.activeTotal > 0;

  if (recap.loading) {
    return (
      <div className="rounded-[20px] border border-border-custom bg-surface/40 p-4 h-20 animate-pulse" />
    );
  }

  if (!hasAny) {
    return (
      <div className="rounded-[20px] border border-dashed border-border-custom bg-surface/20 p-4 space-y-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted">
          <GraduationCap size={12} /> Rozwój tego tygodnia
        </p>
        <p className="text-[11px] text-text-muted leading-relaxed">
          Brak planu nauki — ustaw focus i MUST w module Nauka na Dashboardzie.
        </p>
      </div>
    );
  }

  const parts: string[] = [];
  if (recap.focusSkillLabel) {
    const lvl =
      recap.focusScore != null && recap.focusTarget != null
        ? ` (${recap.focusScore}→${recap.focusTarget})`
        : '';
    parts.push(`Focus: ${recap.focusSkillLabel}${lvl}`);
  }
  if (recap.mustTotal > 0) parts.push(`MUST ${recap.mustDone}/${recap.mustTotal}`);
  if (recap.activeTotal > 0) parts.push(`w toku ${recap.activeDone}/${recap.activeTotal}`);
  if (recap.notesCount > 0) parts.push(`${recap.notesCount} not. rozwoj`);

  return (
    <div className="rounded-[20px] border border-primary/15 bg-primary/[0.04] p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
          <GraduationCap size={12} /> Rozwój tego tygodnia
        </p>
      </div>
      <p className="text-[12px] font-semibold text-text-primary leading-relaxed">{parts.join(' · ')}</p>
      {recap.focusWhy && (
        <p className="text-[11px] text-text-muted italic line-clamp-2">„{recap.focusWhy}"</p>
      )}
    </div>
  );
}
