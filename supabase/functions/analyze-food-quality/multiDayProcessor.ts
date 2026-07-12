import { parseJsonFromContent } from '../_shared/deepseek.ts';
import { buildTrainingDayMap } from './helpers.ts';

export async function processMultiDay(supabase: any, userId: string, dateFrom: string, dateTo: string, apiKey: string, SYSTEM_PROMPT: string) {
  const [entriesR, fastingR, workoutsR, stravaR] = await Promise.all([
    supabase.from('daily_food_entries').select('date, name, brand, meal_type, calories, protein, carbs, fat, saturated_fat, sugar').eq('user_id', userId).gte('date', dateFrom).lte('date', dateTo).order('date').order('meal_type'),
    supabase.from('fasting_logs').select('date, note').eq('user_id', userId).gte('date', dateFrom).lte('date', dateTo),
    supabase.from('workout_sessions').select('date, workout_day, exercise_logs(exercise_name, muscle_tags)').eq('user_id', userId).gte('date', dateFrom).lte('date', dateTo),
    supabase.from('strava_activities_clean').select('start_date, sport_type, distance, workout_type').eq('user_id', userId).eq('is_oura', false),
  ]);

  if (entriesR.error) throw new Error(`DB error: ${entriesR.error.message}`);
  const entries = entriesR.data || [];
  if (entries.length === 0) return null;

  const fastingDays = new Map<string, string | null>((fastingR.data || []).map((f: any) => [f.date, f.note ?? null]));
  const trainingDayMap = buildTrainingDayMap(workoutsR.data || [], stravaR.data || []);

  const byDay: Record<string, any[]> = {};
  for (const e of entries) { if (!byDay[e.date]) byDay[e.date] = []; byDay[e.date].push(e); }

  const dayTotals: Record<string, number> = {};
  for (const [d, items] of Object.entries(byDay)) dayTotals[d] = items.reduce((sum, e) => sum + (e.calories ?? 0), 0);

  const incompleteDays = new Set(Object.entries(dayTotals).filter(([d, kcal]) => kcal < 800 && !fastingDays.has(d)).map(([d]) => d));

  const dayLines = Object.entries(byDay).map(([d, items]) => {
    const kcalTotal = dayTotals[d];
    const isFasting = fastingDays.has(d);
    const fastingNote = isFasting ? ` 🔵 POST${fastingDays.get(d) ? ` — ${fastingDays.get(d)}` : ''} (pomijaj)` : '';
    const incompleteNote = incompleteDays.has(d) ? ` ⚠️ NIEPEŁNY (${kcalTotal} kcal)` : '';
    const trainingNote = trainingDayMap[d] ? ` 🏋️ ${trainingDayMap[d]}` : '';
    const proteinTotal = items.reduce((s, e) => s + (e.protein ?? 0), 0);
    const lines = items.slice(0, 40).map(e => `  - ${e.name}${e.brand ? ` (${e.brand})` : ''} | ${e.calories ?? '?'} kcal | B:${e.protein ?? '?'}g W:${e.carbs ?? '?'}g T:${e.fat ?? '?'}g${e.saturated_fat != null ? ` Nas:${e.saturated_fat}g` : ''}${e.sugar != null ? ` Cuk:${e.sugar}g` : ''}`).join('\n');
    return `DZIEŃ ${d} (${items.length} pozycji, ${kcalTotal} kcal, B:${Math.round(proteinTotal)}g)${fastingNote}${incompleteNote}${trainingNote}:\n${lines}`;
  }).join('\n\n');

  const fastingOnlyLines = [...fastingDays.entries()].filter(([d]) => !byDay[d]).map(([d, note]) => `DZIEŃ ${d} (0 pozycji, 0 kcal) 🔵 POST${note ? ` — ${note}` : ''}: Post — pomiń.`).join('\n\n');

  const numDays = Object.keys(byDay).length + [...fastingDays.keys()].filter(d => !byDay[d]).length;
  const trainingDaysCount = Object.keys(trainingDayMap).length;

  const userMessage = `OKRES DO ANALIZY: ${dateFrom} → ${dateTo} (${numDays} dni, ${incompleteDays.size} niepełnych, ${fastingDays.size} postów, ${trainingDaysCount} dni treningowych)\n\n${dayLines}${fastingOnlyLines ? '\n\n' + fastingOnlyLines : ''}\n\nZADANIE — zwróć JSON:\n- "days": tablica ${numDays} obiektów: {"date":"YYYY-MM-DD","score":0-100,"summary":"1 zdanie PL"}\n- "avg_score": 0-100 (średnia z KOMPLETNYCH dni)\n- "pattern_analysis": 3-4 zdania PL\n- "top_issues": 3 fraz PL\n- "strengths": 3 fraz PL\n- "action_steps": 3 kroków PL\n- "nutrition_profile": 1-2 zdania PL\n- "trend": "improving"|"stable"|"degrading"\n- "trend_note": 1 zdanie PL\n- "chronic_gaps": max 3 PL\n- "best_day": "YYYY-MM-DD"\n- "worst_day": "YYYY-MM-DD"\n- "training_nutrition_note": 1-2 zdania PL\n\nWAŻNE: TYLKO surowy JSON, bez markdown.`;

  return { userMessage, fastingDays, incompleteDays };
}

export function parseMultiDayResult(content: string, fastingDays: Map<string, string | null>, incompleteDays: Set<string>) {
  let parsed: any = parseJsonFromContent(content);
  if (!parsed) throw new Error('Parse error');
  if (!parsed?.days || !Array.isArray(parsed.days)) {
    const raw = parsed as Record<string, unknown> | null;
    const altDays = raw?.results || raw?.result || raw?.data || raw?.daily_analysis || raw?.analysis;
    if (Array.isArray(altDays)) parsed = { ...raw, days: altDays };
    else throw new Error('Nieprawidłowa struktura odpowiedzi AI');
  }
  parsed.days = parsed.days.map((d: Record<string, unknown>) => {
    const date = (d.date || d.data || d.day || d.dzien || d.day_date || '') as string;
    const isFasting = fastingDays.has(date);
    return { date, score: isFasting ? 0 : Number(d.score ?? 0), summary: isFasting ? (fastingDays.get(date) || 'Post') : (d.summary || '') as string, incomplete: incompleteDays.has(date), fasting: isFasting };
  });
  const responseDates = new Set(parsed.days.map((d: { date: string }) => d.date));
  for (const [d, note] of fastingDays) { if (!responseDates.has(d)) parsed.days.push({ date: d, score: 0, summary: note || 'Post', incomplete: false, fasting: true }); }
  parsed.days.sort((a: any, b: any) => a.date.localeCompare(b.date));
  const completeDays = parsed.days.filter((d: any) => !d.incomplete && !d.fasting);
  if (completeDays.length > 0) parsed.avg_score = Math.round(completeDays.reduce((s: number, d: any) => s + d.score, 0) / completeDays.length);
  return parsed;
}
