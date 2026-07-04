/**
 * sync-intervals
 *
 * Syncs training activities from intervals.icu (which pulls from Garmin
 * Connect via its own official OAuth integration) into strava_activities.
 *
 * Replaces sync-strava: Strava's API now requires a paid subscription
 * (Application Inactive / 403 on every request, see lessons.md 2026-07-04).
 * intervals.icu auth is a static API key (Basic Auth) — no refresh_token
 * rotation, and the activities list endpoint already returns full detail
 * (HR, zones, TRIMP, cadence, pace) in one call, no separate detail/streams
 * fetch needed for the fields we store.
 *
 * Table/columns are reused from the Strava era (strava_activities,
 * strava_activities_clean view) so every downstream consumer (correlations,
 * fitness score, desktop dashboard, calendar) keeps working unchanged.
 * `source` distinguishes historical Strava rows from new intervals.icu rows.
 *
 * Trigger: HTTP (manual) or cron.
 */

import { createServiceClient, corsHeaders } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";

const VANGUARD_USER_ID = getVanguardUserId();

// Same cutoff sync-strava used — no training data before this matters.
const INITIAL_SYNC_FROM = "2026-05-20";

const supabase = createServiceClient();

/** True when intervals.icu tags the activity as coming from a source other than Garmin (e.g. an Oura auto-detected duplicate workout). */
function isNonGarminDuplicate(activity: any): boolean {
  const source = (activity.source || "").toUpperCase();
  return source !== "" && source !== "GARMIN_CONNECT" && source !== "MANUAL";
}

/** intervals.icu ids look like "i162610403" — strip the prefix for a stable bigint key. */
function toStravaId(activity: any): number | null {
  const digits = String(activity.id || "").replace(/^i/, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchActivities(
  athleteId: string,
  apiKey: string,
  oldest: string,
  newest: string,
): Promise<{ activities: any[]; status: number; error: string | null }> {
  const url = `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: "Basic " + btoa(`API_KEY:${apiKey}`) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[sync-intervals] API error ${res.status}:`, body);
    return { activities: [], status: res.status, error: body || `HTTP ${res.status}` };
  }

  const data = await res.json();
  return { activities: Array.isArray(data) ? data : [], status: res.status, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const forceFrom = url.searchParams.get("from");
    const forceTo = url.searchParams.get("to");

    const { data: tokenRow } = await supabase
      .from("intervals_tokens")
      .select("athlete_id, api_key")
      .eq("user_id", VANGUARD_USER_ID)
      .maybeSingle();

    if (!tokenRow?.api_key) {
      return new Response(JSON.stringify({ error: "No intervals.icu API key found in intervals_tokens" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let oldest: string;
    if (forceFrom) {
      oldest = forceFrom;
    } else {
      const { data: latest } = await supabase
        .from("strava_activities")
        .select("start_date")
        .eq("user_id", VANGUARD_USER_ID)
        .eq("source", "garmin_intervals")
        .eq("is_oura_duplicate", false)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest?.start_date) {
        const d = new Date(latest.start_date);
        d.setDate(d.getDate() - 3);
        oldest = d.toISOString().slice(0, 10);
      } else {
        oldest = INITIAL_SYNC_FROM;
      }
      if (oldest < INITIAL_SYNC_FROM) oldest = INITIAL_SYNC_FROM;
    }
    const newest = forceTo || new Date().toISOString().slice(0, 10);

    console.log(`[sync-intervals] Syncing ${oldest} .. ${newest}`);

    const { activities, status, error } = await fetchActivities(tokenRow.athlete_id, tokenRow.api_key, oldest, newest);

    if (error) {
      // Never silently report ok:true on a real API failure (that's exactly
      // the bug that hid the Strava paywall for 4 days — see lessons.md).
      return new Response(JSON.stringify({ ok: false, synced: 0, status, error }), {
        status: status === 429 ? 503 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (activities.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let primaryCount = 0;
    let duplicateCount = 0;
    const rows = [];

    for (const a of activities) {
      const stravaId = toStravaId(a);
      if (!stravaId) {
        console.warn("[sync-intervals] Skipping activity with unparseable id:", a.id);
        continue;
      }

      const isDup = isNonGarminDuplicate(a);
      if (isDup) duplicateCount++; else primaryCount++;

      const { skyline_chart_bytes: _skyline, ...rawLean } = a;

      rows.push({
        strava_id: stravaId,
        user_id: VANGUARD_USER_ID,
        name: a.name || null,
        sport_type: a.type || null,
        start_date: a.start_date || null,
        elapsed_time: a.elapsed_time ?? null,
        moving_time: a.moving_time ?? null,
        distance: a.distance ?? null,
        average_heartrate: a.has_heartrate ? (a.average_heartrate ?? null) : null,
        max_heartrate: a.has_heartrate ? (a.max_heartrate ?? null) : null,
        average_speed: a.average_speed ?? null,
        max_speed: a.max_speed ?? null,
        total_elevation_gain: a.total_elevation_gain ?? null,
        calories: a.calories ?? null,
        suffer_score: a.icu_training_load != null ? Math.round(a.icu_training_load) : null,
        perceived_exertion: a.icu_rpe ?? null,
        manual: false,
        hr_avg: a.average_heartrate ?? null,
        hr_max: a.max_heartrate ?? null,
        hr_source: a.has_heartrate ? "garmin_intervals" : null,
        hr_frozen: false,
        splits_with_hr: null,
        gear_name: a.gear?.name ?? null,
        gear_distance_km: a.gear?.converted_distance ?? null,
        is_oura_duplicate: isDup,
        raw_data: rawLean,
        synced_at: new Date().toISOString(),
        source: "garmin_intervals",
        icu_activity_id: a.id,
        icu_hr_zone_times: a.icu_hr_zone_times ?? null,
        trimp: a.trimp ?? null,
      });
    }

    const { error: upsertErr } = await supabase
      .from("strava_activities")
      .upsert(rows, { onConflict: "strava_id" });

    if (upsertErr) {
      console.error("[sync-intervals] Upsert error:", upsertErr);
      return new Response(JSON.stringify({ ok: false, error: upsertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[sync-intervals] Synced ${rows.length} activities (${primaryCount} primary + ${duplicateCount} duplicates)`);

    return new Response(JSON.stringify({
      ok: true,
      synced: rows.length,
      primary: primaryCount,
      duplicates: duplicateCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-intervals] fatal:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
