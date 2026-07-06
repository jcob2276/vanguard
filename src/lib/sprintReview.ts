/**
 * Sprint close — 12-week aggregate + one decision for the next sprint.
 */
import { getSprintInfo } from '../components/desktop/desktopUtils';
import { getWeekStartWarsaw, shiftWeekStart } from './growth';
import { supabase } from './supabase';
import type { Json } from './database.types';
import type { MonthPillarAverages } from './monthReview';

type SprintKpiSummary = {
  name: string;
  projectName: string | null;
  target: number | null;
  unit: string | null;
  weeksLogged: number;
  lastValue: number | null;
};

export type SprintFacts = {
  personalYear: number;
  sprintNumber: number;
  sprintLabel: string;
  sprintStart: string;
  sprintEnd: string;
  currentGoal: string | null;
  weeksInSprint: number;
  weeksReviewed: number;
  powerListDone: number;
  powerListPlanned: number;
  powerListZ: number;
  powerListP: number;
  kpiWeeksLogged: number;
  pillarAverages: MonthPillarAverages;
  kpiSummaries: SprintKpiSummary[];
  weekHighlights: { weekStart: string; label: string }[];
  activeProjects: { id: string; name: string }[];
};

export type SprintProjectDecision = 'continue' | 'defer';

export function weekStartsInSprint(sprintStart: string): string[] {
  const weeks: string[] = [];
  let cursor = getWeekStartWarsaw(sprintStart);
  for (let i = 0; i < 12; i++) {
    weeks.push(cursor);
    cursor = shiftWeekStart(cursor, 1);
  }
  return weeks;
}

function avgPillarScores(rows: { pillar_scores: Json | null }[]): MonthPillarAverages {
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

export async function gatherSprintFacts(userId: string): Promise<SprintFacts> {
  const sprint = getSprintInfo();
  const weeks = weekStartsInSprint(sprint.sprintStart);

  const [
    goalRes,
    reviewsRes,
    winsRes,
    kpiDefsRes,
    kpiEntriesRes,
    projectsRes,
  ] = await Promise.all([
    supabase
      .from('sprint_goals')
      .select('goal_text')
      .eq('user_id', userId)
      .eq('personal_year', sprint.personalYear)
      .eq('sprint_number', sprint.sprintNumber)
      .maybeSingle(),
    supabase
      .from('weekly_reviews')
      .select('week_start, review_completed_at, pillar_scores, week_intention, week_highlight, proud_of')
      .eq('user_id', userId)
      .in('week_start', weeks),
    supabase
      .from('daily_wins')
      .select('date, result, task_1, task_2, task_3, task_4, task_5, done_1, done_2, done_3, done_4, done_5')
      .eq('user_id', userId)
      .gte('date', sprint.sprintStart)
      .lte('date', sprint.sprintEnd),
    supabase.from('goal_kpis').select('id, name, target, unit, project_id').eq('user_id', userId),
    weeks.length
      ? supabase.from('kpi_entries').select('kpi_id, week_start, value').eq('user_id', userId).in('week_start', weeks)
      : Promise.resolve({ data: [] as { kpi_id: string; week_start: string; value: number | null }[], error: null }),
    supabase.from('projects').select('id, name').eq('user_id', userId).eq('status', 'active'),
  ]);

  if (reviewsRes.error) throw reviewsRes.error;
  if (winsRes.error) throw winsRes.error;
  if (kpiDefsRes.error) throw kpiDefsRes.error;
  if (kpiEntriesRes.error) throw kpiEntriesRes.error;
  if (projectsRes.error) throw projectsRes.error;

  const reviews = reviewsRes.data ?? [];
  const wins = winsRes.data ?? [];
  const kpiDefs = kpiDefsRes.data ?? [];
  const kpiEntries = kpiEntriesRes.data ?? [];
  const projects = projectsRes.data ?? [];

  let powerListPlanned = 0;
  let powerListDone = 0;
  let powerListZ = 0;
  let powerListP = 0;

  for (const row of wins) {
    if (row.result === 'Z') powerListZ++;
    if (row.result === 'P') powerListP++;
    for (let i = 1; i <= 5; i++) {
      const task = row[`task_${i}` as keyof typeof row];
      if (!task) continue;
      powerListPlanned++;
      if (row[`done_${i}` as keyof typeof row]) powerListDone++;
    }
  }

  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const entriesByKpi = new Map<string, { week_start: string; value: number | null }[]>();
  for (const e of kpiEntries) {
    if (!entriesByKpi.has(e.kpi_id)) entriesByKpi.set(e.kpi_id, []);
    entriesByKpi.get(e.kpi_id)!.push({ week_start: e.week_start, value: e.value });
  }

  const kpiSummaries: SprintKpiSummary[] = kpiDefs.map((k) => {
    const entries = (entriesByKpi.get(k.id) ?? []).sort((a, b) => b.week_start.localeCompare(a.week_start));
    const logged = entries.filter((e) => e.value != null);
    return {
      name: k.name,
      projectName: k.project_id ? (projectNames.get(k.project_id) ?? null) : null,
      target: k.target,
      unit: k.unit,
      weeksLogged: logged.length,
      lastValue: logged[0]?.value ?? null,
    };
  });

  const weekHighlights = reviews
    .map((r) => {
      const label =
        r.week_intention?.trim() ||
        r.week_highlight?.trim() ||
        r.proud_of?.trim()?.split('\n')[0] ||
        null;
      return label ? { weekStart: r.week_start, label } : null;
    })
    .filter(Boolean) as { weekStart: string; label: string }[];

  const kpiWeeksLogged = new Set(kpiEntries.map((e) => e.week_start)).size;

  return {
    personalYear: sprint.personalYear,
    sprintNumber: sprint.sprintNumber,
    sprintLabel: `Sprint ${sprint.sprintNumber}`,
    sprintStart: sprint.sprintStart,
    sprintEnd: sprint.sprintEnd,
    currentGoal: goalRes.data?.goal_text ?? null,
    weeksInSprint: weeks.length,
    weeksReviewed: reviews.filter((r) => r.review_completed_at).length,
    powerListDone,
    powerListPlanned,
    powerListZ,
    powerListP,
    kpiWeeksLogged,
    pillarAverages: avgPillarScores(reviews),
    kpiSummaries: kpiSummaries.filter((k) => k.target != null || k.weeksLogged > 0),
    weekHighlights,
    activeProjects: projects.map((p) => ({ id: p.id, name: p.name })),
  };
}
