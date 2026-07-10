import { getTodayWarsaw, formatWarsawDate } from '../date';

export const SPRINT_SEASON = ['', 'Wiosna', 'Lato', 'Jesień', 'Zima'];
const SPRINT_DAYS = 84; // 12 × 7

export function getSprintInfo() {
  const ds = getTodayWarsaw();
  const d = new Date(ds + 'T12:00:00Z');
  const yr = d.getUTCFullYear();
  let anchor = new Date(`${yr}-03-01T12:00:00Z`);
  if (d.getTime() < anchor.getTime()) anchor = new Date(`${yr - 1}-03-01T12:00:00Z`);
  const personalYear = anchor.getFullYear();
  const daysSince = Math.floor((d.getTime() - anchor.getTime()) / 86400000);
  const weeksSince = Math.floor(daysSince / 7);
  const sprintNumber = Math.floor(weeksSince / 12) + 1;
  const weekInSprint = (weeksSince % 12) + 1;
  const dayInSprint = daysSince % SPRINT_DAYS;
  const startOffset = (sprintNumber - 1) * SPRINT_DAYS;
  const sprintStart = (() => { const d = new Date(anchor); d.setUTCDate(d.getUTCDate() + startOffset); return d; })();
  const sprintEnd = (() => { const d = new Date(anchor); d.setUTCDate(d.getUTCDate() + startOffset + 83); return d; })();
  const prevStart = sprintNumber > 1 ? (() => { const d = new Date(anchor); d.setUTCDate(d.getUTCDate() + startOffset - SPRINT_DAYS); return d; })() : null;
  const prevEnd = prevStart ? (() => { const d = new Date(anchor); d.setUTCDate(d.getUTCDate() + startOffset - 1); return d; })() : null;
  const fmt = (dt: Date) => formatWarsawDate(dt);
  return {
    personalYear,
    sprintNumber,
    weekInSprint,
    dayInSprint,
    daysLeft: SPRINT_DAYS - dayInSprint - 1,
    pct: Math.round((dayInSprint / SPRINT_DAYS) * 100),
    sprintStart: fmt(sprintStart),
    sprintEnd: fmt(sprintEnd),
    prevStart: prevStart ? fmt(prevStart) : null,
    prevEnd: prevEnd ? fmt(prevEnd) : null
  };
}
