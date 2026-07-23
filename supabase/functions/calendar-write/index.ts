/**
 * @function calendar-write
 * @trigger HTTP POST / Frontend / manual
 * @role Zapis/aktualizacja wydarzeń w kalendarzu Google oraz bazy danych vanguard_calendar.
 * @reads vanguard_tokens, vanguard_calendar
 * @writes vanguard_calendar
 * @calls googleapis.com/calendar
 * @consumer Kalendarz Google użytkownika
 * @status active
 */
import { safeExecute, createServiceClient } from '../_shared/supabase.ts'
import { serveJson } from '../_shared/http.ts'

async function getAccessToken(userId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null

  const tokenData = await safeExecute(
    supabase
      .from('vanguard_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()
  )
  if (!tokenData?.refresh_token) return null

  try {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    })
    if (!refreshRes.ok) return null
    const { access_token } = await refreshRes.json()
    return access_token ?? null
  } catch {
    return null
  }
}

Deno.serve(serveJson(async (req, ctx) => {
  try {
    const body = await req.clone().json()
    const { action, event, deleteScope } = body

    const userId = ctx.userId
    if (!userId || !action) throw new Error('Missing userId or action')

  if (!['create', 'update', 'delete'].includes(action)) throw new Error('Unknown calendar action')
  if (!event || typeof event !== 'object') throw new Error('Missing calendar event')

  if (action !== 'delete') {
    const start = Date.parse(event.start)
    const end = Date.parse(event.end)
    if (!String(event.summary || '').trim()) throw new Error('Event summary is required')
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Invalid event time range')
    if (event.recurrence != null && (!Array.isArray(event.recurrence) || event.recurrence.some((rule: unknown) => typeof rule !== 'string' || !rule.startsWith('RRULE:')))) {
      throw new Error('Invalid event recurrence')
    }
  }

  const access_token = await getAccessToken(userId)
  const supabase = createServiceClient()

  const gcalBase = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  const headers = access_token
    ? {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      }
    : null

  if (action === 'create') {
    let createdId = event.id || `vanguard-${crypto.randomUUID()}`

    if (headers) {
      try {
        const gcalRes = await fetch(gcalBase, {
          signal: AbortSignal.timeout(15000),
          method: 'POST',
          headers,
          body: JSON.stringify({
            summary: event.summary,
            description: event.description ?? '',
            start: { dateTime: event.start, timeZone: 'Europe/Warsaw' },
            end: { dateTime: event.end, timeZone: 'Europe/Warsaw' },
            ...(event.recurrence?.length ? { recurrence: event.recurrence } : {}),
          }),
        })
        if (gcalRes.ok) {
          const created = await gcalRes.json()
          createdId = created.id ?? createdId
        }
      } catch (gcalErr) {
        console.warn('GCal create skipped:', gcalErr)
      }
    }

    // Upsert into local vanguard_calendar
    await safeExecute(
      supabase.from('vanguard_calendar').upsert({
        user_id: userId,
        event_id: createdId,
        summary: event.summary,
        start_time: event.start,
        end_time: event.end,
        description: event.description ?? null,
        recurrence: event.recurrence ?? null,
        series_id: null,
        category: event.category ?? 'vanguard',
      }, { onConflict: 'event_id' })
    )
    return { success: true, eventId: createdId }
  }

  if (action === 'update') {
    if (!event.id) throw new Error('Missing event.id for update')

    let returnedId = event.id
    let gcalRecurrence: string[] | null = event.recurrence ?? null

    if (headers) {
      try {
        const getRes = await fetch(`${gcalBase}/${event.id}`, {
          signal: AbortSignal.timeout(10000),
          method: 'GET',
          headers,
        })
        if (getRes.ok) {
          const existing = await getRes.json()
          const putBody: Record<string, unknown> = {
            ...existing,
            summary: event.summary,
            description: event.description ?? existing.description ?? '',
            start: { dateTime: event.start, timeZone: 'Europe/Warsaw' },
            end: { dateTime: event.end, timeZone: 'Europe/Warsaw' },
          }

          if (event.recurrence?.length) {
            putBody.recurrence = event.recurrence
          } else if (event.recurrence === null) {
            delete putBody.recurrence
          }

          const gcalRes = await fetch(`${gcalBase}/${event.id}`, {
            signal: AbortSignal.timeout(15000),
            method: 'PUT',
            headers,
            body: JSON.stringify(putBody),
          })
          if (gcalRes.ok) {
            const updated = await gcalRes.json()
            returnedId = updated.id ?? event.id
            gcalRecurrence = updated.recurrence ?? gcalRecurrence
          }
        }
      } catch (gcalErr) {
        console.warn('GCal update skipped:', gcalErr)
      }
    }

    // Update the local row in vanguard_calendar
    if (returnedId !== event.id) {
      await safeExecute(
        supabase.from('vanguard_calendar').delete()
          .eq('user_id', userId).eq('event_id', event.id)
      )
    }
    await safeExecute(
      supabase.from('vanguard_calendar').upsert({
        user_id: userId,
        event_id: returnedId,
        summary: event.summary,
        start_time: event.start,
        end_time: event.end,
        description: event.description ?? null,
        recurrence: gcalRecurrence,
        series_id: null,
        category: event.category ?? 'vanguard',
      }, { onConflict: 'event_id' })
    )
    return { success: true, eventId: returnedId }
  }

  if (action === 'delete') {
    if (!event.id) throw new Error('Missing event.id for delete')

    if (headers) {
      try {
        await fetch(`${gcalBase}/${event.id}`, {
          signal: AbortSignal.timeout(15000),
          method: 'DELETE',
          headers,
        })
      } catch (gcalErr) {
        console.warn('GCal delete skipped:', gcalErr)
      }
    }

    await safeExecute(
      supabase
        .from('vanguard_calendar')
        .delete()
        .eq('user_id', userId)
        .eq('event_id', event.id)
    )

    if (deleteScope === 'all') {
      await safeExecute(
        supabase
          .from('vanguard_calendar')
          .delete()
          .eq('user_id', userId)
          .like('event_id', `${event.id}_%`)
      )
    }

    return { success: true }
  }

  throw new Error(`Unknown action: ${action}`)
  } catch (err: any) {
    console.error('calendar-write error:', err)
    throw new Error(err.message || String(err))
  }
}))

