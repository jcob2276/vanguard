import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { Tables } from '../database.types';
import { getDistance } from './exportStatsHelpers';
import {
  renderOuraSection,
  renderPhoneSection,
  renderAwSection,
  renderNutritionSection,
} from './exportStatsSections';
import { renderStravaSection } from './exportStatsStrava';
import { renderWorkoutSessions } from './exportStatsWorkout';
import { renderJournalAndHabits } from './exportStatsJournal';
import type {
  AwAppEntry,
  PhoneTopApp,
  StravaCleanActivity,
} from './exportStatsTypes';
import type { ExportData } from './exportStatsFetch';

interface RenderDailyParams {
  dateStr: string;
  d: ExportData;
  flags: {
    includeNutrition: boolean;
    includeJournal: boolean;
    includeOura: boolean;
    includeHabits: boolean;
    includeWorkouts: boolean;
    includeBody: boolean;
    includeActivityWatch: boolean;
  };
  userPOI: { name: string; lat: number | null | undefined; lng: number | null | undefined; radius: number }[];
  stravaCommentById: Map<string, string>;
  toWarsawDate: (iso: string | number | Date) => string;
}

function renderDevicesAndBody({
  flags,
  dayOura,
  dayOuraEnhanced,
  dayOuraDerived,
  dayPhone,
  dayAw,
  dayPhotos,
  dayBody,
}: {
  flags: RenderDailyParams['flags'];
  dayOura: Tables<'oura_daily_summary'> | null | undefined;
  dayOuraEnhanced: Tables<'oura_enhanced'> | undefined;
  dayOuraDerived: Record<string, unknown> | undefined;
  dayPhone: Tables<'phone_usage_daily'> | null | undefined;
  dayAw: Tables<'aw_daily_summary'> | null | undefined;
  dayPhotos: Tables<'progress_photos'>[];
  dayBody: Tables<'body_metrics'> | null | undefined;
}): string {
  let output = '';
  if (flags.includeOura && dayOura) {
    output += renderOuraSection({ dayOura, dayOuraEnhanced, dayOuraDerived });
  }
  if (dayPhone) {
    output += renderPhoneSection({
      dayPhone: {
        ...dayPhone,
        top_apps: dayPhone.top_apps as PhoneTopApp[] | null,
      },
    });
  }
  if (dayAw) {
    output += renderAwSection({
      dayAw: {
        ...dayAw,
        top_apps: dayAw.top_apps as AwAppEntry[] | null,
        web_domains: dayAw.web_domains as AwAppEntry[] | null,
      },
    });
  }
  if (dayPhotos && dayPhotos.length > 0) {
    output += `### 📸 Zdjęcia Postępu\n`;
    dayPhotos.forEach((p: Tables<'progress_photos'>, idx: number) => {
      output += `![Zdjęcie ${idx + 1}](${p.image_url})\n`;
    });
    output += `\n`;
  }
  if (flags.includeBody && dayBody) {
    output += `### ⚖️ Pomiary Ciała\n`;
    if (dayBody.weight) output += `- **Waga:** ${dayBody.weight} kg\n`;
    if (dayBody.waist) output += `- **Talia:** ${dayBody.waist} cm\n`;

    const extraMetrics = {
      neck: 'Szyja',
      chest: 'Klatka',
      hips: 'Biodra',
      belly: 'Brzuch',
      biceps_l: 'Biceps (L)',
      biceps_r: 'Biceps (P)',
      forearm: 'Przedramię',
      thigh: 'Udo',
      calf: 'Łydka',
    };
    Object.entries(extraMetrics).forEach(([key, label]) => {
      if ((dayBody as Record<string, unknown>)[key]) {
        output += `- **${label}:** ${(dayBody as Record<string, unknown>)[key]} cm\n`;
      }
    });
    output += `\n`;
  }
  return output;
}

export function renderDailySummaryMarkdown({
  dateStr,
  d,
  flags,
  userPOI,
  stravaCommentById,
  toWarsawDate,
}: RenderDailyParams): string {
  const {
    sessions,
    bodyMetrics,
    food: foodEntries,
    foodError,
    nutritionSummary: nutritionEntries,
    journal: journalEntries,
    telegramLogs: telegramEntries,
    habits,
    habitLogs,
    ouraData,
    ouraEnhanced,
    ouraDerived,
    photos,
    locationHistory,
    stravaData,
    phoneUsageData,
  } = d;

  const {
    includeNutrition,
    includeJournal,
    includeOura,
    includeHabits,
    includeWorkouts,
    includeBody,
    includeActivityWatch,
  } = flags;

  const daySessions = (sessions ?? []).filter((s: Tables<'workout_sessions'>) => s.date === dateStr);
  const dayFood = foodEntries.filter((f: Tables<'daily_food_entries'>) => f.date === dateStr);
  const dayNutrition = nutritionEntries.find((n: Tables<'daily_nutrition'>) => n.date === dateStr);
  const dayJournal = journalEntries.find((j: Tables<'daily_wins'>) => j.date === dateStr);
  const seenContent = new Set();
  const dayTelegramLogs = telegramEntries
    .filter((t: ExportData['telegramLogs'][number]) => t.created_at && toWarsawDate(t.created_at) === dateStr)
    .filter((t: ExportData['telegramLogs'][number]) => (t.metadata as Record<string, unknown>)?.mode === 'stream')
    .filter((t: ExportData['telegramLogs'][number]) => {
      const key = (t.content || '').trim();
      if (seenContent.has(key)) return false;
      seenContent.add(key);
      return true;
    });
  const dayBody = (bodyMetrics ?? []).find((b: Tables<'body_metrics'>) => b.date === dateStr);
  const dayOura = (ouraData ?? [])?.find((o: Tables<'oura_daily_summary'>) => o.date === dateStr);
  const dayOuraEnhanced = (ouraEnhanced ?? []).find((o: Tables<'oura_enhanced'>) => o.date === dateStr);
  const dayOuraDerived = (ouraDerived ?? []).find((o: ExportData['ouraDerived'][number]) => o.day === dateStr);
  const dayPhotos = (photos ?? [])?.filter((p: Tables<'progress_photos'>) => p.date === dateStr);
  const dayStrava = ((stravaData ?? []) as StravaCleanActivity[]).filter((a) => {
    if (!a.start_date) return false;
    const date = toWarsawDate(a.start_date);
    return date === dateStr;
  });
  const dayAw = includeActivityWatch
    ? (d.awSummary ?? []).find((a: Tables<'aw_daily_summary'>) => a.date === dateStr)
    : null;

  const hasAnyData =
    (includeWorkouts && (daySessions.length > 0 || dayStrava.length > 0)) ||
    (includeNutrition && (dayFood.length > 0 || dayNutrition)) ||
    (includeJournal && (dayJournal || dayTelegramLogs.length > 0)) ||
    (includeBody && dayBody) ||
    (includeOura && dayOura) ||
    dayPhotos?.length > 0 ||
    !!dayAw;

  let md = '';

  if (!hasAnyData) {
    md += `## ${format(parseISO(dateStr), 'd MMMM yyyy (EEEE)', { locale: pl })}\n`;
    md += `### ❌ DZIEŃ PRZEGRANY (Brak Celu)\n`;
    md += `*„Jeśli nie wypełniłem nawet nie dodałem pięciu zadań jakie są do zrobienia... to i tak wziąć się zalicza jako przegrany bo po prostu no nie zrobiłem niczego w kierunku swoich własnych marzeń więc tak naprawdę żyłem dzisiaj bez celu."*\n\n`;
    md += `---\n\n`;
    return md;
  }

  md += `## ${format(parseISO(dateStr), 'd MMMM yyyy (EEEE)', { locale: pl })}\n\n`;

  const dayPhone = (phoneUsageData ?? []).find((p: Tables<'phone_usage_daily'>) => p.date === dateStr);
  md += renderDevicesAndBody({
    flags,
    dayOura,
    dayOuraEnhanced,
    dayOuraDerived,
    dayPhone,
    dayAw,
    dayPhotos,
    dayBody,
  });

  const dayLocations = locationHistory?.filter(
    (l: Tables<'location_history'>) => l.created_at && toWarsawDate(l.created_at) === dateStr
  );
  const visitedPOIs = userPOI.filter((poi) =>
    dayLocations?.some(
      (loc: Tables<'location_history'>) =>
        getDistance(loc.latitude, loc.longitude, poi.lat!, poi.lng!) < poi.radius
    )
  );
  const detectedPlaces = [
    ...new Set(dayLocations?.filter((l: Tables<'location_history'>) => l.place_name).map((l: Tables<'location_history'>) => l.place_name)),
  ];

  if (visitedPOIs.length > 0 || detectedPlaces.length > 0) {
    md += `### 📍 Potwierdzone Lokalizacje\n`;
    visitedPOIs.forEach((poi) => {
      md += `- ✅ Obecność w: **${poi.name}**\n`;
    });
    detectedPlaces.forEach((place) => {
      if (!visitedPOIs.some((p) => p.name === place)) {
        md += `- 🤖 Wykryto: **${place}**\n`;
      }
    });
    md += `\n`;
  }

  if (includeWorkouts) {
    md += renderWorkoutSessions(daySessions);
  }

  if (includeWorkouts && dayStrava.length > 0) {
    md = renderStravaSection({
      md,
      dayStrava,
      stravaCommentById,
      ouraData: ouraData ?? [],
      ouraEnhanced: ouraEnhanced ?? [],
      toWarsawDate,
    });
  }

  if (includeNutrition) {
    const dayFoodData = foodEntries.filter((f: Tables<'daily_food_entries'>) => f.date === dateStr);
    const dayNutritionData = nutritionEntries.find((n: Tables<'daily_nutrition'>) => n.date === dateStr);
    md += renderNutritionSection({
      dayFood: dayFoodData,
      dayNutrition: dayNutritionData,
      foodError,
      _dayStrava: dayStrava,
    });
  }

  const dayHabitLogs = (habitLogs ?? []).filter((l: Tables<'habit_logs'>) => l.date === dateStr);
  md += renderJournalAndHabits({
    dayJournal: dayJournal as Tables<'daily_wins'>,
    dayTelegramLogs: dayTelegramLogs as Tables<'vanguard_stream'>[],
    dayHabitLogs,
    habits,
    includeJournal,
    includeHabits,
  });

  return md;
}
