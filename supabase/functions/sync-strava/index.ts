/**
 * sync-strava
 *
 * Syncs Strava activities for the Vanguard user.
 * Initial sync: from 2026-05-20 (Warsaw).
 * Incremental: from latest activity in DB.
 *
 * Token rotation: Strava rotates refresh_token on every use.
 * Tokens are stored in strava_tokens table and updated after each refresh.
 *
 * Trigger: HTTP (manual) or cron (optional)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";

const STRAVA_CLIENT_ID     = Deno.env.get('STRAVA_CLIENT_ID') || '';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || '';
const VANGUARD_USER_ID     = getVanguardUserId();

// Initial sync cutoff: 2026-05-20 00:00:00 Warsaw (UTC+2)
const INITIAL_SYNC_FROM = Math.floor(new Date('2026-05-19T22:00:00Z').getTime() / 1000);

const supabase = createServiceClient();

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

  const res = await fetch('https://www.strava.com/oauth/token', {
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

  // Persist rotated tokens
  await supabase.from('strava_tokens').upsert({
    user_id:       VANGUARD_USER_ID,
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at,
    updated_at:    new Date().toISOString()
  });

  console.log('[sync-strava] Token refreshed, expires:', new Date(data.expires_at * 1000).toISOString());
  return data.access_token;
}

async function fetchActivities(accessToken: string, after: number): Promise<any[]> {
  const activities: any[] = [];
  let page = 1;

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      console.error('[sync-strava] Strava API error:', res.status, await res.text().catch(() => ''));
      break;
    }

    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    activities.push(...batch);
    console.log(`[sync-strava] Page ${page}: ${batch.length} activities`);
    if (batch.length < 100) break;
    page++;
  }

  return activities;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const forceFrom = url.searchParams.get('from');

    // Determine sync window: from param > latest in DB > initial cutoff
    let after: number;

    if (forceFrom) {
      after = Math.floor(new Date(forceFrom).getTime() / 1000);
      console.log(`[sync-strava] Force sync from ${forceFrom}`);
    } else {
      const { data: latest } = await supabase
        .from('strava_activities')
        .select('start_date')
        .eq('user_id', VANGUARD_USER_ID)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      after = latest?.start_date
        ? Math.floor(new Date(latest.start_date).getTime() / 1000)
        : INITIAL_SYNC_FROM;
    }

    console.log(`[sync-strava] Syncing after ${new Date(after * 1000).toISOString()}`);

    const accessToken = await getAccessToken();
    const activities  = await fetchActivities(accessToken, after);

    if (activities.length === 0) {
      console.log('[sync-strava] No new activities');
      return new Response(JSON.stringify({ ok: true, synced: 0 }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const rows = activities.map((a: any) => ({
      strava_id:            a.id,
      user_id:              VANGUARD_USER_ID,
      name:                 a.name || null,
      sport_type:           a.sport_type || a.type || null,
      start_date:           a.start_date || null,
      elapsed_time:         a.elapsed_time ?? null,
      moving_time:          a.moving_time ?? null,
      distance:             a.distance ?? null,
      average_heartrate:    a.average_heartrate ?? null,
      max_heartrate:        a.max_heartrate ?? null,
      average_speed:        a.average_speed ?? null,
      max_speed:            a.max_speed ?? null,
      total_elevation_gain: a.total_elevation_gain ?? null,
      calories:             a.calories ?? null,
      suffer_score:         a.suffer_score ?? null,
      perceived_exertion:   a.perceived_exertion ?? null,
      manual:               a.manual ?? false,
      raw_data:             a,
      synced_at:            new Date().toISOString()
    }));

    const { error } = await supabase
      .from('strava_activities')
      .upsert(rows, { onConflict: 'strava_id' });

    if (error) {
      console.error('[sync-strava] Upsert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[sync-strava] Synced ${rows.length} activities`);
    return new Response(JSON.stringify({ ok: true, synced: rows.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[sync-strava] fatal:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
