import { MapPin } from 'lucide-react';
interface MapCardData { name: string; address?: string; lat?: number; lng?: number; }
export function MapCard({ data }: { data: MapCardData }) {
  const query = data.address ?? data.name;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return (
    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 no-underline">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
        <MapPin size={16} style={{ color: '#10B981' }} />
      </div>
      <div>
        <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{data.name}</p>
        {data.address && <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.address}</p>}
        <p className="text-[10px]" style={{ color: '#5B6CFF' }}>Otwórz w Mapach →</p>
      </div>
    </a>
  );
}
