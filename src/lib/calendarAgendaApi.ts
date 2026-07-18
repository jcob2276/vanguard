import { supabase } from './supabase';

export interface CalendarAgendaEvent {
  id: string;
  summary: string;
  start_time: string;
  end_time: string;
  category: string | null;
}

export async function fetchCalendarAgenda(userId: string, fromISO: string, toISO: string): Promise<CalendarAgendaEvent[]> {
  const { data, error } = await supabase
    .from('vanguard_calendar')
    .select('id, summary, start_time, end_time, category')
    .eq('user_id', userId)
    .gte('start_time', fromISO)
    .lte('start_time', toISO)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data as CalendarAgendaEvent[]) || [];
}
