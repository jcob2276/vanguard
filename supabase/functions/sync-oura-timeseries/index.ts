
import { createServiceClient } from "../_shared/supabase.ts"
import { resolveUserScope } from "../_shared/supabase.ts"

const OURA_BASE = 'https://api.ouraring.com/v2/usercollection'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PHASE_MAP: Record<string, string> = { '1': 'deep', '2': 'light', '3': 'rem', '4': 'awake' }

const serviceClient = createServiceClient

// Podąża za next_token aż do końca. Cap stron na wszelki wypadek.
async function fetchAllPages(baseUrl: string, headers: Record<string, string>, maxPages = 120): Promise<any[]> {
  let all: any[] = []
  let token: string | null = null
  let pages = 0
  do {
    const url: string = token
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}next_token=${encodeURIComponent(token)}`
      : baseUrl
    try {
      const res: Response = await fetch(url, { headers })
      if (!res.ok) { console.warn(`[ts] ${baseUrl} -> ${res.status}`); break }
      const j: any = await res.json()
      if (Array.isArray(j.data)) all = all.concat(j.data)
      token = j.next_token || null
    } catch (e: any) {
      console.warn(`[ts] fetch failed ${baseUrl}: ${e.message}`); break
    }
    pages++
  } while (token && pages < maxPages)
  return all
}

// Rozwija obiekt { interval, items, timestamp } w listę { ts, value }
function expandSeries(obj: any): Array<{ ts: string, value: number }> {
  if (!obj || !Array.isArray(obj.items) || !obj.timestamp) return []
  const start = new Date(obj.timestamp).getTime()
  const interval = (obj.interval || 300) * 1000
  const out: Array<{ ts: string, value: number }> = []
  obj.items.forEach((v: any, i: number) => {
    if (v === null || v === undefined) return
    out.push({ ts: new Date(start + i * interval).toISOString(), value: v })
  })
  return out
}

// Rozwija string hipnogramu (sleep_phase_5_min) w fazy co 5 min
function expandPhase(str: string, timestamp: string, intervalSec = 300) {
  if (!str || !timestamp) return []
  const start = new Date(timestamp).getTime()
  const out: Array<{ ts: string, phase: string | null, phase_code: number | null }> = []
  for (let i = 0; i < str.length; i++) {
    const code = str[i]
    out.push({
      ts: new Date(start + i * intervalSec * 1000).toISOString(),
      phase: PHASE_MAP[code] || null,
      phase_code: parseInt(code) || null,
    })
  }
  return out
}

// heartrate endpoint odrzuca duże zakresy — pobieramy w oknach po N dni
async function fetchHeartrateWindowed(
  headers: Record<string, string>, startMs: number, endMs: number, windowDays = 7
): Promise<any[]> {
  let all: any[] = []
  const step = windowDays * 24 * 3600 * 1000
  for (let s = startMs; s < endMs; s += step) {
    const ws = new Date(s).toISOString()
    const we = new Date(Math.min(s + step, endMs)).toISOString()
    const url = `${OURA_BASE}/heartrate?start_datetime=${encodeURIComponent(ws)}&end_datetime=${encodeURIComponent(we)}`
    all = all.concat(await fetchAllPages(url, headers))
  }
  return all
}

function avgOf(obj: any): number | null {
  if (!obj || !Array.isArray(obj.items)) return null
  const vals = obj.items.filter((v: any) => v !== null && v !== undefined)
  if (!vals.length) return null
  return vals.reduce((a: number, b: number) => a + b, 0) / vals.length
}

async function upsertChunked(
  supabase: any, table: string, rows: any[], conflict: string, ignoreDuplicates = true, chunkSize = 500
): Promise<number> {
  let n = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: conflict, ignoreDuplicates })
    if (error) { console.error(`[ts] ${table} upsert error`, error); throw new Error(`${table}: ${error.message}`) }
    n += chunk.length
  }
  return n
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = serviceClient()
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 2
    const { userId: scopedUserId } = await resolveUserScope(req, body.userId ?? null)
    const onlyUserId: string | null = scopedUserId

    let query = supabase
      .from('user_settings')
      .select('user_id, oura_token')
      .not('oura_token', 'is', null)
    if (onlyUserId) query = query.eq('user_id', onlyUserId)

    const { data: users, error: usersErr } = await query
    if (usersErr) throw usersErr

    const now = new Date()
    const endDate = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0]
    const startDate = new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString().split('T')[0]
    const dateRange = `start_date=${startDate}&end_date=${endDate}`
    const startDt = new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString()
    const endDt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString()

    const results: any[] = []

    for (const u of (users || [])) {
      const headers = { 'Authorization': `Bearer ${u.oura_token}` }
      const uid = u.user_id
      const counts: Record<string, number> = {}

      // ── 1. heartrate (high-res, paginowane, w oknach 7-dniowych) ──────────
      const hr = await fetchHeartrateWindowed(
        headers,
        new Date(startDt).getTime(),
        new Date(endDt).getTime(),
        7
      )
      const hrRows = hr
        .filter((it: any) => it.timestamp && it.bpm != null)
        .map((it: any) => ({ user_id: uid, ts: it.timestamp, bpm: it.bpm, source: it.source || null }))
      counts.heartrate = hrRows.length ? await upsertChunked(supabase, 'oura_heartrate', hrRows, 'user_id,ts,source') : 0

      // ── 2-4. sleep → hr / hrv / phase timelines ───────────────────────────
      const sleepPeriods = await fetchAllPages(`${OURA_BASE}/sleep?${dateRange}`, headers)
      const sleepHrRows: any[] = []
      const sleepHrvRows: any[] = []
      const sleepPhaseRows: any[] = []
      for (const sp of sleepPeriods) {
        const sleepId = sp.id
        if (!sleepId) continue
        const day = sp.day || null

        expandSeries(sp.heart_rate).forEach(p =>
          sleepHrRows.push({ user_id: uid, sleep_id: sleepId, day, ts: p.ts, bpm: p.value }))
        expandSeries(sp.hrv).forEach(p =>
          sleepHrvRows.push({ user_id: uid, sleep_id: sleepId, day, ts: p.ts, hrv: p.value }))
        if (sp.sleep_phase_5_min && sp.bedtime_start) {
          expandPhase(sp.sleep_phase_5_min, sp.bedtime_start).forEach(p =>
            sleepPhaseRows.push({ user_id: uid, sleep_id: sleepId, day, ts: p.ts, phase: p.phase, phase_code: p.phase_code }))
        }
      }
      counts.sleep_hr = sleepHrRows.length ? await upsertChunked(supabase, 'oura_sleep_hr_timeline', sleepHrRows, 'user_id,sleep_id,ts') : 0
      counts.sleep_hrv = sleepHrvRows.length ? await upsertChunked(supabase, 'oura_sleep_hrv_timeline', sleepHrvRows, 'user_id,sleep_id,ts') : 0
      counts.sleep_phase = sleepPhaseRows.length ? await upsertChunked(supabase, 'oura_sleep_phase_timeline', sleepPhaseRows, 'user_id,sleep_id,ts') : 0

      // ── 5. daily_activity (removed as unused MET timeline) ───────────────

      // ── 6. workouts ───────────────────────────────────────────────────────
      const workouts = await fetchAllPages(`${OURA_BASE}/workout?${dateRange}`, headers)
      const workoutRows = workouts.map((w: any) => ({
        user_id: uid,
        oura_id: w.id || `${w.start_datetime || ''}_${w.activity || ''}`,
        day: w.day || null,
        activity: w.activity || null,
        intensity: w.intensity || null,
        calories: w.calories ?? null,
        distance: w.distance ?? null,
        start_datetime: w.start_datetime || null,
        end_datetime: w.end_datetime || null,
        label: w.label || null,
        source: w.source || null,
      }))
      counts.workouts = workoutRows.length ? await upsertChunked(supabase, 'oura_workouts', workoutRows, 'user_id,oura_id', false) : 0

      // ── 7. sessions ────────────────────────────────────────────────────────
      const sessions = await fetchAllPages(`${OURA_BASE}/session?${dateRange}`, headers)
      const sessionRows = sessions.map((s: any) => ({
        user_id: uid,
        oura_id: s.id || `${s.start_datetime || ''}_${s.type || ''}`,
        day: s.day || null,
        type: s.type || null,
        start_datetime: s.start_datetime || null,
        end_datetime: s.end_datetime || null,
        avg_heart_rate: avgOf(s.heart_rate),
        avg_hrv: avgOf(s.heart_rate_variability),
        mood: s.mood || null,
        motion_count: s.motion_count ?? null,
        raw: s,
      }))
      counts.sessions = sessionRows.length ? await upsertChunked(supabase, 'oura_sessions', sessionRows, 'user_id,oura_id', false) : 0

      // ── 8. Prune high-res timeseries older than 14 days to prevent bloat ───
      const cutoff = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString()
      const pruneResults = await Promise.all([
        supabase.from('oura_heartrate').delete().eq('user_id', uid).lt('ts', cutoff),
        supabase.from('oura_sleep_hr_timeline').delete().eq('user_id', uid).lt('ts', cutoff),
        supabase.from('oura_sleep_hrv_timeline').delete().eq('user_id', uid).lt('ts', cutoff),
        supabase.from('oura_sleep_phase_timeline').delete().eq('user_id', uid).lt('ts', cutoff),
      ])
      pruneResults.forEach(({ error }, i) => {
        if (error) console.warn(`[ts] Prune table ${i} failed for user ${uid}:`, error.message)
      })

      results.push({ user_id: uid, counts })
    }

    return new Response(JSON.stringify({ success: true, range: { startDate, endDate }, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('[ts] fatal', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
