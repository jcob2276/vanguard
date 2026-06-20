/** Calendar date YYYY-MM-DD in Europe/Warsaw. */
export function getWarsawDateString(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

function warsawDayStartUTCMs(dateStr: string): number {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const tzLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    timeZoneName: "shortOffset",
  }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value || "GMT+2";
  const m = tzLabel.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = m?.[1] === "+" ? 1 : -1;
  const offsetMs = sign * ((parseInt(m?.[2] || "2", 10) * 60 + parseInt(m?.[3] || "0", 10)) * 60000);
  return new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs;
}

/** UTC ISO bounds for a Warsaw calendar day (for DB range queries). */
export function getWarsawDayBoundaries(dateStr: string): { start: string; end: string } {
  const startUTC = warsawDayStartUTCMs(dateStr);
  // Next Warsaw calendar date, computed from noon UTC (always inside the same Warsaw day
  // regardless of offset) + 24h — never drifts across a DST transition the way the date
  // string itself could if shifted by a flat 86400000ms.
  const nextDateStr = new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + 86400000)
    .toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
  return {
    start: new Date(startUTC).toISOString(),
    // On a DST transition day, the next Warsaw midnight is 23h or 25h after this one —
    // recompute its own offset instead of assuming a flat +86400000ms.
    end: new Date(warsawDayStartUTCMs(nextDateStr)).toISOString(),
  };
}

export type StreamCutoffs = {
  cut24h: string;
  cut72h: string;
  cut21d: string;
};

export function getStreamCutoffs(now = new Date()): StreamCutoffs {
  const t = now.getTime();
  return {
    cut24h: new Date(t - 24 * 60 * 60 * 1000).toISOString(),
    cut72h: new Date(t - 72 * 60 * 60 * 1000).toISOString(),
    cut21d: new Date(t - 21 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
