import { formatWarsawDate, getTodayWarsaw } from '../../lib/date';
import { differenceInDays, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import type { Tables } from '../../lib/database.types';

type DailyWinRow = Tables<'daily_wins'>;

const APP_LAUNCH_DATE = '2026-05-03';

export function calculateStats(history: DailyWinRow[]) {
  if (!history.length) return { streak: 0, weeklyP: 0, monthlyWin: false, weeks: [] as any[] };
  let streak = 0;
  const sorted = [...history].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
  const today = getTodayWarsaw();
  const yesterday = (() => {
    const d = new Date(getTodayWarsaw() + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return formatWarsawDate(d);
  })();
  if (sorted[0]?.date === today || sorted[0]?.date === yesterday) {
    for (const day of sorted) {
      if (day.result === 'Z') streak++;
      else if (day.date !== today) break;
    }
  }
  const weeks = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(getTodayWarsaw() + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - i * 7);
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    const weekDays = history.filter((dh) => {
      if (!dh.date) return false;
      const dhTime = new Date(dh.date + 'T12:00:00Z').getTime();
      return dhTime >= start.getTime() && dhTime <= end.getTime();
    });
    const now = new Date(getTodayWarsaw() + 'T12:00:00Z');
    const expectedPastDays = isWithinInterval(now, { start, end }) ? differenceInDays(now, start) : 7;
    const explicitP = weekDays.filter((d) => d.result === 'P').length;
    let missing = 0;
    for (let day = 0; day < expectedPastDays; day++) {
      const checkDate = (() => {
        const dSub = new Date(now);
        dSub.setUTCDate(dSub.getUTCDate() - (expectedPastDays - day));
        return formatWarsawDate(dSub);
      })();
      if (!weekDays.some((e) => e.date === checkDate) && checkDate >= APP_LAUNCH_DATE) missing++;
    }
    const pCount = explicitP + missing;
    weeks.push({ isWeekWin: pCount <= 2 && (expectedPastDays > 0 || weekDays.length > 0), pCount, start });
  }
  return { streak, weeklyP: weeks[0]?.pCount || 0, monthlyWin: weeks.filter((w) => w.isWeekWin).length >= 3, weeks };
}

export function calculateWeekFacts(
  weekDoneTasks: { title: string; status: string }[],
  weekOura: { total_sleep_hours: number | null; readiness_score: number | null }[],
  weekRuns: { distance: number | null }[],
  weekNutrition: { calories: number | null }[],
  nutritionTarget: number | null
) {
  const done = weekDoneTasks.filter((t) => t.status === 'done').map((t) => t.title);
  const dropped = weekDoneTasks.filter((t) => t.status === 'dropped').map((t) => t.title);
  const sleepArr = weekOura.map((o) => o.total_sleep_hours).filter((v): v is number => v != null);
  const readArr = weekOura.map((o) => o.readiness_score).filter((v): v is number => v != null);
  const kcalArr = weekNutrition.map((n) => n.calories).filter((v): v is number => v != null);
  const totalKm = weekRuns.reduce((s, r) => s + (r.distance || 0), 0) / 1000;
  return {
    doneCount: done.length,
    totalCount: done.length + dropped.length,
    doneTasks: done.slice(0, 10),
    droppedTasks: dropped.slice(0, 5),
    sleepHrs: sleepArr.length ? sleepArr.reduce((a, b) => a + b, 0) / sleepArr.length : null,
    readiness: readArr.length ? readArr.reduce((a, b) => a + b, 0) / readArr.length : null,
    totalKm: totalKm > 0 ? totalKm : null,
    avgKcal: kcalArr.length ? kcalArr.reduce((a, b) => a + b, 0) / kcalArr.length : null,
    targetKcal: nutritionTarget,
  };
}
