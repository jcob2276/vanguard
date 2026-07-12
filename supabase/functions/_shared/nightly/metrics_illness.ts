// Etap 4 (docs/PLAN_READINESS_NOOP.md, sekcja 4.4): NOOP port IllnessSignalEngine.
// Multi-signal anomaly (RHR↑, skin temp↑, HRV↓, resp↑) z confounder suppression —
// alert wycisza się jeśli behavior_log/exercise_logs (sauna) wyjaśnia anomalię tego dnia.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWarsawDateString } from '../time.ts'
import { ewmaBaseline } from './baselines.ts'


const SIGMA = 1.253
const Z_THRESHOLD = 2.0, K_Z_TO_SCORE = 22.0, PER_SIGNAL_CAP = 40.0
const CONFOUNDER_DAMPEN = 0.45
const RAISE_THRESHOLD = 50.0, MILD_THRESHOLD = 25.0

const CONFOUNDER_KEYS = /alkohol|alcohol|podroz|podróż|travel|stres|stress|sauna/i
const UNWELL_KEYS = /chorob|illness|unwell|sick|przezi|grypa|flu/i

export const runComputeIllnessSignal = async (
  supabase: SupabaseClient,
  scopedUserId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  days: number,
  algoVersion: number
): Promise<{ success: boolean; results: any[] }> => {
  let uq = supabase.from('user_settings').select('user_id').not('oura_token', 'is', null)
  if (scopedUserId) uq = uq.eq('user_id', scopedUserId)
  const { data: users, error: uErr } = await uq
  if (uErr) throw uErr

    const now = new Date()
    const toWarsaw = getWarsawDateString
    const endStr = dateTo || toWarsaw(now)
    const startStr = dateFrom || toWarsaw(new Date(now.getTime() - days * 86400000))
    
    // Calculate start limits relative to startStr
    const startDate = new Date(startStr + 'T12:00:00Z')
    const start90 = toWarsaw(new Date(startDate.getTime() - 90 * 86400000))

    const results: any[] = []
    for (const u of (users || [])) {
      const uid = u.user_id
      try {
        // ── Baseline (90 dni) dla HRV/RHR/resp ──
        const { data: base } = await supabase.from('oura_daily_summary')
          .select('date, hrv_avg, rhr_avg')
          .eq('user_id', uid)
          .gte('date', start90)
          .lte('date', endStr)
          .order('date')

        const { data: enh } = await supabase.from('oura_enhanced')
          .select('date, sleep_average_breath, temperature_deviation')
          .eq('user_id', uid)
          .gte('date', start90)
          .lte('date', endStr)
          .order('date')

        const enhByDate: Record<string, Record<string, unknown>> = {}
        for (const row of (enh || []) as Record<string, unknown>[]) enhByDate[row.date as string] = row
        const baseByDate: Record<string, Record<string, unknown>> = {}
        for (const row of (base || []) as Record<string, unknown>[]) baseByDate[row.date as string] = row

        // Dynamic baseline provider to prevent future leak in backfills
        const getBaselinesForDate = (targetDate: string) => {
          const hrvVals = (base || []).filter((r: any) => r.date < targetDate).map((r: any) => r.hrv_avg).filter((v: any): v is number => v != null);
          const rhrVals = (base || []).filter((r: any) => r.date < targetDate).map((r: any) => r.rhr_avg).filter((v: any): v is number => v != null);
          const respVals = (enh || []).filter((r: any) => r.date < targetDate).map((r: any) => r.sleep_average_breath).filter((v: any): v is number => v != null);

          const hrvEwma = ewmaBaseline(hrvVals, 5, 250, 5.0);
          const rhrEwma = ewmaBaseline(rhrVals, 30, 120, 2.0);
          const respEwma = ewmaBaseline(respVals, 4, 40, 0.5);

          return { hrvEwma, rhrEwma, respEwma };
        };

        // ── Confounders: behavior_log + sauna z exercise_logs, w oknie ──
        const { data: behaviorRows } = await supabase.from('behavior_log')
          .select('date, behavior_key').eq('user_id', uid).gte('date', startStr)
        const { data: saunaRows } = await supabase
          .from('exercise_logs').select('exercise_name, session_id, workout_sessions!inner(date, user_id)')
          .eq('workout_sessions.user_id', uid)
          .ilike('exercise_name', 'sauna%')

        const confounderDates = new Set<string>()
        const unwellDates = new Set<string>()
        for (const row of (behaviorRows || []) as Record<string, unknown>[]) {
          if (CONFOUNDER_KEYS.test(row.behavior_key as string)) confounderDates.add(row.date as string)
          if (UNWELL_KEYS.test(row.behavior_key as string)) unwellDates.add(row.date as string)
        }
        for (const row of (saunaRows || []) as Record<string, unknown>[]) {
          const d = (row.workout_sessions as Record<string, unknown>)?.date as string | undefined
          if (d && d >= startStr && d <= endStr) confounderDates.add(d)
        }

        const dayList: string[] = []
        for (let t = new Date(startStr).getTime(); t <= new Date(endStr).getTime(); t += 86400000) {
          dayList.push(new Date(t).toISOString().split('T')[0])
        }

        const updates: any[] = []
        for (const date of dayList) {
          const { hrvEwma, rhrEwma, respEwma } = getBaselinesForDate(date)
          const baselineTrusted = (hrvEwma?.nValid ?? 0) >= 4

          const s = baseByDate[date]
          const e = enhByDate[date]
          if (!baselineTrusted || !s?.hrv_avg || !s?.rhr_avg) {
            updates.push({ date, illness_score: null, illness_level: 'quiet' })
            continue
          }

          // z_illnessward: HRV inwertowane (niższe = gorzej), RHR/resp/skinTemp wprost (wyższe = gorzej)
          const zHrvIll = hrvEwma ? -((Number(s.hrv_avg) - hrvEwma.center) / Math.max(SIGMA * hrvEwma.spread, 1e-9)) : null
          const zRhrIll = rhrEwma ? ((Number(s.rhr_avg) - rhrEwma.center) / Math.max(SIGMA * rhrEwma.spread, 1e-9)) : null
          const zRespIll = (respEwma && e?.sleep_average_breath != null)
            ? ((Number(e.sleep_average_breath) - respEwma.center) / Math.max(SIGMA * respEwma.spread, 1e-9))
            : null
          const zSkinIll = e?.temperature_deviation != null ? (Number(e.temperature_deviation) / 0.3) : null

          const signals = [zHrvIll, zRhrIll, zRespIll, zSkinIll].filter((v): v is number => v != null)
          const firing = signals.filter(z => z >= Z_THRESHOLD).length
          const rawScore = signals.reduce((sum, z) => sum + Math.min(PER_SIGNAL_CAP, K_Z_TO_SCORE * Math.max(0, z - Z_THRESHOLD)), 0)
          let score = Math.min(100, rawScore)

          const hasConfounder = confounderDates.has(date)
          if (hasConfounder) score *= CONFOUNDER_DAMPEN

          let level: string
          if (unwellDates.has(date)) level = 'already_unwell'
          else if (score < MILD_THRESHOLD || firing < 2) level = 'quiet'
          else if (hasConfounder) level = 'suppressed'
          else if (score >= RAISE_THRESHOLD) level = 'raised'
          else level = 'mild'

          updates.push({ date, illness_score: Math.round(score * 10) / 10, illness_level: level })
        }

        for (const upd of updates) {
          const { error: updErr } = await supabase.from('daily_strain')
            .update({ illness_score: upd.illness_score, illness_level: upd.illness_level, algo_version: algoVersion })
            .eq('user_id', uid).eq('date', upd.date)
          if (updErr) console.error(`[illness] ${uid} ${upd.date} update failed`, updErr.message)
        }

        results.push({ user_id: uid, days_processed: updates.length })
      } catch (error: any) {
        console.error(`[illness] user ${uid} failed`, error)
        results.push({ user_id: uid, error: error.message || String(error) })
      }
    }

    const scopedError = scopedUserId && results.length === 1 && results[0]?.error;
    if (scopedError) {
      throw new Error(scopedError);
    }
    return { success: true, results };
  };
