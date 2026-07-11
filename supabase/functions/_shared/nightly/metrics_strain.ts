import { createServiceClient } from '../supabase.ts';
import { resolveUserScope } from '../supabase.ts';
import { estimateCaffeineMg } from '../caffeineEstimate.ts';
import { getWarsawDateString } from '../time.ts';
import { clamp, ewmaBaseline } from './baselines.ts';
import { computeReadiness, ReadinessDay } from './readiness.ts';
import { computeRecoveryScore } from './recovery_score.ts';
import { computeStrainScore } from './strain_score.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const warsawDate = (iso: string) => getWarsawDateString(new Date(iso));

interface OuraDailySummaryRow {
  date: string;
  hrv_avg: number | null;
  rhr_avg: number | null;
  total_sleep_hours: number | null;
  sleep_score: number | null;
  readiness_score: number | null;
}

interface OuraEnhancedRow {
  date: string;
  sleep_average_breath: number | null;
  temperature_deviation: number | null;
  steps: number | null;
  resilience_level: string | null;
}

interface OuraHrZonesDailyRow {
  day: string;
  z1_regen_min: number | null;
  z2_tlenowa_min: number | null;
  z3_tempo_min: number | null;
  z4_prog_min: number | null;
  z5_max_min: number | null;
  hr_max: number | null;
}

interface DailyNutritionRow {
  date: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
}

interface ExerciseLogForStrain {
  exercise_name: string;
  rpe: number | null;
  rir: number | null;
  reps: number | null;
}

interface WorkoutSessionRow {
  date: string;
  exercise_logs: ExerciseLogForStrain[] | null;
}

interface StravaActivityRow {
  start_date: string;
  perceived_exertion: number | null;
  has_pr: boolean | null;
  sport_type: string | null;
  is_oura: boolean | null;
}

interface DailyFoodEntryRow {
  name: string;
  logged_at: string | null;
  date: string;
}

interface BehaviorLogRow {
  date: string;
  behavior_key: string;
  value: string | number | null;
}

interface DailyReconciliationRow {
  date: string;
  day_score: number | null;
}

function byKey<T>(rows: T[] | null, key: (r: T) => string): Record<string, T[]> {
  const m: Record<string, T[]> = {};
  for (const r of rows || []) {
    const k = key(r);
    (m[k] = m[k] || []).push(r);
  }
  return m;
}

export const runComputeDailyStrain = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const days: number = body.days ?? 2;
    const dateFrom: string | null = body.dateFrom ?? null;
    const dateTo: string | null = body.dateTo ?? null;
    const algoVersion: number = body.algoVersion ?? 1;
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null);
    const onlyUserId: string | null = scopedUserId;

    let uq = supabase.from('user_settings').select('user_id').not('oura_token', 'is', null);
    if (onlyUserId) uq = uq.eq('user_id', onlyUserId);
    const { data: users, error: uErr } = await uq;
    if (uErr) throw uErr;

    const now = new Date();
    const todayWarsaw = getWarsawDateString(now);
    const toWarsaw = getWarsawDateString;
    const endStr = dateTo || toWarsaw(now);
    const startStr = dateFrom || toWarsaw(new Date(now.getTime() - days * 864e5));

    // Calculate start limits relative to startStr
    const startDate = new Date(startStr + 'T12:00:00Z');
    const start90 = toWarsaw(new Date(startDate.getTime() - 90 * 864e5));
    const start30 = toWarsaw(new Date(startDate.getTime() - 30 * 864e5));

    const computeForUser = async (u: { user_id: string }) => {
      const uid = u.user_id;
      try {
        // ── Waga (ostatnia) ──
        const { data: bw } = await supabase
          .from('body_metrics')
          .select('weight')
          .eq('user_id', uid)
          .not('weight', 'is', null)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        const weight = Number(bw?.weight) || 75;

        // ── Profil (wiek, płeć → FitnessAge / VitalityEngine) ──
        const { data: profile } = await supabase
          .from('nutrition_profile')
          .select('birth_date, sex')
          .eq('user_id', uid)
          .maybeSingle();
        const sex: 'M' | 'F' = String(profile?.sex ?? 'M').toUpperCase() === 'F' ? 'F' : 'M';
        const ageYears = profile?.birth_date
          ? (now.getTime() - new Date(profile.birth_date).getTime()) / (365.25 * 86400000)
          : 30;

        // ── Baseline HRV/RHR (90 dni, chronologicznie dla EWMA) ──
        const { data: base, error: baseErr } = await supabase
          .from('oura_daily_summary')
          .select('date, hrv_avg, rhr_avg, total_sleep_hours, sleep_score, readiness_score')
          .eq('user_id', uid)
          .gte('date', start90)
          .lte('date', endStr)
          .order('date');
        if (baseErr) {
          console.error(
            `[strain] user ${uid} baseline query failed, EWMA will fall back to empty history:`,
            baseErr.message
          );
        }

        const baseByDate: Record<string, OuraDailySummaryRow> = {};
        const sleepByDate: Record<string, number> = {};
        for (const row of (base || []) as OuraDailySummaryRow[]) {
          baseByDate[row.date] = row;
          if (row.total_sleep_hours != null) sleepByDate[row.date] = Number(row.total_sleep_hours);
        }

        const { data: respBase } = await supabase
          .from('oura_enhanced')
          .select('date, sleep_average_breath, temperature_deviation')
          .eq('user_id', uid)
          .gte('date', start90)
          .lte('date', endStr)
          .order('date');

        const respByDate: Record<string, number | null> = {};
        const skinTempByDate: Record<string, number | null> = {};
        for (const row of (respBase || []) as { date: string; sleep_average_breath: number | null; temperature_deviation: number | null }[]) {
          respByDate[row.date] = row.sleep_average_breath != null ? Number(row.sleep_average_breath) : null;
          skinTempByDate[row.date] = row.temperature_deviation != null ? Number(row.temperature_deviation) : null;
        }

        // Dynamic baseline provider to prevent future leak in backfills
        const getBaselinesForDate = (targetDate: string) => {
          const hrvVals = (base || [])
            .filter((r) => r.date < targetDate)
            .map((r) => r.hrv_avg)
            .filter((v): v is number => v != null);
          const rhrVals = (base || [])
            .filter((r) => r.date < targetDate)
            .map((r) => r.rhr_avg)
            .filter((v): v is number => v != null);
          const sleepScoreVals = (base || [])
            .filter((r) => r.date < targetDate)
            .map((r) => r.sleep_score)
            .filter((v): v is number => v != null);

          const hrvEwma = ewmaBaseline(hrvVals, 5, 250, 5.0);
          const rhrEwma = ewmaBaseline(rhrVals, 30, 120, 2.0);
          const sleepScoreEwma = ewmaBaseline(sleepScoreVals, 0, 100, 5.0);

          const respVals = (respBase || [])
            .filter((r) => r.date < targetDate)
            .map((r) => r.sleep_average_breath)
            .filter((v): v is number => v != null);
          const respEwma = ewmaBaseline(respVals, 4, 40, 0.5);

          const hrvBase = hrvVals.length ? hrvVals.reduce((x, y) => x + y, 0) / hrvVals.length : null;
          const rhrBase = rhrVals.length ? rhrVals.reduce((x, y) => x + y, 0) / rhrVals.length : null;

          return { hrvEwma, rhrEwma, sleepScoreEwma, respEwma, hrvBase, rhrBase };
        };

        // Strain history for ReadinessEngine (last 30 days, pre-existing rows)
        const { data: strainHistRows } = await supabase
          .from('daily_strain')
          .select('date, strain_score')
          .eq('user_id', uid)
          .gte('date', start30)
          .lte('date', endStr)
          .order('date');
        const strainHistRunning: Array<{ date: string; strain_score: number | null }> = [
          ...(strainHistRows || []),
        ];

        // ── Źródła w oknie (z buforem -1 dnia na "wczoraj") ──
        const winStart = dateFrom
          ? toWarsaw(new Date(startDate.getTime() - 1 * 864e5))
          : toWarsaw(new Date(now.getTime() - (days + 1) * 864e5));
        const [zonesR, enhR, summR, nutrR, wsR, stravaR, foodR, behaviorR, reconR] = await Promise.all([
          supabase
            .from('oura_hr_zones_daily')
            .select('day, z1_regen_min, z2_tlenowa_min, z3_tempo_min, z4_prog_min, z5_max_min, hr_max')
            .eq('user_id', uid)
            .gte('day', winStart),
          supabase.from('oura_enhanced').select('date, steps, resilience_level').eq('user_id', uid).gte('date', winStart),
          supabase
            .from('oura_daily_summary')
            .select('date, readiness_score, hrv_avg, rhr_avg, total_sleep_hours, sleep_score')
            .eq('user_id', uid)
            .gte('date', winStart),
          supabase.from('daily_nutrition').select('date, calories, protein, carbs').eq('user_id', uid).gte('date', winStart),
          supabase
            .from('workout_sessions')
            .select('date, exercise_logs(exercise_name, rpe, rir, reps)')
            .eq('user_id', uid)
            .gte('date', winStart),
          supabase
            .from('strava_activities_clean')
            .select('start_date, perceived_exertion, has_pr, sport_type, is_oura')
            .eq('user_id', uid)
            .eq('is_oura', false)
            .gte('start_date', winStart + 'T00:00:00'),
          supabase
            .from('daily_food_entries')
            .select('name, logged_at, date')
            .eq('user_id', uid)
            .gte('date', winStart)
            .not('logged_at', 'is', null),
          supabase.from('behavior_log').select('date, behavior_key, value').eq('user_id', uid).gte('date', winStart),
          supabase.from('daily_reconciliations').select('date, day_score').eq('user_id', uid).gte('date', winStart),
        ]);

        const zones = byKey(zonesR.data as OuraHrZonesDailyRow[], (r) => r.day);
        const enh = byKey(enhR.data as OuraEnhancedRow[], (r) => r.date);
        const summ = byKey(summR.data as OuraDailySummaryRow[], (r) => r.date);
        const nutr = byKey(nutrR.data as DailyNutritionRow[], (r) => r.date);
        const workouts = byKey(wsR.data as WorkoutSessionRow[], (r) => r.date);
        const strava = byKey(stravaR.data as StravaActivityRow[], (r) => warsawDate(r.start_date));
        const food = byKey(foodR.data as DailyFoodEntryRow[], (r) => r.date);
        const recon = byKey(reconR.data as DailyReconciliationRow[], (r) => r.date);

        const ILLNESS_KEYS = /chorob|illness|unwell|sick|przezi|grypa|flu/i;
        // value: 1=lekki(-5), 2=wyraźny(-10), 3=pełna choroba(-18), null=lekki(-5)
        const illnessDates = new Map<string, number>();
        for (const row of (behaviorR.data || []) as BehaviorLogRow[]) {
          if (ILLNESS_KEYS.test(row.behavior_key)) {
            const severity = Number(row.value) || 1;
            const penalty = severity >= 3 ? 18 : severity >= 2 ? 10 : 5;
            illnessDates.set(row.date, penalty);
          }
        }

        // ── Iteracja chronologiczna ──
        const dayList: string[] = [];
        for (let t = new Date(startStr).getTime(); t <= new Date(endStr).getTime(); t += 864e5) {
          dayList.push(new Date(t).toISOString().split('T')[0]);
        }

        const upserts = [];

        for (const date of dayList) {
          const { hrvEwma, rhrEwma, sleepScoreEwma, respEwma, hrvBase, rhrBase } = getBaselinesForDate(date);

          const fuelingProvisional = date === todayWarsaw;
          const z = zones[date]?.[0] || null;
          const e = enh[date]?.[0] || null;
          const s = summ[date]?.[0] || null;
          const n = nutr[date]?.[0] || null;
          const wsets = (workouts[date] || []).flatMap((w) => w.exercise_logs || []);
          const runs = strava[date] || [];
          const recRow = recon[date]?.[0] || null;
          const subjectiveScore = recRow?.day_score != null ? Number(recRow.day_score) : null;

          const kcal = n?.calories ?? null;
          const carbs = n?.carbs != null ? Number(n.carbs) : null;
          const protein = n?.protein != null ? Number(n.protein) : null;
          const sleep = s?.total_sleep_hours ?? null;

          const respToday = respByDate[date] ?? null;
          const skinTempToday = skinTempByDate[date] ?? null;

          const strainScoreResult = computeStrainScore({
            z,
            runs,
            wsets,
            steps: e?.steps ?? null,
            kcal,
            carbs,
            protein,
            fuelingProvisional,
            weight,
          });

          const recoveryScoreResult = computeRecoveryScore({
            sleep,
            sleepByDate,
            date,
            respToday,
            skinTempToday,
            hrvAvg: s?.hrv_avg ?? null,
            rhrAvg: s?.rhr_avg ?? null,
            sleepScore: s?.sleep_score ?? null,
            readinessScore: s?.readiness_score ?? null,
            hrvEwma,
            rhrEwma,
            sleepScoreEwma,
            respEwma,
            hrvBase,
            rhrBase,
            subjectiveScore,
            ageYears,
            sex,
            steps: e?.steps ?? null,
          });

          let recovery = recoveryScoreResult.recovery;
          const strain = strainScoreResult.strain;
          const fuelingScore = strainScoreResult.fuelingScore;
          const hadLoad = strainScoreResult.cardioRaw > 80 || strainScoreResult.strengthPts > 30;

          // ── STATUS ──
          let status = 'yellow';
          if (
            (recovery != null && recovery < 55) ||
            (strain != null && strain > 15 && recovery != null && recovery < 70) ||
            (fuelingScore != null && fuelingScore < 40 && hadLoad && !fuelingProvisional)
          ) {
            status = 'red';
          } else if (recovery != null && recovery >= 75 && (strain == null || strain < 14)) {
            status = 'green';
          }

          // ── MAIN LIMITER ──
          const mentalLoad: number | null = null;

          let limiter = 'recovery_ok';
          if (hadLoad && kcal != null && kcal < 1700 && !fuelingProvisional) limiter = 'calories';
          else if (strainScoreResult.isRunDay && carbs != null && carbs < 150 && !fuelingProvisional) limiter = 'carbs';
          else if (sleep != null && sleep < 6.0) limiter = 'sleep';
          else if (strain != null && strain > 15 && recovery != null && recovery < 65) {
            limiter = strainScoreResult.cardioRaw >= strainScoreResult.strengthPts ? 'cardio_load' : 'strength_load';
          } else if (mentalLoad != null && mentalLoad >= 7) limiter = 'mental_load';
          else if (sleep != null && sleep < 6.8) limiter = 'sleep';
          else if (kcal != null && kcal < 1500 && !fuelingProvisional) limiter = 'calories';

          // ── ILLNESS OVERRIDE — subiektywne objawy z behavior_log ──
          const illnessPenalty = illnessDates.get(date) ?? 0;
          const isIll = illnessPenalty > 0;
          if (isIll) {
            if (recovery != null) recovery = clamp(recovery - illnessPenalty, 0, 100);
            limiter = 'illness';
            status = status === 'green' ? 'yellow' : 'red';
          }

          // ── EXPLANATION (regułowa) ──
          const parts: string[] = [];
          if (strainScoreResult.isRunDay) parts.push('bieg');
          if (strainScoreResult.strengthPts > 0) parts.push('siłownia');
          if (e?.steps != null && e.steps >= 12000) parts.push(`${Math.round(e.steps / 1000)}k kroków`);
          if (kcal != null) parts.push(`${kcal} kcal`);
          const ctx = parts.join(' + ') || 'dzień regeneracyjny';
          const limiterPL: Record<string, string> = {
            sleep: 'głównym ograniczeniem jest sen',
            calories: 'za mało kalorii względem obciążenia',
            carbs: 'za mało węgli w dzień biegowy',
            cardio_load: 'wysoki koszt sercowo-naczyniowy',
            strength_load: 'ciężka sesja siłowa',
            mental_load: 'wysokie obciążenie mentalne',
            recovery_ok: 'regeneracja OK',
            illness: 'choroba/infekcja — ogranicz obciążenie',
          };
          const explanation =
            `${ctx}. Strain ${strain ?? '—'}/21, recovery ${recovery ?? '—'} — ${limiterPL[limiter]}.` +
            (isIll ? ' ⚠ choroba zalogowana.' : '') +
            (fuelingProvisional ? ' (fueling jeszcze niepełny)' : '');

          // ── READINESS LEVEL (NOOP ReadinessEngine port) ──────────────────────
          const strainByDate: Record<string, number | null> = {};
          for (const row of strainHistRunning) {
            strainByDate[row.date] = row.strain_score == null ? null : Number(row.strain_score);
          }
          strainByDate[date] = strain;

          const readinessDates = new Set<string>([
            ...Object.keys(baseByDate),
            ...Object.keys(respByDate),
            ...Object.keys(strainByDate),
            date,
          ]);
          const readinessDays: ReadinessDay[] = [...readinessDates]
            .filter((d) => d <= date)
            .map((d) => ({
              date: d,
              hrv:
                d === date && s?.hrv_avg != null
                  ? Number(s.hrv_avg)
                  : baseByDate[d]?.hrv_avg != null
                  ? Number(baseByDate[d].hrv_avg)
                  : null,
              rhr:
                d === date && s?.rhr_avg != null
                  ? Number(s.rhr_avg)
                  : baseByDate[d]?.rhr_avg != null
                  ? Number(baseByDate[d].rhr_avg)
                  : null,
              respRate: respByDate[d] ?? null,
              strain: strainByDate[d] ?? null,
            }));
          const readiness = computeReadiness(readinessDays, date);

          // ── CAFFEINE DECAY (4.16) half-life 5.5h; inferred from food names ──
          const refTs = date === todayWarsaw ? now.getTime() : new Date(date + 'T22:00:00').getTime();
          let caffeineActiveMg = 0;
          for (const entry of food[date] || []) {
            const mg = estimateCaffeineMg(entry.name);
            if (mg === 0 || !entry.logged_at) continue;
            const hoursElapsed = (refTs - new Date(entry.logged_at).getTime()) / 3600000;
            if (hoursElapsed < 0 || hoursElapsed > 24) continue;
            caffeineActiveMg += mg * Math.pow(0.5, hoursElapsed / 5.5);
          }
          caffeineActiveMg = Math.round(caffeineActiveMg);
          const caffeineAlert = caffeineActiveMg > 25;

          // ── HYDRATION GOAL (4.16) sex baseline + effort scalar ──
          const hydrationGoalMl = (sex === 'F' ? 2700 : 3700) + Math.round((strain ?? 0) / 21 * 700);

          const row = {
            user_id: uid,
            date,
            strain_score: strain,
            recovery_score: recovery,
            fueling_score: fuelingScore,
            mental_load_score: mentalLoad,
            daily_status: status,
            main_limiter: limiter,
            fueling_provisional: fuelingProvisional,
            readiness_level: readiness.level,
            explanation,
            algo_version: algoVersion,
            cardio_load: Math.round(strainScoreResult.cardioRaw * 10) / 10,
            strength_load: strainScoreResult.strengthPts,
            leg_load: strainScoreResult.legPts,
            cns_load: strainScoreResult.cnsPts,
            steps_load: Math.round(strainScoreResult.stepsLoad * 10) / 10,
            fueling_penalty: strainScoreResult.fuelingPenalty,
            components: {
              zones: z || null,
              raw_total: Math.round(strainScoreResult.rawTotal * 10) / 10,
              run_rpe: strainScoreResult.maxRpe || null,
              pr: strainScoreResult.hasPr || null,
              weight,
              kcal,
              carbs,
              protein,
              steps: e?.steps ?? null,
              sleep_h: sleep,
              hrv_base: hrvEwma ? Math.round(hrvEwma.center) : hrvBase ? Math.round(hrvBase) : null,
              rhr_base: rhrEwma ? Math.round(rhrEwma.center) : rhrBase ? Math.round(rhrBase) : null,
              hrv_ewma_nValid: hrvEwma?.nValid ?? null,
              resp_base: respEwma ? Math.round(respEwma.center * 10) / 10 : null,
              resp_today: respToday,
              skin_temp_dev_today: skinTempToday,
              readiness_signals: readiness.signals,
              recovery_confidence: recoveryScoreResult.recoveryConfidence,
              strain_confidence: strainScoreResult.strainConfidence,
              wellness_load: strainScoreResult.wellnessPts > 0 ? Math.round(strainScoreResult.wellnessPts * 10) / 10 : null,
              caffeine_active_mg: caffeineActiveMg > 0 ? caffeineActiveMg : null,
              caffeine_alert: caffeineAlert || null,
              hydration_goal_ml: hydrationGoalMl,
              fitness_age: recoveryScoreResult.fitnessAge,
              body_age: recoveryScoreResult.bodyAge,
              vitality_score: recoveryScoreResult.vitalityScore,
              sleep_debt_h: recoveryScoreResult.sleepDebtH,
              hrv_z: recoveryScoreResult.zHrv != null ? Math.round(recoveryScoreResult.zHrv * 100) / 100 : null,
              rhr_z: recoveryScoreResult.zRhr != null ? Math.round(recoveryScoreResult.zRhr * 100) / 100 : null,
              sleep_score_today: s?.sleep_score != null ? Number(s.sleep_score) : null,
              sleep_z: recoveryScoreResult.zSleepScore,
            },
            updated_at: new Date().toISOString(),
          };
          upserts.push(row);

          // Update running strain history for next day's ReadinessEngine
          if (strain != null) {
            strainHistRunning.push({ date, strain_score: strain });
          }
        }

        if (upserts.length) {
          const { error: upErr } = await supabase
            .from('daily_strain')
            .upsert(upserts, { onConflict: 'user_id,date' });
          if (upErr) return { user_id: uid, error: upErr.message };
        }
        return { user_id: uid, days: upserts.length, latest: upserts[upserts.length - 1] };
      } catch (error: any) {
        console.error(`[strain] user ${uid} failed`, error);
        return { user_id: uid, error: error.message || String(error) };
      }
    };

    const results = await Promise.all((users || []).map(computeForUser));
    const scopedError = scopedUserId && results.length === 1 && results[0]?.error;

    return new Response(JSON.stringify({ success: !scopedError, results, error: scopedError || undefined }), {
      status: scopedError ? 400 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[strain] fatal', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
