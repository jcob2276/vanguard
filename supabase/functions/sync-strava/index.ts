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

/** Fetch detailed activity (splits, best_efforts, cadence etc.) */
async function fetchActivityDetail(accessToken: string, activityId: number): Promise<any | null> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
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

function fmtTime(sec: number): string {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtPace(speed: number): string {
  if (!speed) return '—';
  const sec = 1000 / speed;
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}/km`;
}

/** Fetch HR stream for zone computation */
async function fetchHRStream(accessToken: string, activityId: number): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.heartrate?.data || null;
  } catch { return null; }
}

/** Compute HR zone distribution (Z1–Z5) from raw HR stream */
function computeHRZones(hrStream: number[], hrMax: number): Record<string, number> {
  const z = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 };
  for (const hr of hrStream) {
    const pct = hr / hrMax;
    if      (pct < 0.60) z.Z1++;
    else if (pct < 0.70) z.Z2++;
    else if (pct < 0.80) z.Z3++;
    else if (pct < 0.90) z.Z4++;
    else                  z.Z5++;
  }
  const total = hrStream.length || 1;
  return {
    Z1: Math.round(z.Z1 / total * 100),
    Z2: Math.round(z.Z2 / total * 100),
    Z3: Math.round(z.Z3 / total * 100),
    Z4: Math.round(z.Z4 / total * 100),
    Z5: Math.round(z.Z5 / total * 100),
  };
}

function buildActivityReport(detail: any, oura: any | null, zones: Record<string, number> | null): string {
  const name       = detail.name || 'Trening';
  const sport      = detail.sport_type || detail.type || '';
  const distKm     = detail.distance ? (detail.distance / 1000).toFixed(2) : '—';
  const movingFmt  = fmtTime(detail.moving_time);
  const elapsedFmt = fmtTime(detail.elapsed_time);
  const stopped    = (detail.elapsed_time || 0) - (detail.moving_time || 0);
  const pace       = fmtPace(detail.average_speed);
  const hrAvg      = detail.average_heartrate ? Math.round(detail.average_heartrate) : null;
  const hrMax      = detail.max_heartrate     ? Math.round(detail.max_heartrate)     : null;
  const elev       = detail.total_elevation_gain != null ? detail.total_elevation_gain : null;
  const elevHigh   = detail.elev_high != null ? detail.elev_high : null;
  const elevLow    = detail.elev_low  != null ? detail.elev_low  : null;
  const cadence    = detail.average_cadence ? Math.round(detail.average_cadence * 2) : null;
  const calories   = detail.calories && detail.calories > 0 ? Math.round(detail.calories) : null;
  const suffer     = detail.suffer_score || null;
  const device     = detail.device_name  || null;
  const rpe        = detail.perceived_exertion || null;

  const startLocal = detail.start_date_local
    ? new Date(detail.start_date_local).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : '';

  // --- HEADER ---
  let t = `🏃 *${name}* (${sport}) — ${startLocal}\n`;
  t += `━━━━━━━━━━━━━━━━━━━━\n`;

  // --- SUMMARY ---
  t += `*${distKm} km* | ${movingFmt} moving`;
  if (stopped > 30) t += ` | ⏸ ${fmtTime(stopped)} pauz`;
  t += `\n`;
  t += `Tempo: *${pace}*`;
  if (hrAvg) t += ` | HR: *${hrAvg}* / max *${hrMax}*`;
  if (elev != null) t += ` | ↑${elev}m`;
  t += `\n`;
  if (elevHigh && elevLow) t += `Wys: ${elevLow}–${elevHigh}m n.p.m.\n`;
  if (cadence) t += `Kadencja: ${cadence} spm\n`;
  if (calories) t += `Kalorie: ${calories} kcal\n`;
  if (suffer)  t += `Suffer score: ${suffer}\n`;
  if (rpe)     t += `RPE: ${rpe}/10\n`;
  if (device)  t += `Urządzenie: ${device}\n`;

  // --- OURA (noc przed treningiem) ---
  if (oura) {
    t += `\n━━ 🛌 REGENERACJA (noc przed) ━━\n`;
    if (oura.readiness_score != null) t += `Readiness: *${oura.readiness_score}*`;
    if (oura.hrv_avg != null)         t += ` | HRV: *${Math.round(oura.hrv_avg)}ms*`;
    if (oura.rhr_avg != null)         t += ` | RHR: *${Math.round(oura.rhr_avg)}bpm*`;
    t += `\n`;
    if (oura.total_sleep_hours != null) t += `Sen: *${oura.total_sleep_hours.toFixed(1)}h*`;
    if (oura.deep_sleep_hours  != null) t += ` | Deep: ${oura.deep_sleep_hours.toFixed(1)}h`;
    if (oura.rem_sleep_hours   != null) t += ` | REM: ${oura.rem_sleep_hours.toFixed(1)}h`;
    if (oura.sleep_efficiency  != null) t += ` | Eff: ${oura.sleep_efficiency}%`;
    t += `\n`;
  }

  // --- HR ZONES ---
  if (zones && hrMax) {
    t += `\n━━ ❤️ STREFY HR (max ${hrMax}) ━━\n`;
    t += `Z1 <${Math.round(hrMax * 0.60)}: ${zones.Z1}% `;
    t += `Z2 ${Math.round(hrMax * 0.60)}–${Math.round(hrMax * 0.70)}: ${zones.Z2}% `;
    t += `Z3: ${zones.Z3}%\n`;
    t += `Z4 ${Math.round(hrMax * 0.80)}–${Math.round(hrMax * 0.90)}: ${zones.Z4}% `;
    t += `Z5 >${Math.round(hrMax * 0.90)}: ${zones.Z5}%\n`;
  }

  // --- SPLITS ---
  const splits: any[] = detail.splits_metric || [];
  if (splits.length > 0) {
    t += `\n━━ 📍 SPLITS (km) ━━\n`;

    // Cardiac drift: first km HR vs last full km HR (skip paused km)
    const fullSplits = splits.filter(s => (s.elapsed_time - s.moving_time) < 30);
    if (fullSplits.length >= 2 && fullSplits[0].average_heartrate && fullSplits[fullSplits.length - 1].average_heartrate) {
      const driftStart = Math.round(fullSplits[0].average_heartrate);
      const driftEnd   = Math.round(fullSplits[fullSplits.length - 1].average_heartrate);
      const driftDiff  = driftEnd - driftStart;
      const driftNote  = driftDiff > 5
        ? `⬆️ +${driftDiff}bpm (serce rosło przy stałym tempie — zmęczenie/odwodnienie)`
        : driftDiff < -5
        ? `⬇️ ${driftDiff}bpm (HR spadało — rozgrzewka lub negatywny split)`
        : `✅ stabilny (${driftDiff > 0 ? '+' : ''}${driftDiff}bpm)`;
      t += `Cardiac drift: ${driftNote}\n`;
    }

    // Positive/negative split analysis
    if (splits.length >= 2) {
      const half = Math.floor(splits.length / 2);
      const firstHalf  = splits.slice(0, half);
      const secondHalf = splits.slice(half);
      const avgFirst  = firstHalf.reduce((s, k) => s + k.average_speed, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, k) => s + k.average_speed, 0) / secondHalf.length;
      const diff = avgFirst - avgSecond; // positive = getting slower
      const splitNote = diff > 0.1
        ? `⚠️ Positive split — zwalniasz (${fmtPace(avgFirst)} → ${fmtPace(avgSecond)})`
        : diff < -0.1
        ? `✅ Negative split — przyspieszasz (${fmtPace(avgFirst)} → ${fmtPace(avgSecond)})`
        : `➡️ Even split (${fmtPace(avgFirst)} ≈ ${fmtPace(avgSecond)})`;
      t += `${splitNote}\n`;
    }

    t += `\n`;
    for (const s of splits) {
      const pause  = s.elapsed_time - s.moving_time;
      const paused = pause > 20 ? ` ⏸${fmtTime(pause)}` : '';
      const hr     = s.average_heartrate ? ` | ${Math.round(s.average_heartrate)}bpm` : '';
      const gap    = s.average_grade_adjusted_speed && Math.abs(s.average_grade_adjusted_speed - s.average_speed) > 0.05
        ? ` | GAP ${fmtPace(s.average_grade_adjusted_speed)}`
        : '';
      const el     = s.elevation_difference != null
        ? ` | ${s.elevation_difference >= 0 ? '↑' : '↓'}${Math.abs(s.elevation_difference).toFixed(1)}m`
        : '';
      t += `  km${s.split}: *${fmtPace(s.average_speed)}* (${fmtTime(s.moving_time)})${hr}${gap}${el}${paused}\n`;
    }
  }

  // --- BEST EFFORTS ---
  const KEY_DISTS = [400, 1000, 1609, 5000, 10000];
  const efforts = (detail.best_efforts || [])
    .filter((e: any) => KEY_DISTS.includes(Math.round(e.distance)));
  if (efforts.length > 0) {
    t += `\n━━ 🏆 BEST EFFORTS ━━\n`;
    for (const e of efforts) {
      const pr = e.pr_rank === 1 ? ' 🥇 PR!' : e.pr_rank === 2 ? ' 🥈' : e.pr_rank === 3 ? ' 🥉' : '';
      const label = e.distance >= 1000 ? `${(e.distance / 1000).toFixed(e.distance === 1000 ? 0 : 1)}K` : `${Math.round(e.distance)}m`;
      t += `  ${label}: *${fmtTime(e.elapsed_time)}*${pr}\n`;
    }
  }

  // --- SEGMENT PRs ---
  const prSegments = (detail.segment_efforts || [])
    .filter((s: any) => s.pr_rank && s.pr_rank <= 3)
    .sort((a: any, b: any) => a.pr_rank - b.pr_rank)
    .slice(0, 5);
  if (prSegments.length > 0) {
    t += `\n━━ 📌 SEGMENTY (PRs) ━━\n`;
    for (const s of prSegments) {
      const medal = s.pr_rank === 1 ? '🥇' : s.pr_rank === 2 ? '🥈' : '🥉';
      const distM = s.distance < 1000 ? `${Math.round(s.distance)}m` : `${(s.distance / 1000).toFixed(1)}km`;
      t += `  ${medal} ${s.name} (${distM}): *${fmtTime(s.elapsed_time)}* | HR ${Math.round(s.average_heartrate || 0)}\n`;
    }
  }

  return t;
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

    // For each new activity, fetch detailed data (splits, best_efforts, cadence)
    // Sequential to avoid Strava rate-limit (100 req/15min)
    const detailMap: Record<number, any> = {};
    for (const a of activities) {
      const detail = await fetchActivityDetail(accessToken, a.id);
      if (detail) detailMap[a.id] = detail;
    }

    const rows = activities.map((a: any) => {
      const detail = detailMap[a.id] || a;
      return {
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
        calories:             detail.calories ?? a.calories ?? null,
        suffer_score:         detail.suffer_score ?? a.suffer_score ?? null,
        perceived_exertion:   detail.perceived_exertion ?? a.perceived_exertion ?? null,
        manual:               a.manual ?? false,
        // Store full detail (includes splits_metric, best_efforts, average_cadence)
        raw_data:             detail,
        synced_at:            new Date().toISOString()
      };
    });

    const { error } = await supabase
      .from('strava_activities')
      .upsert(rows, { onConflict: 'strava_id' });

    if (error) {
      console.error('[sync-strava] Upsert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[sync-strava] Synced ${rows.length} activities with full detail`);

    // Send Telegram report for each new activity
    const TELEGRAM_TOKEN   = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')   || '';

    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      for (const a of activities) {
        const detail = detailMap[a.id] || a;
        try {
          // Fetch HR stream for zone computation (sequential, same token)
          let zones: Record<string, number> | null = null;
          if (detail.average_heartrate && detail.max_heartrate) {
            const hrStream = await fetchHRStream(accessToken, a.id);
            if (hrStream && hrStream.length > 0) {
              zones = computeHRZones(hrStream, detail.max_heartrate);
            }
          }

          const reportText = buildActivityReport(detail, null, zones);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id:    TELEGRAM_CHAT_ID,
              text:       reportText,
              parse_mode: 'Markdown',
              disable_notification: false
            })
          });
          console.log(`[sync-strava] Telegram report sent for activity ${a.id} zones=${!!zones}`);
        } catch (tErr) {
          console.warn(`[sync-strava] Telegram report failed for ${a.id}:`, tErr);
        }
      }
    }

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
