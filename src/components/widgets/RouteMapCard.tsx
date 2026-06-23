import { Navigation } from 'lucide-react';
interface Stop { name: string; duration?: string; }
interface RouteMapData { from: string; to: string; stops?: Stop[]; distance?: string; totalTime?: string; }
export function RouteMapCard({ data }: { data: RouteMapData }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Navigation size={13} style={{ color: '#5B6CFF' }} />
        <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{data.from} → {data.to}</p>
      </div>
      {(data.distance || data.totalTime) && (
        <div className="flex gap-3 mb-2">
          {data.distance && <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.distance}</span>}
          {data.totalTime && <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.totalTime}</span>}
        </div>
      )}
      {data.stops && data.stops.map((s, i) => (
        <div key={i} className="flex items-center gap-2 py-1 border-l-2 pl-3" style={{ borderColor: 'rgba(91,108,255,0.3)' }}>
          <p className="text-[11px] flex-1" style={{ color: 'var(--text-secondary)' }}>{s.name}</p>
          {s.duration && <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{s.duration}</span>}
        </div>
      ))}
    </div>
  );
}
