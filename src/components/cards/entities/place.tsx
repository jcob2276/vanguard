import { MapPin } from 'lucide-react';
interface PlaceCardData { name: string; address?: string; notes?: string; }
export function PlaceCard({ data }: { data: PlaceCardData }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[color:var(--legacy-bg-001)]">
        <MapPin size={13} style={{ color: 'var(--color-success)' }} />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.name}</p>
        {data.address && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{data.address}</p>}
        {data.notes && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{data.notes}</p>}
      </div>
    </div>
  );
}
