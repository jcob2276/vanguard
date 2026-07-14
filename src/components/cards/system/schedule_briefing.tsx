import { CalendarDays } from 'lucide-react';
interface BriefingEvent { time: string; title: string; duration?: string; color?: string; }
interface ScheduleBriefingData { date: string; events: BriefingEvent[]; summary?: string; }
export function ScheduleBriefingCard({ data }: { data: ScheduleBriefingData }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays size={13} style={{ color: 'var(--color-primary)' }} />
        <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{data.date}</p>
      </div>
      {data.summary && <p className="text-[12px] mb-2" style={{ color: 'var(--text-secondary)' }}>{data.summary}</p>}
      <div className="space-y-2">
        {data.events.map((ev, i) => {
          const color = ev.color ?? 'var(--color-primary)';
          return (
            <div key={i} className="flex items-start gap-2.5 pl-2 border-l-2" style={{ borderColor: color }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>{ev.time}</span>
                  {ev.duration && <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{ev.duration}</span>}
                </div>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
