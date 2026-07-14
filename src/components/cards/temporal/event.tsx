import { Calendar, Clock, MapPin } from 'lucide-react';

interface EventCardData {
  title: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  color?: string;
  tags?: string[];
}

export function EventCard({ data }: { data: EventCardData }) {
  const color = data.color ?? 'var(--color-primary)';
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}18` }}>
          <Calendar size={14} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
          <div className="flex flex-wrap gap-3 mt-1">
            {data.date && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                <Calendar size={10} />{data.date}
              </span>
            )}
            {data.time && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                <Clock size={10} />{data.time}
              </span>
            )}
            {data.location && (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                <MapPin size={10} />{data.location}
              </span>
            )}
          </div>
        </div>
      </div>
      {data.description && (
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.description}</p>
      )}
      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map(tag => (
            <span key={tag} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${color}10`, color }}>#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
