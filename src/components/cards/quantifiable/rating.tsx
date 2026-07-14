import { Star } from 'lucide-react';
interface RatingData { label: string; value: number; max?: number; description?: string; }
export function RatingCard({ data }: { data: RatingData }) {
  const max = data.max ?? 5;
  return (
    <div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>{data.label}</p>
      <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <Star key={i} size={16} fill={i < data.value ? 'var(--color-warning)' : 'transparent'} style={{ color: i < data.value ? 'var(--color-warning)' : 'var(--legacy-color-090)' }} />
        ))}
        <span className="ml-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.value}/{max}</span>
      </div>
      {data.description && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{data.description}</p>}
    </div>
  );
}
