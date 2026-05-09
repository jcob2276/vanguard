import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // MODE 1: Exchange code for refresh_token (Initial Auth)
    if (code) {
      console.log("Exchanging code for tokens...")
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
      return new Response(JSON.stringify({ success: true, message: 'Auth success' }), { headers: corsHeaders })
    }

    // MODE 2: Sync Events (Normal Operation)
    const { data: tokenData } = await supabase
      .from('vanguard_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()

    if (!tokenData) return new Response(JSON.stringify({ error: 'No google token' }), { status: 400, headers: corsHeaders })

    // Get fresh access token
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

    // Fetch Calendar Events
    const now = new Date()
    const startOfDay = new Date(now.setHours(0,0,0,0)).toISOString()
    const endOfDay = new Date(now.setHours(23,59,59,999)).toISOString()

    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay}&timeMax=${endOfDay}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    })

    const { items } = await calRes.json()
    
    // Save to vanguard_calendar
    const events = items.map((e: any) => ({
      user_id: userId,
      event_id: e.id,
      summary: e.summary,
      start_time: e.start.dateTime || e.start.date,
      end_time: e.end.dateTime || e.end.date,
      category: 'google_sync'
    }))

    if (events.length > 0) {
      await supabase.from('vanguard_calendar').upsert(events, { onConflict: 'event_id' })
    }

    return new Response(JSON.stringify({ success: true, count: events.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
