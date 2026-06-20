import { Sparkles, AlertTriangle, Target } from 'lucide-react';
import { PILLARS, PILLAR_BRIEF_KEYS } from './weeklyReviewUtils';

export interface WeeklyBriefViewProps {
  brief: {
    cialo?: string;
    duch?: string;
    konto?: string;
    blocker?: string;
    recommendation?: string;
    week_rating?: number;
    week_rating_reason?: string;
    [key: string]: any;
  };
  generating: boolean;
  onGenerateBrief: () => void;
}

export default function WeeklyBriefView({
  brief,
  generating,
  onGenerateBrief,
}: WeeklyBriefViewProps) {
  const ratingStars = (n: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < n ? 'text-amber-400' : 'text-text-muted/20'}>
        ★
      </span>
    ));

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Analiza Antigravity</p>
      </div>
      <div className="rounded-[24px] border border-primary/15 bg-primary/[0.03] p-4 space-y-4">
        <div className="space-y-3">
          {PILLARS.map((p) => {
            const text = brief[PILLAR_BRIEF_KEYS[p.id]];
            if (!text) return null;
            const Icon = p.icon;
            return (
              <div key={p.id} className="flex gap-2.5">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg ${p.bg} border ${p.border}`}>
                  <Icon size={10} className={p.text} />
                </span>
                <p className="text-[12.5px] text-text-primary leading-relaxed">{text}</p>
              </div>
            );
          })}
        </div>
        {brief.blocker && (
          <div className="rounded-[16px] border border-rose-500/20 bg-rose-500/6 px-3.5 py-3 flex gap-2.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-0.5">Bloker</p>
              <p className="text-[12.5px] text-text-primary leading-relaxed">{brief.blocker}</p>
            </div>
          </div>
        )}
        {brief.recommendation && (
          <div className="rounded-[16px] border border-primary/20 bg-primary/6 px-3.5 py-3 flex gap-2.5">
            <Target size={13} className="shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">Na przyszły tydzień</p>
              <p className="text-[12.5px] font-semibold text-text-primary leading-relaxed">{brief.recommendation}</p>
            </div>
          </div>
        )}
        {brief.week_rating && (
          <div className="flex items-center gap-2 pt-1 border-t border-border-custom/40">
            <div className="flex text-[16px] leading-none">{ratingStars(brief.week_rating)}</div>
            <span className="text-[11px] font-bold text-text-muted">{brief.week_rating}/5</span>
            {brief.week_rating_reason && (
              <span className="text-[11px] text-text-muted ml-1">— {brief.week_rating_reason}</span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onGenerateBrief}
        disabled={generating}
        className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted hover:text-primary transition-colors cursor-pointer disabled:opacity-40"
      >
        <Sparkles size={10} />
        {generating ? 'Regeneruję...' : 'Regeneruj analizę'}
      </button>
    </div>
  );
}
