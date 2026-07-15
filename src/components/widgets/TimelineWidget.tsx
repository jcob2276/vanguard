export interface TimelineWidgetData {
  events: Array<{
    time?: string;
    title: string;
    subtitle?: string;
    color?: string;
  }>;
}

export function TimelineWidget({ data }: { data: TimelineWidgetData }) {
  if (!data.events?.length) {
    return <p className="text-xs text-text-tertiary py-4 text-center">Brak zdarzeń</p>;
  }

  return (
    <ol className="relative space-y-3 pl-4 border-l border-border-custom ml-1">
      {data.events.map((ev, i) => (
        <li key={`${ev.title}-${i}`} className="relative pl-3">
          <span
            className="absolute -left-[var(--ds-arbitrary-21px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface-solid"
            style={{ background: ev.color ?? 'var(--color-primary)' }}
          />
          {ev.time && (
            <p className="text-xs font-mono text-text-muted">{ev.time}</p>
          )}
          <p className="text-sm font-semibold text-text-primary">{ev.title}</p>
          {ev.subtitle && <p className="text-xs text-text-tertiary">{ev.subtitle}</p>}
        </li>
      ))}
    </ol>
  );
}
