import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { isOuraDuplicate, detectFrozenSensor, mergeHRIntoSplits, pairOuraDuplicates, resolveHrFromOura } from "./stravaHelpers.ts";

const STRAVA_CLIENT_ID     = Deno.env.get('STRAVA_CLIENT_ID') || '';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || '';
const VANGUARD_USER_ID     = getVanguardUserId();

// Initial sync cutoff: 2026-05-20 00:00:00 Warsaw (UTC+2)
const INITIAL_SYNC_FROM = Math.floor(new Date('2026-05-19T22:00:00Z').getTime() / 1000);

const supabase = createServiceClient();

let tokenRefreshPromise: Promise<string> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://www.strava.com/oauth/token', { signal: AbortSignal.timeout(15000),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token'
    })
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('[sync-strava] Token refresh failed: ' + JSON.stringify(data));
  }

  const { error: tokenSaveErr } = await supabase.from('strava_tokens').upsert({
    user_id:       VANGUARD_USER_ID,
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at,
    updated_at:    new Date().toISOString()
  });
  if (tokenSaveErr) throw new Error('[sync-strava] Failed to save refreshed token: ' + tokenSaveErr.message);

  console.log('[sync-strava] Token refreshed, expires:', new Date(data.expires_at * 1000).toISOString());
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const { data: tokenRow } = await supabase
    .from('strava_tokens')
    .select('refresh_token, access_token, expires_at')
    .eq('user_id', VANGUARD_USER_ID)
    .maybeSingle();

  const now = Math.floor(Date.now() / 1000);

  // Use cached access_token if still valid (5 min buffer)
  if (tokenRow?.access_token && tokenRow?.expires_at && tokenRow.expires_at > now + 300) {
    return tokenRow.access_token;
  }

  const refreshToken = tokenRow?.refresh_token;
  if (!refreshToken) throw new Error('[sync-strava] No refresh token found in DB');

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = refreshAccessToken(refreshToken).finally(() => {
      tokenRefreshPromise = null;
    });
  }
  return tokenRefreshPromise;
}

async function fetchActivities(accessToken: string, after: number): Promise<{ activities: any[]; rateLimited: boolean }> {
  const activities: any[] = [];
  let page = 1;
  let rateLimited = false;

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      console.error('[sync-strava] Strava API error:', res.status, await res.text().catch(() => ''));
      rateLimited = res.status === 429;
      break;
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    activities.push(...batch);
    console.log(`[sync-strava] Page ${page}: ${batch.length} activities`);
    if (batch.length < 100) break;
    page++;
  }

  return { activities, rateLimited };
}

async function fetchActivityDetail(accessToken: string, activityId: number): Promise<any | null> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      console.warn(`[sync-strava] detail fetch failed for ${activityId}: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[sync-strava] detail fetch error for ${activityId}:`, err);
    return null;
  }
}

export async function runStravaSync(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const forceFrom = url.searchParams.get('from');

    let after: number;

    if (forceFrom) {
      after = Math.floor(new Date(forceFrom).getTime() / 1000);
      console.log(`[sync-strava] Force sync from ${forceFrom}`);
    } else {
      const { data: latest } = await supabase
        .from('strava_activities')
        .select('start_date')
        .eq('user_id', VANGUARD_USER_ID)
        .eq('is_oura_duplicate', false)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      after = latest?.start_date
        ? Math.floor((new Date(latest.start_date).getTime() - 3 * 24 * 3600 * 1000) / 1000)
        : INITIAL_SYNC_FROM;

      if (after < INITIAL_SYNC_FROM) {
        after = INITIAL_SYNC_FROM;
      }
    }

    console.log(`[sync-strava] Syncing after ${new Date(after * 1000).toISOString()}`);

    const accessToken = await getAccessToken();
    const { activities, rateLimited } = await fetchActivities(accessToken, after);

    if (activities.length === 0) {
      console.log('[sync-strava] No new activities');
      return new Response(JSON.stringify({ ok: !rateLimited, synced: 0, rate_limited: rateLimited }), {
        status: rateLimited ? 503 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const detailMap: Record<number, any> = {};
    const incompleteIds: number[] = [];
    for (const a of activities) {
      const detail = await fetchActivityDetail(accessToken, a.id);
      if (detail) {
        detailMap[a.id] = detail;
      } else {
        incompleteIds.push(a.id);
        console.warn(`[sync-strava] Detail fetch failed for activity ${a.id} — will store summary-only, marked incomplete`);
      }
    }
    if (incompleteIds.length) {
      console.warn(`[sync-strava] ${incompleteIds.length} activities stored without splits/HR — will retry on next sync`);
    }

    const primaryActivities = activities.filter(a => !isOuraDuplicate(a));
    const ouraActivities    = activities.filter(a => isOuraDuplicate(a));
    const ouraPairs         = pairOuraDuplicates(primaryActivities, ouraActivities, detailMap);

    console.log(`[sync-strava] ${primaryActivities.length} primary, ${ouraActivities.length} Oura duplicates, ${ouraPairs.size} paired`);

    const rows = [];
    for (const a of activities) {
      if (incompleteIds.includes(a.id)) continue;
      const detail    = detailMap[a.id] || a;
      const isDup     = isOuraDuplicate(a);
      const ouraDetail = isDup ? null : ouraPairs.get(a.id) ?? null;

      let hrAvg: number | null = null, hrMax: number | null = null, hrSource: string | null = null, hrFrozen = false;
      let splitsWithHR: any[] = detail.splits_metric || [];
      if (detail.average_heartrate && detail.has_heartrate) { hrAvg = detail.average_heartrate; hrMax = detail.max_heartrate; hrSource = 'strava'; hrFrozen = detectFrozenSensor(detail.splits_metric || [], hrMax); }
      else if (ouraDetail?.average_heartrate) { hrAvg = ouraDetail.average_heartrate; hrMax = ouraDetail.max_heartrate; hrSource = 'oura'; hrFrozen = detectFrozenSensor(ouraDetail.splits_metric || [], hrMax); splitsWithHR = mergeHRIntoSplits(detail.splits_metric || [], ouraDetail.splits_metric || []); }
      else if (!isDup) {
        const startTime = new Date(a.start_date);
        const duration = a.elapsed_time || a.moving_time || 0;
        const endTime = new Date(startTime.getTime() + duration * 1000);

        const { data: dbHrSamples } = await supabase.from('oura_heartrate').select('ts, bpm').eq('user_id', VANGUARD_USER_ID).gte('ts', startTime.toISOString()).lte('ts', endTime.toISOString()).order('ts', { ascending: true });
        if (dbHrSamples && dbHrSamples.length > 0) {
          const bpms = dbHrSamples.map(r => r.bpm);
          hrAvg = Math.round(bpms.reduce((sum, val) => sum + val, 0) / bpms.length);
          hrMax = Math.max(...bpms); hrSource = 'oura'; hrFrozen = detectFrozenSensor(detail.splits_metric || [], hrMax);
          const splits = detail.splits_metric || []; let currentOffsetMs = 0; const newSplits = [];
          for (const split of splits) {
            const splitElapsed = split.elapsed_time || split.moving_time;
            const splitStart = new Date(startTime.getTime() + currentOffsetMs);
            const splitEnd = new Date(startTime.getTime() + currentOffsetMs + splitElapsed * 1000);
            currentOffsetMs += splitElapsed * 1000;
            const splitSamples = dbHrSamples.filter(r => { const t = new Date(r.ts).getTime(); return t >= splitStart.getTime() && t < splitEnd.getTime(); });
            let splitAvg = null;
            if (splitSamples.length > 0) { splitAvg = Math.round(splitSamples.reduce((sum, val) => sum + val.bpm, 0) / splitSamples.length); }
            else { let nearest = null, minDiff = Infinity; const splitMid = splitStart.getTime() + (splitElapsed * 1000) / 2; for (const r of dbHrSamples) { const diff = Math.abs(new Date(r.ts).getTime() - splitMid); if (diff < minDiff) { minDiff = diff; nearest = r.bpm; } } splitAvg = nearest; }
            newSplits.push({ ...split, average_heartrate: splitAvg });
          }
          splitsWithHR = newSplits;
        }
      }

      const { segment_efforts: _seg, ...detailLean } = detail;

      rows.push({
        strava_id:            a.id,
        user_id:              VANGUARD_USER_ID,
        name:                 a.name || null,
        sport_type:           a.sport_type || a.type || null,
        start_date:           a.start_date || null,
        elapsed_time:         a.elapsed_time ?? null,
        moving_time:          a.moving_time ?? null,
        distance:             a.distance ?? null,
        average_heartrate:    detail.has_heartrate ? (detail.average_heartrate ?? null) : null,
        max_heartrate:        detail.has_heartrate ? (detail.max_heartrate ?? null) : null,
        average_speed:        a.average_speed ?? null,
        max_speed:            a.max_speed ?? null,
        total_elevation_gain: a.total_elevation_gain ?? null,
        calories:             (detail.calories && detail.calories > 0) ? detail.calories : null,
        suffer_score:         detail.suffer_score ?? null,
        perceived_exertion:   detail.perceived_exertion ?? null,
        manual:               a.manual ?? false,
        hr_avg:               hrAvg,
        hr_max:               hrMax,
        hr_source:            hrSource,
        hr_frozen:            hrFrozen,
        splits_with_hr:       splitsWithHR.length > 0 ? splitsWithHR : null,
        gear_name:            detail.gear?.name ?? null,
        gear_distance_km:     detail.gear?.converted_distance ?? null,
        is_oura_duplicate:    isDup,
        raw_data:             detailLean,
        synced_at:            new Date().toISOString()
      });
    }

    const { error } = await supabase
      .from('strava_activities')
      .upsert(rows, { onConflict: 'strava_id' });

    if (error) {
      console.error('[sync-strava] Upsert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[sync-strava] Synced ${rows.length} activities (${primaryActivities.length} primary + ${ouraActivities.length} Oura dups)`);

    return new Response(JSON.stringify({
      ok:              !rateLimited,
      synced:          rows.length,
      primary:         primaryActivities.length,
      oura_duplicates: ouraActivities.length,
      paired:          ouraPairs.size,
      rate_limited:    rateLimited,
    }), {
      status: rateLimited ? 503 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[sync-strava] fatal:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
