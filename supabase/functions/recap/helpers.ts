function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function monthThemeSourceForWeek(weekStart: string): string {
  const [y, m] = weekStart.split("-").map(Number);
  if (m === 1) return `${y - 1}-12-01`;
  return `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

function getSprintInfoForDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00Z");
  const yr = d.getUTCFullYear();
  let anchor = new Date(`${yr}-03-01T12:00:00Z`);
  if (d.getTime() < anchor.getTime()) anchor = new Date(`${yr - 1}-03-01T12:00:00Z`);
  const personalYear = anchor.getFullYear();
  const daysSince = Math.floor((d.getTime() - anchor.getTime()) / 86400000);
  const weeksSince = Math.floor(daysSince / 7);
  const sprintNumber = Math.floor(weeksSince / 12) + 1;
  return { personalYear, sprintNumber };
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function isVoiceEntry(source: string | null, content: string | null): boolean {
  if (source === "identity_vault") return true;
  if (source === "telegram" && content && content.length > 150) return true;
  return false;
}

function avgBedtimeLabel(timestamps: string[]): string | null {
  const minutes = timestamps.map((ts) => {
    const d = new Date(ts);
    const h = parseInt(d.toLocaleString("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hour12: false }), 10);
    const m = parseInt(d.toLocaleString("en-GB", { timeZone: "Europe/Warsaw", minute: "2-digit" }), 10);
    const total = h * 60 + m;
    return h < 12 ? total + 24 * 60 : total;
  });
  const avg = mean(minutes);
  if (avg === null) return null;
  const wrapped = Math.round(avg) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export { addDaysStr, monthThemeSourceForWeek, getSprintInfoForDate, mean, isVoiceEntry, avgBedtimeLabel };
