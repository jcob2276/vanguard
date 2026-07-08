import { corsHeaders } from '../_shared/supabase.ts'
import { runOuraSync } from './oura.ts'
import { runStravaSync } from './strava.ts'
import { runCalendarSync } from './calendar.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
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
      return new Response(JSON.stringify({ error: `Unknown or missing service parameter: ${service}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
