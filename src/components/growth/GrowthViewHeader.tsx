import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatWeekRange, isCurrentWeek } from '../../lib/growth/growth';

interface GrowthViewHeaderProps {
  weekStart: string;
  onShiftWeek: (direction: 1 | -1) => void;
  readOnly: boolean;
  onEditScores: () => void;
}

export default function GrowthViewHeader({ weekStart, onShiftWeek, readOnly, onEditScores }: GrowthViewHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border-custom bg-background/95 backdrop-blur-md">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-4">
        <Link
          to="/"
          className="rounded-xl border border-border-custom p-2.5 text-text-muted hover:text-text-primary shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black font-display uppercase tracking-tight">Rozwój</h1>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onShiftWeek(-1)} className="p-1 text-text-muted hover:text-primary cursor-pointer">
                <ChevronLeft size={15} />
              </button>
              <span className="text-[11px] font-bold text-text-muted">{formatWeekRange(weekStart)}</span>
              <button type="button" onClick={() => onShiftWeek(1)} disabled={isCurrentWeek(weekStart)} className="p-1 text-text-muted hover:text-primary disabled:opacity-30 cursor-pointer">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
        {!readOnly && (
          <button type="button" onClick={onEditScores} className="rounded-xl border border-border-custom px-3 py-2 text-[10px] font-black uppercase text-text-muted hover:text-text-primary cursor-pointer shrink-0">
            Oceń skilli
          </button>
        )}
      </div>
    </header>
  );
}
