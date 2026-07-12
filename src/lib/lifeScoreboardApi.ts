import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getTodayWarsaw, getDaysAgoWarsaw } from './date';

/**
 * Tygodniowy scoreboard życia — wszystko liczone z już logowanych danych (zero ręcznego wkładu).
 * Okno bieżące = ostatnie 7 dni (z dziś), poprzednie = dni 8-14 wstecz. Skala 0-100.
 */

export interface SphereScore {
  key: string;
  label: string;
  score: number | null;      // 0-100, null = brak danych w oknie
  prev: number | null;
  subs: { label: string; value: string; score: number | null }[];
}

export interface LifeScoreboard {
  spheres: SphereScore[];
  lifeScore: number | null;
  lifeScorePrev: number | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const clamp100 = (x: number) => Math.max(0, Math.min(100, x));

function sphereScore(subs: (number | null)[]): number | null {
  const valid = subs.filter((s): s is number => s != null);
  return valid.length ? Math.round(avg(valid)!) : null;
}

const lifeScoreboardKeys = {
  all: ['lifeScoreboard'] as const,
  forUser: (userId: string) => [...lifeScoreboardKeys.all, userId] as const,
};

async function fetchLifeScoreboard(userId: string): Promise<LifeScoreboard> {
  const from14 = getDaysAgoWarsaw(13);
  const from7 = getDaysAgoWarsaw(6);
  const today = getTodayWarsaw();

  const [strainQ, ouraQ, gymQ, stravaQ, foodQ, targetQ, winsQ, reconQ, habitsQ, habitLogsQ, todosQ] = await Promise.all([
    supabase.from('daily_strain').select('date, recovery_score').eq('user_id', userId).gte('date', from14).lte('date', today),
    supabase.from('oura_daily_summary').select('date, sleep_score').eq('user_id', userId).gte('date', from14).lte('date', today),
    supabase.from('workout_sessions').select('workout_day').eq('user_id', userId).gte('workout_day', from14).lte('workout_day', today),
    supabase.from('strava_activities_clean').select('start_date').gte('start_date', `${from14}T00:00:00`),
    supabase.from('daily_food_entries').select('date, calories, protein').eq('user_id', userId).gte('date', from14).lte('date', today),
    supabase.from('nutrition_targets').select('target_kcal, protein_floor_g').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_wins').select('date, result, task_1, day_note, mood_score').eq('user_id', userId).gte('date', from14).lte('date', today),
    supabase.from('daily_reconciliations').select('date, day_score').eq('user_id', userId).gte('date', from14).lte('date', today),
    supabase.from('habits').select('id').eq('user_id', userId),
    supabase.from('habit_logs').select('date, completed').eq('user_id', userId).gte('date', from14).lte('date', today),
    supabase.from('todo_items').select('completed_at').eq('user_id', userId).eq('status', 'done').gte('completed_at', `${from14}T00:00:00`),
  ]);

  const inWin = (d: string | null | undefined, win: 'cur' | 'prev') =>
    !!d && (win === 'cur' ? d >= from7 : d >= from14 && d < from7);

  const habitCount = habitsQ.data?.length ?? 0;
  const targetKcal = targetQ.data?.target_kcal ?? null;
  const proteinFloor = targetQ.data?.protein_floor_g ?? null;

  const compute = (win: 'cur' | 'prev') => {
    // ── Ciało ──
    const recov = avg((strainQ.data ?? []).filter(r => inWin(r.date, win) && r.recovery_score != null).map(r => r.recovery_score!));
    const sleep = avg((ouraQ.data ?? []).filter(r => inWin(r.date, win) && r.sleep_score != null).map(r => r.sleep_score!));
    const gymDays = new Set((gymQ.data ?? []).filter(r => inWin(r.workout_day, win)).map(r => r.workout_day));
    const runDays = new Set((stravaQ.data ?? []).filter(r => inWin(r.start_date?.slice(0, 10), win)).map(r => r.start_date!.slice(0, 10)));
    const trainDays = new Set([...gymDays, ...runDays]).size;
    const training = clamp100((trainDays / 4) * 100); // cel: 4 dni treningowe/tydz.

    // ── Paliwo ──
    const byDate = new Map<string, { kcal: number; protein: number }>();
    for (const e of foodQ.data ?? []) {
      if (!inWin(e.date, win)) continue;
      const cur = byDate.get(e.date) ?? { kcal: 0, protein: 0 };
      cur.kcal += e.calories ?? 0;
      cur.protein += e.protein ?? 0;
      byDate.set(e.date, cur);
    }
    const loggedDays = byDate.size;
    const coverage = clamp100((loggedDays / 7) * 100);
    let proteinScore: number | null = null;
    let kcalScore: number | null = null;
    if (loggedDays > 0 && proteinFloor) {
      const hit = [...byDate.values()].filter(d => d.protein >= proteinFloor).length;
      proteinScore = clamp100((hit / loggedDays) * 100);
    }
    if (loggedDays > 0 && targetKcal) {
      const within = [...byDate.values()].filter(d => Math.abs(d.kcal - targetKcal) <= targetKcal * 0.15).length;
      kcalScore = clamp100((within / loggedDays) * 100);
    }

    // ── Wykonanie ──
    const wins = (winsQ.data ?? []).filter(r => inWin(r.date, win));
    const planned = wins.filter(r => r.task_1?.trim());
    const winRate = planned.length ? clamp100((planned.filter(r => r.result === 'Z').length / planned.length) * 100) : null;
    const dayScores = (reconQ.data ?? []).filter(r => inWin(r.date, win) && r.day_score != null).map(r => r.day_score! * 10);
    const dayScoreAvg = avg(dayScores);
    const todosDone = (todosQ.data ?? []).filter(r => inWin(r.completed_at?.slice(0, 10), win)).length;
    const todoScore = clamp100((todosDone / 10) * 100); // 10 zadań/tydz. = 100

    // ── Nawyki ──
    const habitDone = (habitLogsQ.data ?? []).filter(r => inWin(r.date, win) && r.completed).length;
    const habitScore = habitCount > 0 ? clamp100((habitDone / (habitCount * 7)) * 100) : null;

    // ── Duch ──
    const moods = wins.filter(r => r.mood_score != null).map(r => (r.mood_score! / 5) * 100);
    const moodScore = avg(moods);
    const reflectDays = wins.filter(r => r.day_note?.trim()).length;
    const reflectScore = clamp100((reflectDays / 7) * 100);

    const spheres: SphereScore[] = [
      {
        key: 'cialo', label: 'Ciało',
        score: sphereScore([recov, sleep, training]), prev: null,
        subs: [
          { label: 'Recovery', value: recov != null ? `${Math.round(recov)}` : '—', score: recov },
          { label: 'Sen', value: sleep != null ? `${Math.round(sleep)}` : '—', score: sleep },
          { label: 'Treningi', value: `${trainDays}/4 dni`, score: training },
        ],
      },
      {
        key: 'paliwo', label: 'Paliwo',
        score: sphereScore([coverage, proteinScore, kcalScore]), prev: null,
        subs: [
          { label: 'Logowanie', value: `${loggedDays}/7 dni`, score: coverage },
          { label: 'Białko', value: proteinScore != null ? `${Math.round(proteinScore)}%` : '—', score: proteinScore },
          { label: 'Kalorie ±15%', value: kcalScore != null ? `${Math.round(kcalScore)}%` : '—', score: kcalScore },
        ],
      },
      {
        key: 'wykonanie', label: 'Wykonanie',
        score: sphereScore([winRate, dayScoreAvg, todoScore]), prev: null,
        subs: [
          { label: 'Power List', value: winRate != null ? `${Math.round(winRate)}%` : '—', score: winRate },
          { label: 'Wynik dnia', value: dayScoreAvg != null ? `${Math.round(dayScoreAvg / 10)}/10` : '—', score: dayScoreAvg },
          { label: 'Zadania', value: `${todosDone} done`, score: todoScore },
        ],
      },
      {
        key: 'nawyki', label: 'Nawyki',
        score: sphereScore([habitScore]), prev: null,
        subs: [
          { label: 'Konsekwencja', value: habitCount ? `${habitDone}/${habitCount * 7}` : '—', score: habitScore },
        ],
      },
      {
        key: 'duch', label: 'Duch',
        score: sphereScore([moodScore, reflectScore]), prev: null,
        subs: [
          { label: 'Nastrój', value: moodScore != null ? `${Math.round(moodScore)}` : '—', score: moodScore },
          { label: 'Refleksje', value: `${reflectDays}/7 dni`, score: reflectScore },
        ],
      },
    ];
    return spheres;
  };

  const cur = compute('cur');
  const prev = compute('prev');
  for (let i = 0; i < cur.length; i++) cur[i].prev = prev[i].score;

  const lifeScore = sphereScore(cur.map(s => s.score));
  const lifeScorePrev = sphereScore(prev.map(s => s.score));

  return { spheres: cur, lifeScore, lifeScorePrev };
}

export function useLifeScoreboardQuery(userId: string | undefined) {
  return useQuery({
    queryKey: lifeScoreboardKeys.forUser(userId || ''),
    queryFn: () => fetchLifeScoreboard(userId as string),
    enabled: !!userId,
  });
}
