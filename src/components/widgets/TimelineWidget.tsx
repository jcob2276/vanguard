interface TimelineEvent { date: string; title: string; description?: string; color?: string; }
interface TimelineWidgetProps { events: TimelineEvent[]; title?: string; }
export function TimelineWidget({ events, title }: TimelineWidgetProps) {
  return (
    <div>
      {title && <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>}
      <div className="relative">
        <div className="absolute left-2.5 top-2 bottom-2 w-px" style={{ background: 'rgba(153,161,175,0.2)' }} />
        <div className="space-y-3 pl-7">
          {events.map((ev, i) => {
            const color = ev.color ?? '#5B6CFF';
            return (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white" style={{ background: color }} />
                <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{ev.date}</p>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{ev.title}</p>
                {ev.description && <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{ev.description}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
