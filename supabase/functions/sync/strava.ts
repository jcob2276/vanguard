import { createServiceClient } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";

const VANGUARD_USER_ID = getVanguardUserId();
const supabase = createServiceClient();

export async function runStravaSync(req: Request): Promise<unknown> {
  try {
    console.log('[sync-intervals] Starting sync from intervals.icu...');

    // 1. Fetch token and athlete ID from public.intervals_tokens
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('intervals_tokens')
      .select('api_key, athlete_id')
      .eq('user_id', VANGUARD_USER_ID)
      .maybeSingle();

    if (tokenErr) {
      console.error('[sync-intervals] Database error fetching intervals token:', tokenErr);
      throw new Error(`Failed to fetch intervals token: ${tokenErr.message}`);
    }

    if (!tokenRow?.api_key || !tokenRow?.athlete_id) {
      console.error('[sync-intervals] No credentials found in intervals_tokens table.');
      throw new Error('No intervals.icu credentials found in database configuration.');
    }

    // 2. Determine date range for sync
    const urlParams = new URL(req.url);
    const forceFrom = urlParams.searchParams.get('from');

    let oldestDateStr: string;
    if (forceFrom) {
      oldestDateStr = new Date(forceFrom).toISOString().split('T')[0];
      console.log(`[sync-intervals] Forced sync from date: ${oldestDateStr}`);
    } else {
      // Find the latest intervals activity in database
      const { data: latest } = await supabase
        .from('strava_activities')
        .select('start_date')
        .eq('user_id', VANGUARD_USER_ID)
        .eq('source', 'garmin_intervals')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest?.start_date) {
        // Subtract 3 days to catch delayed/edited uploads
        const date = new Date(latest.start_date);
        date.setDate(date.getDate() - 3);
        oldestDateStr = date.toISOString().split('T')[0];
      } else {
        // Default sync cutoff
        oldestDateStr = '2026-05-20';
      }
    }

    console.log(`[sync-intervals] Fetching activities after: ${oldestDateStr}`);

    // 3. Request activities from intervals.icu
    const authHeader = 'Basic ' + btoa(`API_KEY:${tokenRow.api_key}`);
    const intervalsUrl = `https://intervals.icu/api/v1/athlete/${tokenRow.athlete_id}/activities?oldest=${oldestDateStr}`;
    
    const res = await fetch(intervalsUrl, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[sync-intervals] intervals.icu API returned error:', res.status, errText);
      throw new Error(`intervals.icu API error (${res.status}): ${errText}`);
    }

    const activities = await res.json();
    if (!Array.isArray(activities) || activities.length === 0) {
      console.log('[sync-intervals] No new activities returned from intervals.icu');
      return { ok: true, synced: 0, rate_limited: false };
    }

    console.log(`[sync-intervals] Received ${activities.length} activities from API.`);

    // 4. Map intervals.icu fields to public.strava_activities schema
    const rows = activities.map((a: any) => {
      const icuIdStr = String(a.id);
      const numericId = parseInt(icuIdStr.replace(/\D/g, ''), 10);
      
      const hrAvg = a.average_heartrate ? Math.round(a.average_heartrate) : null;
      const hrMax = a.max_heartrate ? Math.round(a.max_heartrate) : null;

      // Ensure start_date is parsed in Warsaw time and normalized to UTC ISO string
      const startDateStr = a.start_date_local || a.start_date;

      return {
        strava_id:            numericId,
        user_id:              VANGUARD_USER_ID,
        name:                 a.name || null,
        sport_type:           a.type || null,
        start_date:           startDateStr ? new Date(startDateStr).toISOString() : null,
        elapsed_time:         a.elapsed_time ?? null,
        moving_time:          a.moving_time ?? null,
        distance:             a.distance ?? null,
        average_heartrate:    hrAvg,
        max_heartrate:        hrMax,
        average_speed:        a.average_speed ?? null,
        max_speed:            a.max_speed ?? null,
        total_elevation_gain: a.total_elevation_gain ?? null,
        calories:             a.calories ?? null,
        suffer_score:         a.trimp ? Math.round(a.trimp) : null,
        perceived_exertion:   a.perceived_exertion ?? null,
        manual:               a.manual ?? false,
        hr_avg:               hrAvg,
        hr_max:               hrMax,
        hr_source:            hrAvg ? 'garmin_intervals' : null,
        hr_frozen:            false,
        splits_with_hr:       null, // Splits not fetched in overview list
        gear_name:            null,
        gear_distance_km:     null,
        is_oura_duplicate:    false,
        source:               'garmin_intervals',
        icu_activity_id:      icuIdStr,
        icu_hr_zone_times:    a.icu_hr_zone_times ?? null,
        trimp:                a.trimp ?? null,
        raw_data:             a,
        synced_at:            new Date().toISOString()
      };
    });

    // 5. Upsert to public.strava_activities table
    const { error: upsertErr } = await supabase
      .from('strava_activities')
      .upsert(rows, { onConflict: 'strava_id' });

    if (upsertErr) {
      console.error('[sync-intervals] Database upsert error:', upsertErr);
      throw upsertErr;
    }

    console.log(`[sync-intervals] Successfully synced ${rows.length} activities to database.`);

    return {
      ok:              true,
      synced:          rows.length,
      primary:         rows.length,
      oura_duplicates: 0,
      paired:          0,
      rate_limited:    false,
    };

  } catch (err: unknown) {
    let errorMsg = 'Unknown error';
    if (err instanceof Error) {
      errorMsg = err.message;
    } else if (err && typeof err === 'object') {
      errorMsg = (err as any).message || JSON.stringify(err);
    } else {
      errorMsg = String(err);
    }
    console.error('[sync-intervals] Fatal sync error:', errorMsg);
    throw new Error(errorMsg);
  }
}
