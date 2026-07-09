/**
 * @function calendar-write
 * @trigger HTTP POST / Frontend / manual
 * @role Zapis/aktualizacja wydarzeń w kalendarzu Google.
 * @reads vanguard_tokens, vanguard_calendar
 * @writes vanguard_calendar
 * @calls googleapis.com/calendar
 * @consumer Kalendarz Google użytkownika
 * @status active
 */
import { safeExecute, createServiceClient, corsHeaders, resolveUserScope } from '../_shared/supabase.ts'

async function getAccessToken(userId: string): Promise<string> {
  const supabase = createServiceClient()
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

  const tokenData = await safeExecute(
    supabase
      .from('vanguard_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()
  )
  if (!tokenData?.refresh_token) throw new Error('No Google token for user')

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
  if (!refreshRes.ok) throw new Error(`Token refresh failed: ${refreshRes.status}`)
  const { access_token } = await refreshRes.json()
  return access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, event } = body
    // action: 'create' | 'update' | 'delete'
    // event: { id?, summary, start, end, description? }
    //   start/end: ISO datetime string e.g. "2026-07-03T10:00:00+02:00"

    const { userId } = await resolveUserScope(req, body.userId ?? null)
    if (!userId || !action) throw new Error('Missing userId or action')

    const access_token = await getAccessToken(userId)
    const supabase = createServiceClient()

    const gcalBase = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    const headers = {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    }

    if (action === 'create') {
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
      if (!gcalRes.ok) throw new Error(`GCal create failed: ${gcalRes.status}`)
      const created = await gcalRes.json()

      // Upsert into local vanguard_calendar
      await safeExecute(
        supabase.from('vanguard_calendar').upsert({
          user_id: userId,
          event_id: created.id,
          summary: created.summary,
          start_time: event.start,
          end_time: event.end,
          category: event.category ?? 'vanguard',
        }, { onConflict: 'event_id' })
      )
      return new Response(JSON.stringify({ success: true, eventId: created.id }), { headers: corsHeaders })
    }

    if (action === 'update') {
      if (!event.id) throw new Error('Missing event.id for update')

      // Google Calendar API ignores the `recurrence` field on PATCH requests for
      // non-recurring events — only a full PUT (replace) propagates it correctly.
      // We always use PUT here so that adding/removing recurrence works reliably.
      // First fetch the current event to preserve any fields we don't touch.
      const getRes = await fetch(`${gcalBase}/${event.id}`, {
        signal: AbortSignal.timeout(10000),
        method: 'GET',
        headers,
      })
      if (!getRes.ok) throw new Error(`GCal get failed: ${getRes.status}`)
      const existing = await getRes.json()

      // Build the PUT body — merge existing fields with our updates
      const putBody: Record<string, unknown> = {
        ...existing,
        summary: event.summary,
        description: event.description ?? existing.description ?? '',
        start: { dateTime: event.start, timeZone: 'Europe/Warsaw' },
        end: { dateTime: event.end, timeZone: 'Europe/Warsaw' },
      }

      if (event.recurrence?.length) {
        // Adding or replacing recurrence
        putBody.recurrence = event.recurrence
      } else {
        // Explicitly remove recurrence (convert recurring → one-time)
        delete putBody.recurrence
      }

      const gcalRes = await fetch(`${gcalBase}/${event.id}`, {
        signal: AbortSignal.timeout(15000),
        method: 'PUT',
        headers,
        body: JSON.stringify(putBody),
      })
      if (!gcalRes.ok) {
        const errText = await gcalRes.text()
        throw new Error(`GCal update failed: ${gcalRes.status} — ${errText}`)
      }
      const updated = await gcalRes.json()
      const returnedId: string = updated.id ?? event.id

      // Update the local row. If the returned ID differs from the sent ID (rare but
      // possible), delete the stale row and upsert the fresh one so no orphan stays.
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
          category: event.category ?? 'vanguard',
        }, { onConflict: 'event_id' })
      )
      return new Response(JSON.stringify({ success: true, eventId: returnedId }), { headers: corsHeaders })
    }

    if (action === 'delete') {
      if (!event.id) throw new Error('Missing event.id for delete')
      const gcalRes = await fetch(`${gcalBase}/${event.id}`, {
        signal: AbortSignal.timeout(15000),
        method: 'DELETE',
        headers,
      })
      // 204 = deleted, 410 = already gone — both are fine
      if (!gcalRes.ok && gcalRes.status !== 410) throw new Error(`GCal delete failed: ${gcalRes.status}`)

      await safeExecute(
        supabase
          .from('vanguard_calendar')
          .delete()
          .eq('user_id', userId)
          .eq('event_id', event.id)
      )
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    throw new Error(`Unknown action: ${action}`)
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
