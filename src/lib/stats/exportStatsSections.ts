import { TIMEZONE } from '../../lib/date';
import type { Tables } from '../database.types';
import type { AwAppEntry, PhoneTopApp } from './exportStatsTypes';

interface OURASectionParams {
  dayOura: Tables<'oura_daily_summary'>;
  dayOuraEnhanced: Tables<'oura_enhanced'> | undefined;
  dayOuraDerived: Record<string, unknown> | undefined;
}

export function renderOuraSection({ dayOura, dayOuraEnhanced, dayOuraDerived }: OURASectionParams): string {
  let md = `### 💍 Oura Ring\n`;
  md += `- **Readiness:** ${dayOura.readiness_score || '--'} | **Sleep Score:** ${dayOuraEnhanced?.sleep_score || '--'} | **Activity Score:** ${dayOuraEnhanced?.activity_score || '--'}\n`;

  if (dayOuraEnhanced?.bedtime_start || dayOuraEnhanced?.bedtime_end) {
    const fmtWaw = (iso: string | null) => {
      if (!iso) return '--';
      return new Date(iso).toLocaleTimeString('pl-PL', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });
    };
    const bedStart = dayOuraEnhanced.bedtime_start;
    const latMin = dayOuraEnhanced.sleep_latency_minutes || 0;
    const onsetIso = bedStart ? new Date(new Date(bedStart).getTime() + latMin * 60000).toISOString() : null;
    const wokeUpStr = dayOuraEnhanced.wake_up_timestamp ? ` → 🔔 Obudził się: ${fmtWaw(dayOuraEnhanced.wake_up_timestamp)}` : '';
    md += `- **Harmonogram snu:** 🛏️ Łóżko: ${fmtWaw(bedStart)} → 😴 Sen od: ${fmtWaw(onsetIso)}${wokeUpStr} → 🚶 Wstał: ${fmtWaw(dayOuraEnhanced.bedtime_end)}\n`;
  }

  md += `- **Sen:** ${dayOura.total_sleep_hours || '--'}h`;
  if (dayOuraEnhanced) {
    const deepH = dayOuraEnhanced.deep_sleep_hours ? `${dayOuraEnhanced.deep_sleep_hours.toFixed(1)}h` : '--';
    const remH = dayOuraEnhanced.rem_sleep_hours ? `${dayOuraEnhanced.rem_sleep_hours.toFixed(1)}h` : '--';
    const lightH = dayOuraEnhanced.light_sleep_hours ? `${dayOuraEnhanced.light_sleep_hours.toFixed(1)}h` : '--';
    const latencyMin = dayOuraEnhanced.sleep_latency_minutes ? `${dayOuraEnhanced.sleep_latency_minutes}m` : '--';
    const efficiency = dayOuraEnhanced.sleep_efficiency ? `${dayOuraEnhanced.sleep_efficiency}%` : '--';
    md += ` (Głęboki: ${deepH}, REM: ${remH}, Lekki: ${lightH}, Latencja: ${latencyMin}, Wydajność: ${efficiency})`;
  }
  md += `\n`;
  md += `- **Kroki:** ${dayOura.steps || '--'}`;
  if (dayOuraEnhanced?.active_calories) {
    md += ` | **Aktywne kalorie:** ${dayOuraEnhanced.active_calories} kcal (Suma: ${dayOuraEnhanced.total_calories || '--'} kcal)`;
  }
  md += `\n`;

  if (dayOuraEnhanced || dayOuraDerived) {
    const hrMin = dayOuraDerived?.sleep_hr_min || dayOuraEnhanced?.sleep_lowest_heart_rate || '--';
    const hrAvg = dayOuraDerived?.sleep_hr_avg || dayOuraEnhanced?.sleep_average_heart_rate || '--';
    const hrvAvg = dayOuraDerived?.sleep_hrv_avg || dayOuraEnhanced?.sleep_average_hrv || '--';
    const hrvPeak = dayOuraDerived?.sleep_hrv_peak || '--';
    md += `- **Tętno i HRV (Sen):** Min: ${hrMin} bpm | Średnie: ${hrAvg} bpm || Średnie HRV: ${hrvAvg} ms`;
    if (hrvPeak !== '--') md += ` | Szczytowe HRV: ${hrvPeak} ms`;
    md += `\n`;
  }

  if (dayOuraEnhanced) {
    const stressMin = dayOuraEnhanced.stress_high_minutes || 0;
    const recovMin = dayOuraEnhanced.recovery_high_minutes || 0;
    const resilience = dayOuraEnhanced.resilience_level || '--';
    md += `- **Stres i Regeneracja:** Stres (wysoki): ${stressMin} min | Regeneracja: ${recovMin} min | Odporność (Resilience): ${resilience}\n`;

    const tempDev = dayOuraEnhanced.temperature_deviation != null ? `${dayOuraEnhanced.temperature_deviation > 0 ? '+' : ''}${dayOuraEnhanced.temperature_deviation.toFixed(2)}°C` : '--';
    const vo2 = dayOuraEnhanced.vo2_max || '--';
    const breathDisturb = dayOuraEnhanced.breathing_disturbance_index || '--';
    md += `- **Biomarkery:** Temp: ${tempDev} | VO2 Max: ${vo2} | Zaburzenia oddychania: ${breathDisturb}\n`;
  }

  md += `- **Dyscyplina:** ${dayOura.is_disciplined ? 'TAK' : 'NIE'}\n\n`;
  return md;
}

interface PhoneSectionParams {
  dayPhone: {
    entertainment_minutes: number | null;
    social_minutes: number | null;
    messaging_minutes: number | null;
    ai_minutes: number | null;
    unlocks: number | null;
    late_night_minutes: number | null;
    total_minutes: number | null;
    top_apps: PhoneTopApp[] | null;
  };
}

export function renderPhoneSection({ dayPhone }: PhoneSectionParams): string {
  let md = '';
  const parts = [
    (dayPhone.entertainment_minutes ?? 0) > 0 ? `🎬 ${dayPhone.entertainment_minutes}m` : null,
    (dayPhone.social_minutes ?? 0) > 0        ? `📲 soc: ${dayPhone.social_minutes}m` : null,
    (dayPhone.messaging_minutes ?? 0) > 0     ? `💬 msg: ${dayPhone.messaging_minutes}m` : null,
    (dayPhone.ai_minutes ?? 0) > 0            ? `🤖 AI: ${dayPhone.ai_minutes}m` : null,
    (dayPhone.unlocks ?? 0) > 0               ? `🔓 ${dayPhone.unlocks}x` : null,
  ].filter(Boolean).join(' | ');
  const lnAlert = (dayPhone.late_night_minutes ?? 0) > 60 ? ` 🌙 PO 23:00: **${dayPhone.late_night_minutes}m** ⚠️` : (dayPhone.late_night_minutes ?? 0) > 0 ? ` 🌙 ${dayPhone.late_night_minutes}m` : '';
  md += `### 📱 Telefon (AW)\n`;
  md += `- **Łącznie:** ${dayPhone.total_minutes}min | ${parts}${lnAlert}\n`;
  if (dayPhone.top_apps?.length) {
    const top3 = ((dayPhone.top_apps ?? []) as PhoneTopApp[]).slice(0, 3).map(a => `${a.app} (${a.min}m)`).join(', ');
    md += `- **Top:** ${top3}\n`;
  }
  md += `\n`;
  return md;
}

interface AwSectionParams {
  dayAw: {
    total_active_seconds: number | null;
    total_afk_seconds: number | null;
    phone_active_seconds: number | null;
    productivity_ratio: number | null;
    top_apps: AwAppEntry[] | null;
    web_domains: AwAppEntry[] | null;
  };
}

export function renderAwSection({ dayAw }: AwSectionParams): string {
  let md = '';
  const fmtSeconds = (totalSecs: number) => {
    if (!totalSecs) return '0m';
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const makeProgressBar = (ratio: number) => {
    const size = 10;
    const val = Number(ratio);
    if (isNaN(val)) return '`[░░░░░░░░░░]`';
    const dots = Math.min(size, Math.max(0, Math.round(val * size)));
    const emptyDots = size - dots;
    return '`[' + '█'.repeat(dots) + '░'.repeat(emptyDots) + ']`';
  };

  md += `### 💻 Aktywność na komputerze (ActivityWatch)\n`;
  md += `- **Czas aktywności (PC):** ${fmtSeconds(dayAw.total_active_seconds ?? 0)} (AFK: ${fmtSeconds(dayAw.total_afk_seconds ?? 0)})\n`;
  if (dayAw.phone_active_seconds) {
    md += `- **Czas aktywności (telefon):** ${fmtSeconds(dayAw.phone_active_seconds)}\n`;
  }
  if (dayAw.productivity_ratio != null) {
    const pct = Math.round(dayAw.productivity_ratio * 100);
    md += `- **Ratio produktywności:** ${makeProgressBar(dayAw.productivity_ratio)} **${pct}%**\n`;
  }

  if (dayAw.top_apps && (dayAw.top_apps as AwAppEntry[]).length > 0) {
    md += `- **Top aplikacje:**\n`;
    (dayAw.top_apps as AwAppEntry[]).slice(0, 5).forEach((app, idx) => {
      const appSec = app.seconds || 0;
      const appPct = dayAw.total_active_seconds ? Math.round((appSec / dayAw.total_active_seconds) * 100) : 0;
      md += `  ${idx + 1}. \`${app.app}\` — ${fmtSeconds(appSec)} (${appPct}%)\n`;
    });
  }

  if (dayAw.web_domains && (dayAw.web_domains as AwAppEntry[]).length > 0) {
    md += `- **Top domeny:**\n`;
    (dayAw.web_domains as AwAppEntry[]).slice(0, 5).forEach((domain, idx) => {
      const domSec = domain.seconds || 0;
      const domPct = dayAw.total_active_seconds ? Math.round((domSec / dayAw.total_active_seconds) * 100) : 0;
      md += `  ${idx + 1}. \`${domain.app}\` — ${fmtSeconds(domSec)} (${domPct}%)\n`;
    });
  }
  md += `\n`;
  return md;
}

interface NutritionSectionParams {
  dayFood: Tables<'daily_food_entries'>[];
  dayNutrition: Tables<'daily_nutrition'> | undefined;
  foodError: { message: string } | null;
  _dayStrava: unknown[];
}

export function renderNutritionSection({ dayFood, dayNutrition, foodError }: NutritionSectionParams): string {
  let md = '';
  if (dayFood.length > 0) {
    md += `### 🥗 Dieta (Vanguard)\n`;
    const meals = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąski' };

    Object.entries(meals).forEach(([key, label]) => {
      const mealItems = dayFood.filter(f => f.meal_type === key);
      if (mealItems.length > 0) {
        md += `#### ${label}\n`;
        mealItems.forEach(item => {
          const extras = [
            item.fiber != null ? `Bł: ${item.fiber}g` : null,
            item.sugar != null ? `Cuk: ${item.sugar}g` : null,
            item.saturated_fat != null ? `Nas: ${item.saturated_fat}g` : null,
            item.salt != null ? `Sól: ${item.salt}g` : null,
            item.insulin_load != null ? `IL_est: ${item.insulin_load}` : null,
          ].filter(Boolean).join(' | ');
          const brandStr = item.brand ? ` — ${item.brand}` : '';
          const timeStr = item.logged_at
            ? `${new Date(item.logged_at).toLocaleTimeString('pl-PL', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' })} — `
            : '';
          md += `- ${timeStr}${item.name}${brandStr} (${item.amount || ''}): ${item.calories} kcal | B: ${item.protein}g | W: ${item.carbs || 0}g | T: ${item.fat || 0}g${extras ? ' | ' + extras : ''}\n`;
        });
      }
    });

    const totalCal = dayFood.reduce((sum, f) => sum + (f.calories || 0), 0);
    const totalProt = dayFood.reduce((sum, f) => sum + (Number(f.protein) || 0), 0);
    const totalCarb = dayFood.reduce((sum, f) => sum + (Number(f.carbs) || 0), 0);
    const totalFat = dayFood.reduce((sum, f) => sum + (Number(f.fat) || 0), 0);
    const totalFiber = dayFood.reduce((sum, f) => sum + (Number(f.fiber) || 0), 0);
    const totalSugar = dayFood.reduce((sum, f) => sum + (Number(f.sugar) || 0), 0);
    const totalIL = dayFood.reduce((sum, f) => sum + (Number(f.insulin_load) || 0), 0);

    const proteinDensity = totalCal > 0 ? ((totalProt / totalCal) * 100).toFixed(1) : '0.0';
    const sugarAlert = totalSugar > 50 ? ' ⚠️ (Wysoki cukier!)' : '';
    const fiberSugarStr = [
      totalFiber > 0 ? `Bł: ${totalFiber.toFixed(1)}g` : null,
      totalSugar > 0 ? `Cuk: ${totalSugar.toFixed(1)}g${sugarAlert}` : null
    ].filter(Boolean).join(' | ');

    const ilLabel = totalIL < 120 ? 'niski' : totalIL < 200 ? 'umiarkowany' : 'wysoki';
    md += `\n**Suma dnia: ${totalCal} kcal | B: ${totalProt.toFixed(1)}g | W: ${totalCarb.toFixed(1)}g | T: ${totalFat.toFixed(1)}g${fiberSugarStr ? ' | ' + fiberSugarStr : ''}**\n`;
    md += `_Gęstość białka: ${proteinDensity}g / 100 kcal | IL_est: ${totalIL.toFixed(1)} — ${ilLabel}_\n\n`;
  } else if (dayNutrition) {
    md += `### 🥗 Dieta (Vanguard)\n`;
    md += foodError
      ? `Nie udało się pobrać szczegółowych produktów z \`daily_food_entries\`: ${foodError.message}\n\n`
      : `Brak szczegółowych produktów w \`daily_food_entries\`, ale dzienna suma makro jest zapisana.\n\n`;
    const calories = dayNutrition.calories || 0;
    const protein = Number(dayNutrition.protein || 0);
    const density = calories > 0 ? ((protein / calories) * 100).toFixed(1) : '0.0';
    md += `**Suma dnia: ${calories} kcal | B: ${protein.toFixed(1)}g**\n`;
    md += `_Gęstość białka: ${density}g / 100 kcal_\n\n`;
  }
  return md;
}
