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
 * HR architecture:
 *   - Primary source: Strava GPS watch (hr_source='strava')
 *   - Fallback: Oura Ring auto-sync duplicate (hr_source='oura')
 *   - Frozen sensor detection: >60% of splits locked at hr_max → hr_frozen=true
 *   - splits_with_hr: Strava pace/GAP/elev merged with Oura per-split HR
 *
 * Trigger: HTTP (manual) or cron (optional)
 */

import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";

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

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Strava API helpers
// ---------------------------------------------------------------------------

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
      // 429 mid-pagination means later pages are missing — caller must surface this
      // instead of reporting a clean partial sync as ok:true.
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

async function fetchHRStream(accessToken: string, activityId: number): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate&key_by_type=true`, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.heartrate?.data || null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// HR quality & merge logic
// ---------------------------------------------------------------------------

/** True when activity name or device indicates it's an Oura auto-sync */
function isOuraDuplicate(activity: any): boolean {
  const name = (activity.name || '').toLowerCase();
  const device = (activity.device_name || '').toLowerCase();
  return device.includes('oura') || /\d+%.*oura/i.test(name);
}

/**
 * Detect frozen Oura sensor:
 * >60% of splits have HR within 0.5 bpm of hr_max  →  sensor locked
 */
function detectFrozenSensor(splits: any[], hrMax: number | null): boolean {
  if (!hrMax) return false;
  const hrValues = splits.map(s => s.average_heartrate).filter(h => h != null) as number[];
  if (hrValues.length < 3) return false;
  const frozenCount = hrValues.filter(h => Math.abs(h - hrMax) < 0.5).length;
  return frozenCount / hrValues.length > 0.6;
}

/**
 * Overlay Oura per-split HR onto Strava splits (pace/GAP/elev from Strava).
 * Uses split index to align — tolerates slight distance differences.
 */
function mergeHRIntoSplits(stravaSplits: any[], ouraSplits: any[]): any[] {
  if (!ouraSplits?.length) return stravaSplits;
  const ouraByIdx = new Map<number, number>(
    ouraSplits.map(s => [s.split, s.average_heartrate])
  );
  return stravaSplits.map(s => ({
    ...s,
    average_heartrate: ouraByIdx.get(s.split) ?? s.average_heartrate ?? null,
  }));
}

/**
 * Build a map: primary_strava_id → oura_detail
 * Matches by sport_type + start_date within 120s.
 */
function pairOuraDuplicates(
  primaries: any[],
  ouras: any[],
  detailMap: Record<number, any>
): Map<number, any> {
  const pairs = new Map<number, any>();
  for (const oura of ouras) {
    const ouraStart = new Date(oura.start_date).getTime();
    const primary = primaries.find(p => {
      const pStart = new Date(p.start_date).getTime();
      return (
        p.sport_type === oura.sport_type &&
        Math.abs(pStart - ouraStart) < 120_000
      );
    });
    if (primary) {
      const ouraDetail = detailMap[oura.id] || oura;
      pairs.set(primary.id, ouraDetail);
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// HR zone computation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Telegram report builder
// ---------------------------------------------------------------------------

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

function buildActivityReport(
  detail: any,
  oura: any | null,
  zones: Record<string, number> | null,
  hrFrozen: boolean,
): string {
  const name       = detail.name || 'Trening';
  const sport      = detail.sport_type || detail.type || '';
  const distKm     = detail.distance ? (detail.distance / 1000).toFixed(2) : '—';
  const movingFmt  = fmtTime(detail.moving_time);
  const elapsedFmt = fmtTime(detail.elapsed_time);
  const stopped    = (detail.elapsed_time || 0) - (detail.moving_time || 0);
  const pace       = fmtPace(detail.average_speed);
  const hrAvg      = oura?.average_heartrate
    ? Math.round(oura.average_heartrate)
    : (detail.average_heartrate ? Math.round(detail.average_heartrate) : null);
  const hrMax      = oura?.max_heartrate
    ? Math.round(oura.max_heartrate)
    : (detail.max_heartrate ? Math.round(detail.max_heartrate) : null);
  const hrSource   = oura ? 'Oura' : (detail.average_heartrate ? 'Strava' : null);
  const elev       = detail.total_elevation_gain != null ? detail.total_elevation_gain : null;
  const cadence    = detail.average_cadence ? Math.round(detail.average_cadence * 2) : null;
  const calories   = detail.calories && detail.calories > 0 ? Math.round(detail.calories) : null;
  const suffer     = detail.suffer_score || null;
  const device     = detail.device_name  || null;
  const rpe        = detail.perceived_exertion || null;
  const gearName   = detail.gear?.name || null;

  const startLocal = detail.start_date_local
    ? new Date(detail.start_date_local).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : '';

  let t = `🏃 *${name}* (${sport}) — ${startLocal}\n`;
  t += `━━━━━━━━━━━━━━━━━━━━\n`;

  t += `*${distKm} km* | ${movingFmt} moving`;
  if (stopped > 30) t += ` | ⏸ ${fmtTime(stopped)} pauz`;
  t += `\n`;
  t += `Tempo: *${pace}*`;
  if (hrAvg) {
    t += ` | HR: *${hrAvg}* / max *${hrMax}*`;
    if (hrSource) t += ` [${hrSource}]`;
    if (hrFrozen) t += ` ⚠️ sensor lock`;
  }
  if (elev != null) t += ` | ↑${elev}m`;
  t += `\n`;
  if (cadence) t += `Kadencja: ${cadence} spm\n`;
  if (calories) t += `Kalorie: ${calories} kcal\n`;
  if (suffer)   t += `Suffer score: ${suffer}\n`;
  if (rpe)      t += `RPE: ${rpe}/10\n`;
  if (gearName) t += `Buty: ${gearName}\n`;
  if (device && device !== 'Strava App') t += `Urządzenie: ${device}\n`;

  // Oura recovery context
  if (oura) {
    // nothing extra here — HR already shown above
  }

  // HR Zones
  if (zones && hrMax) {
    t += `\n━━ ❤️ STREFY HR (max ${hrMax}) ━━\n`;
    t += `Z1 <${Math.round(hrMax * 0.60)}: ${zones.Z1}% `;
    t += `Z2 ${Math.round(hrMax * 0.60)}–${Math.round(hrMax * 0.70)}: ${zones.Z2}% `;
    t += `Z3: ${zones.Z3}%\n`;
    t += `Z4 ${Math.round(hrMax * 0.80)}–${Math.round(hrMax * 0.90)}: ${zones.Z4}% `;
    t += `Z5 >${Math.round(hrMax * 0.90)}: ${zones.Z5}%\n`;
  }

  // Splits — use merged (Strava pace + Oura HR) if available
  const ouraSplits = oura?.splits_metric || [];
  const ouraByIdx  = new Map<number, number>(ouraSplits.map((s: any) => [s.split, s.average_heartrate]));
  const splits: any[] = detail.splits_metric || [];

  if (splits.length > 0) {
    t += `\n━━ 📍 SPLITS (km) ━━\n`;

    const fullSplits = splits.filter((s: any) => (s.elapsed_time - s.moving_time) < 30);
    if (fullSplits.length >= 2) {
      const firstHR = ouraByIdx.get(fullSplits[0].split) ?? fullSplits[0].average_heartrate;
      const lastHR  = ouraByIdx.get(fullSplits[fullSplits.length - 1].split) ?? fullSplits[fullSplits.length - 1].average_heartrate;
      if (firstHR && lastHR) {
        const driftDiff = Math.round(lastHR) - Math.round(firstHR);
        const driftNote = driftDiff > 5
          ? `⬆️ +${driftDiff}bpm (cardiac drift — zmęczenie/odwodnienie)`
          : driftDiff < -5
          ? `⬇️ ${driftDiff}bpm (HR spadało — rozgrzewka / neg split)`
          : `✅ stabilny (${driftDiff > 0 ? '+' : ''}${driftDiff}bpm)`;
        t += `Cardiac drift: ${driftNote}\n`;
      }
    }

    if (splits.length >= 2) {
      const half = Math.floor(splits.length / 2);
      const avgFirst  = splits.slice(0, half).reduce((s: number, k: any) => s + k.average_speed, 0) / half;
      const avgSecond = splits.slice(half).reduce((s: number, k: any) => s + k.average_speed, 0) / (splits.length - half);
      const diff = avgFirst - avgSecond;
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
      const hr     = ouraByIdx.get(s.split) ?? s.average_heartrate;
      const hrStr  = hr ? ` | ${Math.round(hr)}bpm` : '';
      const gap    = s.average_grade_adjusted_speed && Math.abs(s.average_grade_adjusted_speed - s.average_speed) > 0.05
        ? ` | GAP ${fmtPace(s.average_grade_adjusted_speed)}`
        : '';
      const el     = s.elevation_difference != null
        ? ` | ${s.elevation_difference >= 0 ? '↑' : '↓'}${Math.abs(s.elevation_difference).toFixed(1)}m`
        : '';
      t += `  km${s.split}: *${fmtPace(s.average_speed)}* (${fmtTime(s.moving_time)})${hrStr}${gap}${el}${paused}\n`;
    }
  }

  // Best efforts
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

  // Segment PRs
  const prSegments = (detail.segment_efforts || [])
    .filter((s: any) => s.pr_rank && s.pr_rank <= 3)
    .sort((a: any, b: any) => a.pr_rank - b.pr_rank)
    .slice(0, 5);
  if (prSegments.length > 0) {
    t += `\n━━ 📌 SEGMENTY (PRs) ━━\n`;
    for (const s of prSegments) {
      const medal = s.pr_rank === 1 ? '🥇' : s.pr_rank === 2 ? '🥈' : '🥉';
      const distM = s.distance < 1000 ? `${Math.round(s.distance)}m` : `${(s.distance / 1000).toFixed(1)}km`;
      t += `  ${medal} ${s.name} (${distM}): *${fmtTime(s.elapsed_time)}*\n`;
    }
  }

  return t;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

    // Fetch detail for all activities (sequential to respect rate limit)
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

    // Partition: primary activities vs Oura auto-sync duplicates
    const primaryActivities = activities.filter(a => !isOuraDuplicate(a));
    const ouraActivities    = activities.filter(a => isOuraDuplicate(a));
    const ouraPairs         = pairOuraDuplicates(primaryActivities, ouraActivities, detailMap);

    console.log(`[sync-strava] ${primaryActivities.length} primary, ${ouraActivities.length} Oura duplicates, ${ouraPairs.size} paired`);

    const rows = [];
    for (const a of activities) {
      if (incompleteIds.includes(a.id)) continue; // skip — will be retried on next sync (3-day window)
      const detail    = detailMap[a.id] || a;
      const isDup     = isOuraDuplicate(a);
      const ouraDetail = isDup ? null : ouraPairs.get(a.id) ?? null;

      // --- HR resolution ---
      // Priority: Strava native HR (GPS watch) > Oura overlay > DB oura_heartrate fallback
      let hrAvg: number | null    = null;
      let hrMax: number | null    = null;
      let hrSource: string | null = null;
      let hrFrozen                = false;
      let splitsWithHR: any[]     = detail.splits_metric || [];

      if (detail.average_heartrate && detail.has_heartrate) {
        // Strava has real HR from a watch
        hrAvg    = detail.average_heartrate;
        hrMax    = detail.max_heartrate;
        hrSource = 'strava';
        // Frozen check on strava HR too (unlikely but possible)
        hrFrozen = detectFrozenSensor(detail.splits_metric || [], hrMax);
      } else if (ouraDetail?.average_heartrate) {
        // Overlay Oura HR
        hrAvg    = ouraDetail.average_heartrate;
        hrMax    = ouraDetail.max_heartrate;
        hrSource = 'oura';
        hrFrozen = detectFrozenSensor(ouraDetail.splits_metric || [], hrMax);
        // Merge Oura per-split HR into Strava splits
        splitsWithHR = mergeHRIntoSplits(
          detail.splits_metric || [],
          ouraDetail.splits_metric || []
        );
      } else if (!isDup) {
        // Fallback: Query Oura HR samples from oura_heartrate table for this activity's window
        const startTime = new Date(a.start_date);
        const duration = a.elapsed_time || a.moving_time || 0;
        const endTime = new Date(startTime.getTime() + duration * 1000);

        const { data: dbHrSamples } = await supabase
          .from('oura_heartrate')
          .select('ts, bpm')
          .eq('user_id', VANGUARD_USER_ID)
          .gte('ts', startTime.toISOString())
          .lte('ts', endTime.toISOString())
          .order('ts', { ascending: true });

        if (dbHrSamples && dbHrSamples.length > 0) {
          const bpms = dbHrSamples.map(r => r.bpm);
          hrAvg = Math.round(bpms.reduce((sum, val) => sum + val, 0) / bpms.length);
          hrMax = Math.max(...bpms);
          hrSource = 'oura';
          hrFrozen = detectFrozenSensor(detail.splits_metric || [], hrMax);

          // Calculate split HRs
          const splits = detail.splits_metric || [];
          let currentOffsetMs = 0;
          const newSplits = [];
          for (const split of splits) {
            const splitElapsed = split.elapsed_time || split.moving_time;
            const splitStart = new Date(startTime.getTime() + currentOffsetMs);
            const splitEnd = new Date(startTime.getTime() + currentOffsetMs + splitElapsed * 1000);
            currentOffsetMs += splitElapsed * 1000;

            const splitSamples = dbHrSamples.filter(r => {
              const t = new Date(r.ts).getTime();
              return t >= splitStart.getTime() && t < splitEnd.getTime();
            });

            let splitAvg = null;
            if (splitSamples.length > 0) {
              const sum = splitSamples.reduce((sum, val) => sum + val.bpm, 0);
              splitAvg = Math.round(sum / splitSamples.length);
            } else {
              // nearest sample fallback
              let nearest = null;
              let minDiff = Infinity;
              const splitMid = splitStart.getTime() + (splitElapsed * 1000) / 2;
              for (const r of dbHrSamples) {
                const diff = Math.abs(new Date(r.ts).getTime() - splitMid);
                if (diff < minDiff) {
                  minDiff = diff;
                  nearest = r.bpm;
                }
              }
              splitAvg = nearest;
            }

            newSplits.push({
              ...split,
              average_heartrate: splitAvg
            });
          }
          splitsWithHR = newSplits;
          console.log(`[sync-strava] Resolved HR from DB oura_heartrate for activity ${a.id}: avg=${hrAvg}, max=${hrMax}, samples=${dbHrSamples.length}`);
        }
      }

      // Strip segment_efforts from raw_data to keep storage lean
      // (segment PRs are signalled via pr_count + achievement_count)
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
        // Native Strava HR (from watch) — null if Strava App without HRM
        average_heartrate:    detail.has_heartrate ? (detail.average_heartrate ?? null) : null,
        max_heartrate:        detail.has_heartrate ? (detail.max_heartrate ?? null) : null,
        average_speed:        a.average_speed ?? null,
        max_speed:            a.max_speed ?? null,
        total_elevation_gain: a.total_elevation_gain ?? null,
        calories:             (detail.calories && detail.calories > 0) ? detail.calories : null,
        suffer_score:         detail.suffer_score ?? null,
        perceived_exertion:   detail.perceived_exertion ?? null,
        manual:               a.manual ?? false,
        // Resolved HR (best available source)
        hr_avg:               hrAvg,
        hr_max:               hrMax,
        hr_source:            hrSource,
        hr_frozen:            hrFrozen,
        splits_with_hr:       splitsWithHR.length > 0 ? splitsWithHR : null,
        // Gear
        gear_name:            detail.gear?.name ?? null,
        gear_distance_km:     detail.gear?.converted_distance ?? null,
        // Duplicate flag
        is_oura_duplicate:    isDup,
        // Raw data (without heavy segment_efforts array)
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

    // Telegram activity reports removed — data is available in the app widget instead.

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
});
