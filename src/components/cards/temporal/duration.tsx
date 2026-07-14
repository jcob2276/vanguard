import { Clock } from 'lucide-react';
interface DurationData { label: string; hours?: number; minutes?: number; description?: string; }
export function DurationCard({ data }: { data: DurationData }) {
  const total = (data.hours ?? 0) * 60 + (data.minutes ?? 0);
  const h = Math.floor(total / 60), m = total % 60;
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[rgba(245,158,11,0.1)]">
        <Clock size={14} style={{ color: 'var(--color-warning)' }} />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{data.label}</p>
        <p className="text-lg font-[800] leading-none" style={{ color: 'var(--text-primary)' }}>{h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}min` : ''}</p>
        {data.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{data.description}</p>}
      </div>
    </div>
  );
}
