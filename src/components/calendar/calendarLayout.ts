import { HOUR_END, HOUR_START, parseTime, type CalRow } from './calendarHelpers';

export function layoutDayEvents(dayEvents: CalRow[]) {
  const parsed = dayEvents
    .filter((event) => event.start_time && event.end_time)
    .map((event) => ({
      event,
      start: Math.max(HOUR_START * 60, parseTime(event.start_time!)),
      end: Math.min(HOUR_END * 60, parseTime(event.end_time!)),
    }))
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const columns: { end: number }[][] = [];
  const eventLayouts = new Map<string, { columnIndex: number }>();
  for (const item of parsed) {
    let columnIndex = 0;
    while (columnIndex < columns.length) {
      const column = columns[columnIndex];
      if (item.start >= column[column.length - 1].end) break;
      columnIndex++;
    }
    if (columnIndex === columns.length) columns.push([]);
    columns[columnIndex].push(item);
    eventLayouts.set(item.event.id, { columnIndex });
  }

  const clusters: typeof parsed[] = [];
  let current: typeof parsed = [];
  let clusterEnd = 0;
  for (const item of parsed) {
    if (current.length === 0 || item.start < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.end;
    }
  }
  if (current.length > 0) clusters.push(current);

  const styles = new Map<string, { left: string; width: string }>();
  for (const cluster of clusters) {
    const maximumColumn = Math.max(...cluster.map((item) => eventLayouts.get(item.event.id)?.columnIndex ?? 0));
    const columnCount = maximumColumn + 1;
    for (const item of cluster) {
      const columnIndex = eventLayouts.get(item.event.id)?.columnIndex ?? 0;
      styles.set(item.event.id, {
        left: `${(columnIndex * 100) / columnCount}%`,
        width: `${100 / columnCount}%`,
      });
    }
  }
  return styles;
}
