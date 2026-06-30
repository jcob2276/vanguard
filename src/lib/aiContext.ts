import { supabase } from './supabase';
import { VanguardCore, computeSignals } from './vanguardCore';
import { getTodayWarsaw, getDaysAgoWarsaw } from './date';
import {
  currentWeekStart,
  fetchGoalSpine,
  fetchWeeklyReviewBundle,
  goalSpineAiSnapshot,
  previousWeekStart,
  strategicGapsFromSpine,
} from './goalSpine';

type FootprintPayload = {
  window?: {
    app?: string;
    title?: string;
  };
  web?: {
    url?: string;
  };
};

/**
 * AI CONTEXT 3.1 - Unified & Complete Bridge
 */
const contextCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000;

export async function gatherUserContext(session: any) {
  if (!session?.user?.id) return "Brak sesji użytkownika.";

  const userId = session.user.id;
  const today = getTodayWarsaw();
  const cacheKey = `${userId}:${today}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const core = new VanguardCore(userId, supabase);

  try {
    const weekStart = currentWeekStart();
    const lastWeekStart = previousWeekStart(weekStart);
    const fourteenDaysAgo = getDaysAgoWarsaw(13);
    
    const settled = await Promise.allSettled([
      supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('vanguard_daily_aggregates').select('*').eq('user_id', userId).order('date', { ascending: true }),
      fetchWeeklyReviewBundle(userId, weekStart, lastWeekStart),
      fetchGoalSpine(userId, weekStart),
      supabase.from('vanguard_footprint').select('*').eq('user_id', userId).order('timestamp', { ascending: false }).limit(20),
      supabase.from('daily_nutrition').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('workout_sessions').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('oura_daily_summary')
        .select('date, steps, active_calories, total_calories')
        .eq('user_id', userId)
        .gte('date', fourteenDaysAgo)
        .order('date', { ascending: false }),
      supabase.from('daily_nutrition')
        .select('date, calories, protein')
        .eq('user_id', userId)
        .gte('date', fourteenDaysAgo)
        .order('date', { ascending: false }),
      supabase.from('dreams').select('id, title, life_goal').eq('user_id', userId).eq('is_done', false),
      supabase.from('projects').select('dream_id').eq('user_id', userId).eq('status', 'active').not('dream_id', 'is', null),
      // Daily context
      supabase.from('daily_reconciliations').select('planning_summary, midday_status, midday_blocker, day_score').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('todo_items').select('title, priority, ai_bucket, due_date, section_id').eq('user_id', userId).eq('status', 'open').order('priority', { ascending: false }).limit(30),
      supabase.from('todo_items').select('title, due_date, status').eq('user_id', userId).eq('is_milestone', true).in('status', ['pending', 'open']).lte('due_date', getDaysAgoWarsaw(-14)).order('due_date', { ascending: true }).limit(5),
      supabase.from('daily_strain').select('date, strain_score, recovery_score, readiness_level, components').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const [latestOuraRes, powerListRes, historyRes, reviewBundleRes, goalSpineRes, footprintRes, nutritionRes, lastWorkoutRes, oura14dRes, nutrition14dRes, dreamsRes, activeDreamProjectsRes, todayRecRes, todosRes, checkpointsRes, dailyStrainRes] = settled.map(r =>
      r.status === 'fulfilled' ? r.value : { data: null, error: r.reason }
    ) as any[];

    const reviewBundle = reviewBundleRes?.current !== undefined
      ? reviewBundleRes
      : { current: null, previous: null, latest: null };
    const currentReviewRes = { data: reviewBundle.current };
    const lastWeekReviewRes = { data: reviewBundle.previous };
    const lastReviewRes = { data: reviewBundle.latest };
    const goalSpine = goalSpineRes?.week !== undefined ? goalSpineRes : null;

    const currentMetrics = computeSignals(
      latestOuraRes.data, 
      powerListRes.data,
      nutritionRes.data,
      lastWorkoutRes.data?.date
    );

    const personalBaseline = await core.getPersonalBaseline();
    const { state: vanguardState, score: stabilityScore } = await core.determineState(currentMetrics, personalBaseline);
    const history = historyRes.data || [];
    const avg = (items: any[] | null, key: string): number | null => {
      const values = (items || []).map((item: any) => Number(item?.[key])).filter(Number.isFinite);
      return values.length ? Math.round(values.reduce((sum: number, value: number) => sum + value, 0) / values.length) : null;
    };
    const oura14d = oura14dRes.data || [];
    const nutrition14d = nutrition14dRes.data || [];
    const dreamsData: any[] = dreamsRes.data || [];
    const activeDreamIds = new Set(
      (activeDreamProjectsRes.data ?? [])
        .map((p: { dream_id?: string | null }) => p.dream_id)
        .filter(Boolean) as string[],
    );
    const strategic_gaps = goalSpine
      ? strategicGapsFromSpine(goalSpine, dreamsData, activeDreamIds)
      : null;

    const stateVector = {
      state: vanguardState,
      stability_score: stabilityScore,
      confidence: currentMetrics.confidence,
      now: new Date().toLocaleString('pl-PL', { 
        timeZone: 'Europe/Warsaw',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      metrics: {
        execution: currentMetrics.execution_ratio || 0,
        biological: {
          sleep_z: currentMetrics.sleep ? (currentMetrics.sleep - personalBaseline.means.sleep) / (personalBaseline.stdDevs.sleep || 1) : 0,
          hrv_z: currentMetrics.hrv ? (currentMetrics.hrv - personalBaseline.means.hrv) / (personalBaseline.stdDevs.hrv || 1) : 0,
          readiness: currentMetrics.readiness || 0
        },
        digital: {
          dopamine_z: null,
          fragmentation_z: null,
          screen_time: null
        }
      },
      last_14_days: {
        date_from: fourteenDaysAgo,
        date_to: today,
        oura_days_logged: oura14d.length,
        nutrition_days_logged: nutrition14d.length,
        avg_steps: avg(oura14d, 'steps'),
        avg_active_calories: avg(oura14d, 'active_calories'),
        avg_total_calories_burned: avg(oura14d, 'total_calories'),
        avg_food_calories: avg(nutrition14d, 'calories'),
        avg_protein: avg(nutrition14d, 'protein'),
        oura_daily: oura14d,
        nutrition_daily: nutrition14d
      },
      lag_correlations: core.detectLagCorrelations(history),
      goal_alignment: core.calculateGoalAlignment(powerListRes.data),
      identity_vault: await core.evaluateIdentityVault(),
      weekly_protocol: {
        is_sunday: new Date().getDay() === 0,
        current_week_review_done: !!currentReviewRes.data,
        previous_week_review_missing: !lastWeekReviewRes.data,
        last_review_insights: lastReviewRes.data ? {
          date: lastReviewRes.data.week_start,
          proud_of: lastReviewRes.data.proud_of,
          sabotage: lastReviewRes.data.sabotage,
          improvements: lastReviewRes.data.do_differently
        } : null
      },
      goal_spine: goalSpine ? goalSpineAiSnapshot(goalSpine) : null,
      strategic_gaps,
      today_plan: todayRecRes.data ? {
        mode: (todayRecRes.data.planning_summary as any)?.mode ?? null,
        one_clear_move: (todayRecRes.data.planning_summary as any)?.one_clear_move ?? null,
        top3: (todayRecRes.data.planning_summary as any)?.top3 ?? [],
        midday_status: todayRecRes.data.midday_status ?? null,
        midday_blocker: todayRecRes.data.midday_blocker ?? null,
        day_score: todayRecRes.data.day_score ?? null,
      } : null,
      open_todos: (todosRes.data ?? []).map((t: any) => ({
        title: t.title,
        priority: t.priority,
        bucket: t.ai_bucket ?? (t.due_date ? 'due:' + t.due_date : 'unclassified'),
      })),
      upcoming_checkpoints: (checkpointsRes.data ?? []).map((c: any) => ({
        title: c.title,
        due_date: c.due_date,
      })),
      readiness: dailyStrainRes.data ? {
        date: dailyStrainRes.data.date,
        strain: dailyStrainRes.data.strain_score,
        recovery: dailyStrainRes.data.recovery_score,
        readiness_level: dailyStrainRes.data.readiness_level,
        recovery_confidence: (dailyStrainRes.data.components as any)?.recovery_confidence ?? null,
        strain_confidence: (dailyStrainRes.data.components as any)?.strain_confidence ?? null,
        vitality_score: (dailyStrainRes.data.components as any)?.vitality_score ?? null,
        fitness_age: (dailyStrainRes.data.components as any)?.fitness_age ?? null,
        caffeine_alert: (dailyStrainRes.data.components as any)?.caffeine_alert ?? null,
        caffeine_active_mg: (dailyStrainRes.data.components as any)?.caffeine_active_mg ?? null,
        hydration_goal_ml: (dailyStrainRes.data.components as any)?.hydration_goal_ml ?? null,
      } : null,
      active_signature: core.generateActiveSignature(footprintRes.data || [], currentMetrics),
      desktop_footprint: footprintRes.data?.map((f: any) => {
        const payload = f.payload && typeof f.payload === 'object' && !Array.isArray(f.payload)
          ? f.payload as FootprintPayload
          : null;
        return ({
        timestamp: new Date(f.timestamp || '').toLocaleTimeString('pl-PL', {
          timeZone: 'Europe/Warsaw',
          hour: '2-digit',
          minute: '2-digit'
        }),
        app: payload?.window?.app,
        title: payload?.window?.title,
        web_url: payload?.web?.url
      });
      }) || []
    };

    contextCache.set(cacheKey, { data: stateVector, ts: Date.now() });
    return stateVector;

  } catch (error) {
    console.error("Context Gathering Error:", error);
    return "Błąd podczas zbierania kontekstu Vanguard.";
  }
}
