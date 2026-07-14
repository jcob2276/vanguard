import Button from '../ui/Button';
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
    <header className="sticky top-0 z-[var(--z-sticky)] w-full border-b border-border-custom bg-background/95 backdrop-blur-[var(--blur-md)]">
      <div className="w-full max-w-[var(--legacy-maxw-052)] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-4">
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
              <Button
                variant="ghost"
                onClick={() => onShiftWeek(-1)}
                icon={<ChevronLeft size={15} />}
                className="p-1 min-w-0 text-text-muted hover:text-primary hover:bg-transparent"
              />
              <span className="text-xs font-bold text-text-muted">{formatWeekRange(weekStart)}</span>
              <Button
                variant="ghost"
                onClick={() => onShiftWeek(1)}
                disabled={isCurrentWeek(weekStart)}
                icon={<ChevronRight size={15} />}
                className="p-1 min-w-0 text-text-muted hover:text-primary disabled:opacity-[var(--opacity-30)] hover:bg-transparent"
              />
            </div>
          </div>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={onEditScores} className="shrink-0 uppercase font-black">
            Oceń skilli
          </Button>
        )}
      </div>
    </header>
  );
}
