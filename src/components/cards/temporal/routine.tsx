import { Repeat } from 'lucide-react';
interface RoutineItem { time?: string; activity: string; duration?: string; }
interface RoutineData { title: string; items: RoutineItem[]; frequency?: string; }
export function RoutineCard({ data }: { data: RoutineData }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Repeat size={13} style={{ color: '#5B6CFF' }} />
        <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
        {data.frequency && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(91,108,255,0.08)', color: '#5B6CFF' }}>{data.frequency}</span>}
      </div>
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {item.time && <span className="text-[10px] font-mono w-10 flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>{item.time}</span>}
            <p className="text-[12px] flex-1" style={{ color: 'var(--text-secondary)' }}>{item.activity}</p>
            {item.duration && <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{item.duration}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
