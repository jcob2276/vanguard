export interface TodoSlot {
  id: string;
  title: string;
  priority: string;
  duration_minutes: number | null;
  due_date: string | null;
  scheduled_time: string | null;
  status: string;
}

export interface CalEvent {
  start_time: string;
  end_time: string;
  summary: string | null;
}
