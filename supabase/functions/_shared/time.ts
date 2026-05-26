/** Calendar date YYYY-MM-DD in Europe/Warsaw. */
export function getWarsawDateString(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

/** UTC ISO bounds for a Warsaw calendar day (for DB range queries). */
export function getWarsawDayBoundaries(dateStr: string): { start: string; end: string } {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const tzLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    timeZoneName: "shortOffset",
  }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value || "GMT+2";
  const m = tzLabel.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = m?.[1] === "+" ? 1 : -1;
  const offsetMs = sign * ((parseInt(m?.[2] || "2", 10) * 60 + parseInt(m?.[3] || "0", 10)) * 60000);
  const startUTC = new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs;
  return {
    start: new Date(startUTC).toISOString(),
    end: new Date(startUTC + 86400000).toISOString(),
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
