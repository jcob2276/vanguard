/** Calendar date YYYY-MM-DD in Europe/Warsaw. */
export function getWarsawDateString(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

function warsawDayStartUTCMs(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  
  // W strefie Europe/Warsaw, midnight to najwcześniej 22:00 UTC poprzedniego dnia, a najpóźniej 23:00 UTC.
  // Spróbujmy najpierw sprawdzić 22:00 UTC poprzedniego dnia (dla offsetu +2)
  const t22 = Date.UTC(year, month - 1, day - 1, 22, 0, 0);
  const formatted22 = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(t22).replace(/\//g, "-");
  
  if (formatted22 === dateStr) {
    return t22;
  }
  
  // W przeciwnym razie to musi być 23:00 UTC poprzedniego dnia (dla offsetu +1)
  return Date.UTC(year, month - 1, day - 1, 23, 0, 0);
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
  cut14d: string;
  cut21d: string;
};

export function getStreamCutoffs(baseDate: Date = new Date()): StreamCutoffs {
  const cut24hMs = baseDate.getTime() - 24 * 60 * 60 * 1000;
  const cut72hMs = baseDate.getTime() - 72 * 60 * 60 * 1000;
  const cut14dMs = baseDate.getTime() - 14 * 24 * 60 * 60 * 1000;
  const cut21dMs = baseDate.getTime() - 21 * 24 * 60 * 60 * 1000;

  return {
    cut24h: new Date(cut24hMs).toISOString(),
    cut72h: new Date(cut72hMs).toISOString(),
    cut14d: new Date(cut14dMs).toISOString(),
    cut21d: new Date(cut21dMs).toISOString(),
  };
}
