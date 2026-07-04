import { supabase } from './supabase';
import { warsawDayBoundsISO } from './date';
import { unwrapList } from './supabaseUtils';
import type { Database } from './database.types';

/**
 * The 6 "life spheres" — a weekly time-balance axis, distinct from the 3
 * growth pillars (Ciało/Duch/Konto tied to dreams/projects) and distinct from
 * the subjective 1-10 self-rating in HexagonPanel ("Heksagon życia"). This is
 * the single source of truth for the sphere vocabulary stored in
 * vanguard_calendar.category, vanguard_time_budgets.category and
 * todo_items.category — do not hardcode this list elsewhere.
 */
export type LifeSphereId =
  | 'praca'
  | 'cialo_trening'
  | 'duch_refleksja'
  | 'finanse'
  | 'relacje_rodzina'
  | 'odpoczynek_regeneracja';

export interface LifeSphere {
  id: LifeSphereId;
  label: string;
  dot: string;
  bar: string;
  text: string;
  border: string;
  bgSoft: string;
}

export const LIFE_SPHERES: LifeSphere[] = [
  { id: 'praca', label: 'Praca', dot: 'bg-blue-500', bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', bgSoft: 'bg-blue-500/8' },
  { id: 'cialo_trening', label: 'Ciało / Trening', dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', bgSoft: 'bg-emerald-500/8' },
  { id: 'duch_refleksja', label: 'Duch / Refleksja', dot: 'bg-sky-500', bar: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20', bgSoft: 'bg-sky-500/8' },
  { id: 'finanse', label: 'Finanse', dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', bgSoft: 'bg-amber-500/8' },
  { id: 'relacje_rodzina', label: 'Relacje / Rodzina', dot: 'bg-violet-500', bar: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20', bgSoft: 'bg-violet-500/8' },
  { id: 'odpoczynek_regeneracja', label: 'Odpoczynek / Regeneracja', dot: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20', bgSoft: 'bg-rose-500/8' },
];

/** Pre-2026-07-04 category values, kept only for reference — do not write these anymore. */
export const LEGACY_CATEGORY_TO_SPHERE: Record<string, LifeSphereId> = {
  work: 'praca',
  health: 'cialo_trening',
  sport: 'cialo_trening',
  personal: 'relacje_rodzina',
  study: 'duch_refleksja',
};

export function sphereById(id: string | null | undefined): LifeSphere | undefined {
  return LIFE_SPHERES.find((s) => s.id === id);
}

type TimeBudgetRow = Database['public']['Tables']['vanguard_time_budgets']['Row'];

export async function fetchSphereBudgets(userId: string): Promise<TimeBudgetRow[]> {
  return unwrapList(
    await supabase.from('vanguard_time_budgets').select('*').eq('user_id', userId),
  );
}

export async function saveSphereBudget(
  userId: string,
  sphere: LifeSphereId,
  minHours: number | null,
  maxHours: number | null,
): Promise<TimeBudgetRow> {
  const { data, error } = await supabase
    .from('vanguard_time_budgets')
    .upsert(
      { user_id: userId, category: sphere, min_hours: minHours, max_hours: maxHours },
      { onConflict: 'user_id,category' },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type SphereHours = Record<LifeSphereId, number>;

function emptySphereHours(): SphereHours {
  return {
    praca: 0,
    cialo_trening: 0,
    duch_refleksja: 0,
    finanse: 0,
    relacje_rodzina: 0,
    odpoczynek_regeneracja: 0,
  };
}

/**
 * Actual hours spent per sphere in the given Warsaw week, combining calendar
 * events (by duration) and completed tasks (by duration_minutes). Sleep
 * events are excluded, matching CalendarView's existing budget calculation.
 */
export async function fetchWeeklySphereActuals(userId: string, weekStart: string): Promise<SphereHours> {
  const totals = emptySphereHours();
  const weekEnd = new Date(`${weekStart}T12:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const { fromISO } = warsawDayBoundsISO(weekStart);
  const { fromISO: toISO } = warsawDayBoundsISO(weekEndStr);

  const [{ data: events, error: evErr }, { data: tasks, error: taskErr }] = await Promise.all([
    supabase
      .from('vanguard_calendar')
      .select('category, start_time, end_time, summary')
      .eq('user_id', userId)
      .gte('start_time', fromISO)
      .lt('start_time', toISO),
    supabase
      .from('todo_items')
      .select('category, duration_minutes, completed_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('completed_at', fromISO)
      .lt('completed_at', toISO),
  ]);
  if (evErr) throw new Error(evErr.message);
  if (taskErr) throw new Error(taskErr.message);

  (events || []).forEach((ev) => {
    if (!ev.category || !(ev.category in totals) || !ev.start_time || !ev.end_time) return;
    const isSleep = ev.summary?.toLowerCase()?.includes('sen') || ev.summary?.toLowerCase()?.includes('sleep');
    if (isSleep) return;
    const hours = (new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime()) / (1000 * 60 * 60);
    if (hours > 0) totals[ev.category as LifeSphereId] += hours;
  });

  (tasks || []).forEach((task) => {
    if (!task.category || !(task.category in totals) || !task.duration_minutes) return;
    totals[task.category as LifeSphereId] += task.duration_minutes / 60;
  });

  return totals;
}
