import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId, code, redirectUri } = await req.json()
    const supabase = createServiceClient()

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

    // 1. OAUTH EXCHANGE
    if (code) {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { signal: AbortSignal.timeout(15000),
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      })

      const tokens = await tokenResponse.json()
      if (!tokenResponse.ok || tokens.error) {
        throw new Error(`Google OAuth error: ${tokens.error_description || tokens.error || tokenResponse.status}`)
      }
    // OAuth token upsert (nie rzucamy błędem — to opcjonalna operacja)
      if (tokens.refresh_token) {
        await safeExecute(
          supabase.from('vanguard_tokens').upsert({
            user_id: userId,
            provider: 'google',
            refresh_token: tokens.refresh_token
          })
        )
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    // 2. FETCH TOKEN
    const tokenData = await safeExecute(
      supabase
        .from('vanguard_tokens')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle()
    )

    if (!tokenData) return new Response(JSON.stringify({ error: 'No token' }), { status: 400, headers: corsHeaders })

    const refreshRes = await fetch('https://oauth2.googleapis.com/token', { signal: AbortSignal.timeout(15000),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token'
      })
    })

    if (!refreshRes.ok) throw new Error(`Google token refresh failed: ${refreshRes.status}`);
    const { access_token } = await refreshRes.json()

    // Helper to get Warsaw offset (e.g. "+02:00" or "+01:00") dynamically
    const getWarsawOffset = (date: Date): string => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Warsaw',
        timeZoneName: 'longOffset'
      }).formatToParts(date);
      const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+2';
      const cleanOffset = offsetPart.replace('GMT', '');
      if (cleanOffset === 'Z') return '+00:00';
      if (!cleanOffset.includes(':')) {
        const sign = cleanOffset[0];
        const val = cleanOffset.substring(1).padStart(2, '0');
        return `${sign}${val}:00`;
      }
      return cleanOffset;
    };

    // 3. SYNC CALENDAR (INTENTIONS)
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('sv', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Find Monday of the current week in Warsaw time context.
    // `now.getDay()` would reflect the server runtime's timezone (typically UTC),
    // which can disagree with Warsaw's weekday near the UTC midnight boundary —
    // anchor the weekday lookup to the Warsaw calendar date instead.
    const warsawTodayStr = formatter.format(now);
    const currentDay = new Date(warsawTodayStr + 'T12:00:00').getDay();
    const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(warsawTodayStr + 'T12:00:00');
    monday.setDate(monday.getDate() + daysToMonday);
    const warsawMondayStr = formatter.format(monday);
    
    // Find Sunday of the next week (+13 days from Monday)
    const sundayNext = new Date(monday);
    sundayNext.setDate(monday.getDate() + 13);
    const warsawSundayNextStr = formatter.format(sundayNext);

    // Each boundary uses its OWN date's offset, not `now`'s — this window spans up to ~19
    // days from today, and a DST transition inside that range means Monday and the next
    // Sunday can legitimately sit on different UTC offsets.
    const startOfWeekStr = new Date(`${warsawMondayStr}T00:00:00${getWarsawOffset(monday)}`).toISOString()
    const endOfNextWeekStr = new Date(`${warsawSundayNextStr}T23:59:59.999${getWarsawOffset(sundayNext)}`).toISOString()

    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfWeekStr}&timeMax=${endOfNextWeekStr}&singleEvents=true&orderBy=startTime`, { signal: AbortSignal.timeout(15000),
      headers: { 'Authorization': `Bearer ${access_token}` }
    })
    if (!calRes.ok) {
      const errBody = await calRes.text().catch(() => '');
      throw new Error(`[sync-calendar] Calendar API error ${calRes.status}: ${errBody.substring(0, 200)}`);
    }
    const calData = await calRes.json()
    const calendarEvents = (calData.items || []).map((e: any) => ({
      user_id: userId,
      event_id: e.id,
      summary: e.summary,
      start_time: e.start.dateTime || e.start.date,
      end_time: e.end.dateTime || e.end.date,
      category: 'google_sync'
    }))

    // Atomic delete+upsert via RPC (handles modifications/deletions from Google Calendar
    // without the race window a plain client-side delete-then-upsert would leave open
    // between two overlapping sync calls).
    await safeExecute(
      supabase.rpc('replace_calendar_window', {
        p_user_id: userId,
        p_category: 'google_sync',
        p_start: startOfWeekStr,
        p_end: endOfNextWeekStr,
        p_events: calendarEvents,
      })
    )

    return new Response(JSON.stringify({ 
      success: true, 
      calendarCount: calendarEvents.length
}), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
