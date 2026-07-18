export interface ConflictEvent {
  id: string;
  summary: string | null;
  start_time: string | null;
  end_time: string | null;
}

export function findCalendarConflicts(events: ConflictEvent[], startMs: number, endMs: number, excludeId?: string) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  return events.filter((event) => {
    if (event.id === excludeId || !event.start_time || !event.end_time) return false;
    const eventStart = new Date(event.start_time).getTime();
    const eventEnd = new Date(event.end_time).getTime();
    return eventStart < endMs && eventEnd > startMs;
  });
}
