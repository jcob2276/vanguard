import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId, code, redirectUri } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

    // 1. OAUTH EXCHANGE
    if (code) {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          access_type: 'offline',
          prompt: 'consent'
        })
      })

      const tokens = await tokenResponse.json()
      if (tokens.refresh_token) {
        await supabase.from('vanguard_tokens').upsert({
          user_id: userId,
          provider: 'google',
          refresh_token: tokens.refresh_token
        })
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
    }

    // 2. FETCH TOKEN
    const { data: tokenData } = await supabase
      .from('vanguard_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()

    if (!tokenData) return new Response(JSON.stringify({ error: 'No token' }), { status: 400, headers: corsHeaders })

    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token'
      })
    })

    const { access_token } = await refreshRes.json()

    // 3. SYNC CALENDAR (INTENTIONS)
    const now = new Date()
    const startOfDay = new Date(now.setHours(0,0,0,0)).toISOString()
    const endOfDay = new Date(now.setHours(23,59,59,999)).toISOString()

    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay}&timeMax=${endOfDay}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })
    const calData = await calRes.json()
    const calendarEvents = (calData.items || []).map((e: any) => ({
      user_id: userId,
      event_id: e.id,
      summary: e.summary,
      start_time: e.start.dateTime || e.start.date,
      end_time: e.end.dateTime || e.end.date,
      category: 'google_sync'
    }))

    if (calendarEvents.length > 0) {
      await supabase.from('vanguard_calendar').upsert(calendarEvents, { onConflict: 'event_id' })
    }

    // 4. SYNC YOUTUBE (BEHAVIOR)
    const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&mine=true&maxResults=10`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })
    const ytData = await ytRes.json()
    const ytActivities = (ytData.items || [])
      .filter((item: any) => item.snippet.type === 'playlistItem' || item.snippet.type === 'like')
      .map((item: any) => ({
        user_id: userId,
        video_id: item.contentDetails?.playlistItem?.resourceId?.videoId || item.contentDetails?.like?.resourceId?.videoId,
        title: item.snippet.title,
        watched_at: item.snippet.publishedAt
      }))

    if (ytActivities.length > 0) {
      await supabase.from('vanguard_youtube').upsert(ytActivities, { onConflict: 'user_id, video_id' })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      calendarCount: calendarEvents.length,
      youtubeCount: ytActivities.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
