/**
 * @function sync
 * @trigger HTTP POST / manual / cron
 * @role Router dla synchronizacji zewnętrznych API: Oura, Strava, Google Calendar.
 * @reads oura_daily_summary, strava_activities, vanguard_calendar, user_settings, vanguard_tokens, oura_enhanced, strava_tokens, intervals_tokens, oura_heartrate, oura_sleep_hr_timeline, oura_sleep_hrv_timeline, oura_sleep_phase_timeline
 * @writes oura_daily_summary, strava_activities, vanguard_calendar, audit_events, oura_enhanced, oura_heartrate, oura_sleep_phase_timeline, strava_tokens, vanguard_tokens
 * @calls ouraring.com, strava.com, googleapis.com/calendar, api.telegram.org (poprzez send.ts)
 * @consumer Zaktualizowane dane biometryczne, treningowe i kalendarza w aplikacji
 * @status active
 */
import { resolveUserScope } from '../_shared/supabase.ts'
import { serveJson } from '../_shared/http.ts'
import { runOuraSync } from './oura.ts'
import { runStravaSync } from './strava.ts'
import { runCalendarSync } from './calendar.ts'

Deno.serve(serveJson(async (req) => {
  const url = new URL(req.url)
  const body = (req.method === 'POST' || req.method === 'PUT')
    ? await req.clone().json().catch(() => ({}))
    : {}
  const userId = url.searchParams.get('userId') || body.userId

  await resolveUserScope(req, userId ?? null)

  // Check searchParams first, then fall back to body JSON if request has payload
  let service = url.searchParams.get('service')

  if (!service && (req.method === 'POST' || req.method === 'PUT')) {
    // Clone req to allow body parsing without consuming the stream for downstream handlers
    const body = await req.clone().json().catch(() => ({}))
    service = body.service
  }

  if (service === 'oura') {
    return await runOuraSync(req)
  } else if (service === 'strava') {
    return await runStravaSync(req)
  } else if (service === 'calendar') {
    return await runCalendarSync(req)
  } else {
    throw new Error(`Unknown or missing service parameter: ${service}`)
  }
}, { auth: 'none' }))
