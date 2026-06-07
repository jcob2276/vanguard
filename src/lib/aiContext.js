import { supabase } from './supabase';
import { VanguardCore, computeSignals } from './vanguardCore';
import { format, startOfWeek, subDays } from 'date-fns';

/**
 * AI CONTEXT 3.1 - Unified & Complete Bridge
 * Fixed in turn 81: Now provides 1:1 identical STATE_VECTOR as AIInsight.
 */
export async function gatherUserContext(session) {
  if (!session?.user?.id) return "Brak sesji użytkownika.";

  const userId = session.user.id;
  const today = format(new Date(), 'yyyy-MM-dd');
  const core = new VanguardCore(userId, supabase);

  try {
    const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const lastWeekStart = format(startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const fourteenDaysAgo = format(subDays(new Date(), 13), 'yyyy-MM-dd');
    
    const [latestOuraRes, powerListRes, historyRes, currentReviewRes, lastWeekReviewRes, lastReviewRes, footprintRes, nutritionRes, lastWorkoutRes, oura14dRes, nutrition14dRes] = await Promise.all([
      supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_wins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
      supabase.from('vanguard_daily_aggregates').select('*').eq('user_id', userId).order('date', { ascending: true }),
      supabase.from('weekly_reviews').select('*').eq('user_id', userId).eq('week_start', currentWeekStart).maybeSingle(),
      supabase.from('weekly_reviews').select('*').eq('user_id', userId).eq('week_start', lastWeekStart).maybeSingle(),
      supabase.from('weekly_reviews').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle(),
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
        .order('date', { ascending: false })
    ]);

    const currentMetrics = computeSignals(
      latestOuraRes.data, 
      powerListRes.data,
      nutritionRes.data,
      lastWorkoutRes.data?.date
    );

    const personalBaseline = await core.getPersonalBaseline();
    const { state: vanguardState, score: stabilityScore } = await core.determineState(currentMetrics, personalBaseline);
    const history = historyRes.data || [];
    const avg = (items, key) => {
      const values = (items || []).map(item => Number(item?.[key])).filter(Number.isFinite);
      return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    };
    const oura14d = oura14dRes.data || [];
    const nutrition14d = nutrition14dRes.data || [];

    // 1:1 Identical Vector with AIInsight.jsx
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
          dopamine_z: 0,
          fragmentation_z: 0,
          screen_time: 0
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
      predictions: await core.computePredictions(currentMetrics, history, personalBaseline),
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
      active_signature: core.generateActiveSignature(footprintRes.data || [], currentMetrics),
      desktop_footprint: footprintRes.data?.map(f => ({
        timestamp: new Date(f.timestamp).toLocaleTimeString('pl-PL', {
          timeZone: 'Europe/Warsaw',
          hour: '2-digit',
          minute: '2-digit'
        }),
        app: f.payload?.window?.app,
        title: f.payload?.window?.title,
        web_url: f.payload?.web?.url
      })) || []
    };

    return stateVector;

  } catch (error) {
    console.error("Context Gathering Error:", error);
    return "Błąd podczas zbierania kontekstu Vanguard.";
  }
}
