import { TIMEZONE } from '../../lib/date';
import type { StravaCleanActivity, StravaSplit, StravaBestEffort, GcHrZone } from './exportStatsTypes';
import type { Tables as DatabaseTables } from '../database.types';

interface StravaSectionParams {
  md: string;
  dayStrava: StravaCleanActivity[];
  stravaCommentById: Map<string, string>;
  ouraData: DatabaseTables<'oura_daily_summary'>[] | null;
  ouraEnhanced: DatabaseTables<'oura_enhanced'>[] | null;
  toWarsawDate: (v: string | number | Date) => string;
}

export function renderStravaSection({
  md,
  dayStrava,
  stravaCommentById,
  ouraData,
  ouraEnhanced,
  toWarsawDate,
}: StravaSectionParams): string {
  const result = md;

  const fmtPaceMd = (secPerKm: number) => {
    if (!secPerKm) return '—';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, '0')}/km`;
  };
  const fmtTimeMd = (sec: number) => {
    if (!sec) return '—';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };

  let out = result + `### 🏃 Bieganie (Strava)\n\n`;
  dayStrava.forEach(a => {
    const startTime = new Date(a.start_date ?? '').toLocaleTimeString('pl-PL', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });
    const distKm = a.distance ? (a.distance / 1000).toFixed(2) : null;
    const paceStr = a.pace_sec_per_km
      ? fmtPaceMd(a.pace_sec_per_km)
      : (a.moving_time && a.distance ? fmtPaceMd(Math.round(a.moving_time / (a.distance / 1000))) : '—');
    const movingFmt = fmtTimeMd(a.moving_time ?? 0);
    const hrAvg = a.hr_avg ? Math.round(a.hr_avg) : null;
    const hrMax = a.hr_max ? Math.round(a.hr_max) : null;
    const hrSrc = a.hr_source === 'oura' ? 'Oura Ring' : a.hr_source === 'strava' ? 'Strava/GPS' : null;
    const frozen = a.hr_frozen;
    const paused = (a.pause_seconds || 0) > 30;

    const workoutLabels: Record<number, string> = { 1: 'Wyścig 🏁', 2: 'Długi bieg 🏔️', 3: 'Trening / Interwały ⚡' };
    const workoutLabel = a.workout_type != null ? workoutLabels[a.workout_type] || null : null;

    out += `#### ${a.name}${a.has_pr ? ' 🏆 PR' : ''} — ${startTime}${workoutLabel ? ` · ${workoutLabel}` : ''}\n`;
    out += `| Dystans | Tempo | Czas ruchu | Kadencja |\n`;
    out += `|---------|-------|------------|----------|\n`;
    out += `| **${distKm ?? '—'} km** | **${paceStr}** | **${movingFmt}** | **${a.cadence_spm ? a.cadence_spm + ' spm' : '—'}** |\n\n`;

    if (hrAvg) {
      out += `**Tętno:** ${hrAvg}${hrMax ? `/${hrMax}` : ''} BPM`;
      if (hrSrc) out += ` _(źródło: ${hrSrc})_`;
      if (frozen) out += ` ⚠️ **sensor lock** — czujnik zamrożony, dane HR nierzetelne`;
      out += `\n`;
    }
    if (a.perceived_exertion) out += `**RPE:** ${a.perceived_exertion}/10\n`;

    if (a.gc_enriched_at) {
      const gcParts = [];
      if (a.gc_training_effect_aerobic != null) gcParts.push(`TE aerob: **${a.gc_training_effect_aerobic}**`);
      if (a.gc_training_effect_anaerobic != null) gcParts.push(`TE anaerob: **${a.gc_training_effect_anaerobic}**`);
      if (a.gc_vo2max != null) gcParts.push(`VO2max: **${a.gc_vo2max}**`);
      if ((a.gc_weather as Record<string, unknown>)?.temp_c != null) {
        const gw = a.gc_weather as Record<string, unknown>;
        gcParts.push(`${gw.temp_c}°C${gw.condition ? ` ${gw.condition}` : ''}${gw.humidity != null ? ` ${gw.humidity}% wilg.` : ''}`);
      }
      if (gcParts.length > 0) out += `**Garmin Connect:** ${gcParts.join(' | ')}\n`;
      if (Array.isArray(a.gc_hr_zones) && a.gc_hr_zones.length > 0) {
        const zones = (a.gc_hr_zones as unknown as GcHrZone[]).map((z, i) => {
          const mins = z.secsInZone != null ? Math.round(z.secsInZone / 60) : null;
          return mins != null && mins > 0 ? `Z${i + 1}: ${mins}min` : null;
        }).filter(Boolean);
        if (zones.length > 0) out += `**Strefy HR (GC):** ${zones.join(' | ')}\n`;
      }
    }

    // HRV context from Oura: pre-run (day of run) + post-run (day after)
    const runDate = toWarsawDate(a.start_date ?? '');
    const [ry, rm, rd] = runDate.split('-').map(Number);
    const nextDateObj = new Date(ry, rm - 1, rd + 1);
    const nextDate = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth() + 1).padStart(2, '0')}-${String(nextDateObj.getDate()).padStart(2, '0')}`;
    const ouraPreRun = (ouraData ?? [])?.find(o => o.date === runDate);
    const ouraPostRun = (ouraData ?? [])?.find(o => o.date === nextDate);
    const enhancedPre = (ouraEnhanced ?? [])?.find(o => o.date === runDate);

    if (ouraPreRun?.hrv_avg || ouraPostRun?.hrv_avg || enhancedPre?.vo2_max || enhancedPre?.temperature_deviation != null) {
      out += `**Kontekst Biometryczny (Oura):**\n`;
      if (ouraPreRun?.hrv_avg || ouraPostRun?.hrv_avg) {
        out += `- **HRV:**`;
        if (ouraPreRun?.hrv_avg) out += ` przed: **${Math.round(ouraPreRun.hrv_avg)} ms**${ouraPreRun.rhr_avg ? ` (RHR ${Math.round(ouraPreRun.rhr_avg)} bpm)` : ''}`;
        if (ouraPostRun?.hrv_avg) out += ` → po: **${Math.round(ouraPostRun.hrv_avg)} ms**${ouraPostRun.rhr_avg ? ` (RHR ${Math.round(ouraPostRun.rhr_avg)} bpm)` : ''}`;
        const hrvDelta = (ouraPreRun?.hrv_avg && ouraPostRun?.hrv_avg)
          ? Math.round(ouraPostRun.hrv_avg - ouraPreRun.hrv_avg) : null;
        if (hrvDelta !== null) out += ` _(${hrvDelta >= 0 ? '+' : ''}${hrvDelta} ms regeneracja)_`;
        out += `\n`;
      }
      if (enhancedPre?.vo2_max) {
        out += `- **VO2 Max:** ${enhancedPre.vo2_max} ml/kg/min\n`;
      }
      if (enhancedPre?.temperature_deviation != null) {
        const tempDev = enhancedPre.temperature_deviation;
        out += `- **Odchylenie temperatury ciała:** ${tempDev > 0 ? '+' : ''}${tempDev.toFixed(2)}°C\n`;
      }
    }

    if (a.total_elevation_gain) out += `**Przewyższenie:** +${Math.round(a.total_elevation_gain)} m\n`;
    if (a.gear_name) out += `**Buty:** ${a.gear_name}${a.gear_distance_km ? ` (${Math.round(a.gear_distance_km)} km przebiegu)` : ''}\n`;
    if (paused) out += `**Przerwy:** ${fmtTimeMd(a.pause_seconds ?? 0)}\n`;
    const athleteComment = stravaCommentById.get(String(a.strava_id ?? ''));
    if (athleteComment) out += `**Komentarz zawodnika:** ${athleteComment}\n`;

    // Splits table
    const splits = a.splits_with_hr as unknown as StravaSplit[];
    if (splits && splits.length > 0) {
      const hasGapMd = splits.some(s => s.average_grade_adjusted_speed != null);
      out += `\n**Splity:**\n`;
      out += hasGapMd
        ? `| km | Clock | GAP | HR | Elev |\n|----|-------|-----|-----|------|\n`
        : `| km | Clock | HR | Elev |\n|----|-------|-----|------|\n`;
      splits.forEach(s => {
        const clockSec = s.moving_time && s.distance
          ? Math.round(s.moving_time / (s.distance / 1000))
          : s.average_speed ? Math.round(1000 / s.average_speed) : null;
        const gapSec = s.average_grade_adjusted_speed
          ? Math.round(1000 / s.average_grade_adjusted_speed) : null;
        const sPace = clockSec ? fmtPaceMd(clockSec) : '—';
        const sGap = hasGapMd ? (gapSec ? fmtPaceMd(gapSec) : '—') : null;
        const sHR = s.average_heartrate ? Math.round(s.average_heartrate) : '—';
        const sElev = s.elevation_difference != null
          ? `${s.elevation_difference >= 0 ? '+' : ''}${s.elevation_difference.toFixed(1)}m`
          : '—';
        const sPause = (s.elapsed_time || 0) - (s.moving_time || 0);
        const pauseStr = sPause > 20 ? ` ⏸${fmtTimeMd(sPause)}` : '';
        out += hasGapMd
          ? `| ${s.split} | ${sPace}${pauseStr} | ${sGap} | ${sHR} | ${sElev} |\n`
          : `| ${s.split} | ${sPace}${pauseStr} | ${sHR} | ${sElev} |\n`;
      });
    }

    // Best efforts
    const bestEffortNames = ['400m', '1K', '1 mile', '2 mile', '5K', '10K'];
    const efforts = ((a.best_efforts as unknown as StravaBestEffort[]) ?? []).filter(e => bestEffortNames.includes(e.name));
    if (efforts.length > 0) {
      out += `\n**Best Efforts:**\n`;
      efforts.forEach(e => {
        const t = fmtTimeMd(e.moving_time);
        const pr = e.pr_rank === 1 ? ' 🥇 PR#1' : e.pr_rank === 2 ? ' 🥈 PR#2' : e.pr_rank === 3 ? ' 🥉 PR#3' : '';
        out += `- **${e.name}**: ${t}${pr}\n`;
      });
    }

    out += `\n`;
  });
  out += `\n`;

  return out;
}
