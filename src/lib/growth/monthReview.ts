/**
 * Monthly review — spine layer between sprint (12w) and weekly.
 * Due in the first 14 days of a new month (hard cue on first Sunday).
 */
import { addDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';
import { pl } from 'date-fns/locale';

import { getTodayWarsaw } from '../date';
import { supabase } from '../supabase';
import type { Json, Tables } from '../database.types';

export type MonthlyReviewRow = Tables<'monthly_reviews'>;

export type MonthPillarAverages = {
  cialo: number | null;
  duch: number | null;
  konto: number | null;
};

export type MonthFacts = {
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
  weeksInMonth: number;
  weeksReviewed: number;
  powerListDone: number;
  powerListPlanned: number;
  powerListZ: number;
  powerListP: number;
  kpiWeeksLogged: number;
  pillarAverages: MonthPillarAverages;
  activeProjectCount: number;
};

export type MonthlyReviewFields = {
  pattern_note?: string | null;
  leverage_note?: string | null;
  correction_note?: string | null;
  month_theme?: string | null;
  ritual_stats?: Json | null;
  ai_recap?: Json | null;
};

const MONTHLY_GRACE_DAYS = 14;
const MONTHLY_HARD_GATE_DAYS = 0; // Never hard-block — monthly review is soft cue only

function monthEndDate(monthStart: string): string {
  return format(endOfMonth(parseISO(`${monthStart}T12:00:00`)), 'yyyy-MM-dd');
}

export function monthLabel(monthStart: string): string {
  return format(parseISO(`${monthStart}T12:00:00`), 'LLLL yyyy', { locale: pl });
}

export function calendarMonthStart(today: string = getTodayWarsaw()): string {
  return format(startOfMonth(parseISO(`${today}T12:00:00`)), 'yyyy-MM-dd');
}

/** Review row that carries theme for the current calendar month (set when closing prior month). */
export function monthThemeSourceStart(today: string = getTodayWarsaw()): string {
  return format(startOfMonth(subMonths(parseISO(`${today}T12:00:00`), 1)), 'yyyy-MM-dd');
}

function monthThemeSourceForWeek(weekStart: string): string {
  return format(startOfMonth(subMonths(parseISO(`${weekStart}T12:00:00`), 1)), 'yyyy-MM-dd');
}

function dayOfMonthWarsaw(today: string): number {
  return parseISO(`${today}T12:00:00`).getDate();
}

/** First day of the calendar month being closed (previous month during grace window). */
export function closingMonthStartForReview(today: string = getTodayWarsaw()): string | null {
  if (dayOfMonthWarsaw(today) > MONTHLY_GRACE_DAYS) return null;
  return format(startOfMonth(subMonths(parseISO(`${today}T12:00:00`), 1)), 'yyyy-MM-dd');
}

export function isMonthlyReviewDue(
  today: string = getTodayWarsaw(),
  review: Pick<MonthlyReviewRow, 'completed_at'> | null = null,
): boolean {
  const closing = closingMonthStartForReview(today);
  if (!closing) return false;
  return !review?.completed_at;
}

/** Days 1–7 of month: monthly blocks week/day until done. */
export function isMonthlyHardGate(today: string = getTodayWarsaw()): boolean {
  if (!closingMonthStartForReview(today)) return false;
  return dayOfMonthWarsaw(today) <= MONTHLY_HARD_GATE_DAYS;
}

/** Days 8–14: monthly visible + cue in spine, but day/week can proceed. */
export function isMonthlySoftCue(today: string = getTodayWarsaw()): boolean {
  const dom = dayOfMonthWarsaw(today);
  return dom > MONTHLY_HARD_GATE_DAYS && dom <= MONTHLY_GRACE_DAYS && closingMonthStartForReview(today) !== null;
}

export function isFirstSundayMonthlyRitual(today: string = getTodayWarsaw()): boolean {
  const d = parseISO(`${today}T12:00:00`);
  if (d.getDay() !== 0) return false;
  return d.getDate() <= 7;
}

/** Monday week_starts that overlap the calendar month. */
export function weekStartsInMonth(monthStart: string): string[] {
  const monthStartDate = parseISO(`${monthStart}T12:00:00`);
  const monthEnd = endOfMonth(monthStartDate);
  let cursor = startOfWeek(monthStartDate, { weekStartsOn: 1 });
  const weeks: string[] = [];
  while (cursor <= monthEnd) {
    weeks.push(format(cursor, 'yyyy-MM-dd'));
    cursor = addDays(cursor, 7);
  }
  const priorMonday = subDays(monthStartDate, 6);
  const maybePrior = format(startOfWeek(priorMonday, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  if (maybePrior < monthStart && !weeks.includes(maybePrior)) {
    weeks.unshift(maybePrior);
  }
  return weeks;
}

function avgScores(rows: { pillar_scores: Json | null }[]): MonthPillarAverages {
  const sums = { cialo: 0, duch: 0, konto: 0 };
  const counts = { cialo: 0, duch: 0, konto: 0 };
  for (const row of rows) {
    const scores = row.pillar_scores as Record<string, number> | null;
    if (!scores) continue;
    for (const pillar of ['cialo', 'duch', 'konto'] as const) {
      const v = scores[pillar];
      if (typeof v === 'number' && Number.isFinite(v)) {
        sums[pillar] += v;
        counts[pillar]++;
      }
    }
  }
  return {
    cialo: counts.cialo ? Math.round((sums.cialo / counts.cialo) * 10) / 10 : null,
    duch: counts.duch ? Math.round((sums.duch / counts.duch) * 10) / 10 : null,
    konto: counts.konto ? Math.round((sums.konto / counts.konto) * 10) / 10 : null,
  };
}

export async function gatherMonthFacts(userId: string, monthStart: string): Promise<MonthFacts> {
  const monthEnd = monthEndDate(monthStart);
  const weeks = weekStartsInMonth(monthStart);

  const [
    reviewsRes,
    winsRes,
    kpiRes,
    projectsRes,
  ] = await Promise.all([
    supabase
      .from('weekly_reviews')
      .select('week_start, review_completed_at, pillar_scores')
      .eq('user_id', userId)
      .in('week_start', weeks.length ? weeks : ['1970-01-01']),
    supabase
      .from('daily_wins')
      .select('date, result, task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', monthEnd),
    weeks.length
      ? supabase
          .from('kpi_entries')
          .select('week_start')
          .eq('user_id', userId)
          .in('week_start', weeks)
      : Promise.resolve({ data: [] as { week_start: string }[], error: null }),
    supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);

  if (reviewsRes.error) throw reviewsRes.error;
  if (winsRes.error) throw winsRes.error;
  if (kpiRes.error) throw kpiRes.error;
  if (projectsRes.error) throw projectsRes.error;

  const reviews = reviewsRes.data;
  const wins = winsRes.data;
  const kpiEntries = kpiRes.data;
  const projects = projectsRes.data;

  let powerListPlanned = 0;
  let powerListDone = 0;
  let powerListZ = 0;
  let powerListP = 0;

  for (const row of wins ?? []) {
    if (row.result === 'Z') powerListZ++;
    if (row.result === 'P') powerListP++;
    for (let i = 1; i <= 5; i++) {
      const task = row[`task_${i}` as keyof typeof row];
      if (typeof task === 'string' && task.trim()) {
        powerListPlanned++;
        if (row[`done_${i}` as keyof typeof row]) powerListDone++;
      }
    }
  }

  const reviewedWeeks = (reviews ?? []).filter((r) => r.review_completed_at).length;
  const kpiWeeks = new Set((kpiEntries ?? []).map((e) => e.week_start)).size;

  return {
    monthStart,
    monthEnd,
    monthLabel: monthLabel(monthStart),
    weeksInMonth: weeks.length,
    weeksReviewed: reviewedWeeks,
    powerListDone,
    powerListPlanned,
    powerListZ,
    powerListP,
    kpiWeeksLogged: kpiWeeks,
    pillarAverages: avgScores(reviews ?? []),
    activeProjectCount: projects?.length ?? 0,
  };
}
