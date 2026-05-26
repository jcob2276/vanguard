import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { safeExecute, createServiceClient, corsHeaders } from '../_shared/supabase.ts'

const MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()
    if (!userId) throw new Error('Brak userId')

    const supabaseClient = createServiceClient()

    // 1. Get credentials
    const settings = await safeExecute(
      supabaseClient.from('user_settings').select('*').eq('user_id', userId).single()
    )
    if (!settings?.google_fit_refresh_token) throw new Error('Google Fit nie jest połączony')

    // 2. Refresh Access Token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: settings.google_fit_client_id,
        client_secret: settings.google_fit_client_secret,
        refresh_token: settings.google_fit_refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    const endTimeNanos = BigInt(Date.now()) * BigInt(1000000)
    const startTimeNanos = endTimeNanos - (BigInt(30 * 24 * 60 * 60) * BigInt(1000000000))

    // 3. Sync Body Metrics
    const dataTypes = [
      { id: "derived:com.google.weight:com.google.android.gms:merge_weight", field: 'weight' },
      { id: "derived:com.google.body.fat.percentage:com.google.android.gms:merged", field: 'body_fat' }
    ]

    const dayData: Record<string, any> = {}
    for (const dt of dataTypes) {
      const response = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${dt.id}/datasets/${startTimeNanos}-${endTimeNanos}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      const data = await response.json()
      if (data.point) {
        for (const point of data.point) {
          const pointDate = new Date(parseInt(point.startTimeNanos) / 1000000)
          const date = pointDate.toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' })
          const value = point.value[0]?.fpVal || point.value[0]?.intVal
          if (value) {
            if (!dayData[date]) dayData[date] = { user_id: userId, date }
            dayData[date][dt.field] = Math.round(value * 10) / 10
          }
        }
      }
    }
    const entries = Object.values(dayData)
    for (const entry of entries) {
      await safeExecute(
        supabaseClient.from('body_metrics').upsert(entry, { onConflict: 'user_id,date' })
      )
    }

    // 4. Sync Location & SMART TAGGING
    const startTimeNanosLoc = endTimeNanos - (BigInt(7 * 24 * 60 * 60) * BigInt(1000000000))
    const locationStream = "derived:com.google.location.sample:com.google.android.gms:merge_location_samples"
    
    const locResponse = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataSources/${locationStream}/datasets/${startTimeNanosLoc}-${endTimeNanos}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const locData = await locResponse.json()
    
    let syncedLocations = 0
    if (locData.point) {
      // Sample points to avoid hitting API limits (every 10th point or if big distance)
      const points = locData.point.filter((_: any, idx: number) => idx % 5 === 0); 

      for (const p of points) {
        const lat = p.value[0].fpVal;
        const lng = p.value[1].fpVal;
        const timestamp = new Date(parseInt(p.startTimeNanos) / 1000000).toISOString();
        
        let placeName = null;

        // Smart Tagging with Google Maps API
        if (MAPS_API_KEY) {
          const placesResp = await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50&type=gym&key=${MAPS_API_KEY}`
          );
          const placesData = await placesResp.json();
          if (placesData.results && placesData.results.length > 0) {
            placeName = placesData.results[0].name; // Np. "CityFit Rondo ONZ"
          }
        }

        await safeExecute(
          supabaseClient.from('location_history').upsert({
            user_id: userId,
            created_at: timestamp,
            latitude: lat,
            longitude: lng,
            accuracy: p.value[2].fpVal,
            place_name: placeName
          }, { onConflict: 'user_id,created_at' })
        );
        syncedLocations++;
      }
    }

    return new Response(JSON.stringify({ success: true, synced_locations: syncedLocations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
