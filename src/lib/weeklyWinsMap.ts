import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw, shiftDateStr } from './date';

export type WinsDayCell = {
  date: string;
  label: string;
  result: 'Z' | 'P' | null;
  doneCount: number;
  plannedCount: number;
  status: 'win' | 'loss' | 'open';
};

const WEEKDAY_PL = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'] as const;

function weekdayLabel(dateStr: string): string {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return WEEKDAY_PL[day] ?? '';
}

export function buildWeeklyWinsMap(input: {
  today: string;
  rows: Array<{
    date: string;
    result: string | null;
    task_1?: string | null;
    task_2?: string | null;
    task_3?: string | null;
    task_4?: string | null;
    task_5?: string | null;
    done_1?: boolean | null;
    done_2?: boolean | null;
    done_3?: boolean | null;
    done_4?: boolean | null;
    done_5?: boolean | null;
  }>;
}): WinsDayCell[] {
  const byDate = new Map(input.rows.map((row) => [row.date, row]));
  const days: WinsDayCell[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = shiftDateStr(input.today, -i);
    const row = byDate.get(date);
    const tasks = [row?.task_1, row?.task_2, row?.task_3, row?.task_4, row?.task_5];
    const dones = [row?.done_1, row?.done_2, row?.done_3, row?.done_4, row?.done_5];
    const plannedCount = tasks.filter((t) => Boolean(t && String(t).trim())).length;
    const doneCount = dones.filter(Boolean).length;
    const result = row?.result === 'Z' || row?.result === 'P' ? row.result : null;
    const isWin = result === 'Z' || (plannedCount === 5 && doneCount === 5);

    let status: WinsDayCell['status'];
    if (isWin) status = 'win';
    else if (date === input.today) status = 'open';
    else status = 'loss';

    days.push({
      date,
      label: weekdayLabel(date),
      result,
      doneCount,
      plannedCount,
      status,
    });
  }

  return days;
}

export function useWeeklyWinsMap(userId: string) {
  const today = getTodayWarsaw();
  const since = shiftDateStr(today, -6);
  return useQuery({
    queryKey: ['weekly-wins-map', userId, since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_wins')
        .select('date, result, task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5')
        .eq('user_id', userId)
        .gte('date', since)
        .lte('date', today)
        .order('date', { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []).filter((r): r is typeof r & { date: string } => typeof r.date === 'string');
      return buildWeeklyWinsMap({ today, rows });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}
