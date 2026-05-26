/**
 * analyze-training
 *
 * Porównuje plan treningowy (training_plan_workouts) z faktycznymi aktywnościami
 * ze Stravy (strava_activities_clean) za pomocą DeepSeek.
 *
 * Wywołanie: POST /functions/v1/analyze-training
 * Body (opcjonalne): { "weeks": [1, 2] }  — domyślnie aktywne tygodnie
 *
 * Zwraca analizę jako tekst + wysyła ją przez Telegram.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { sendMessage } from "../_shared/telegram.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { getWarsawDayBoundaries } from "../_shared/time.ts";

const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';
const TELEGRAM_TOKEN   = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');
const VANGUARD_USER_ID = getVanguardUserId();

const supabase = createServiceClient();

function fmtPace(movingTime: number, distanceM: number): string {
  if (!movingTime || !distanceM) return '—';
  const s = movingTime / (distanceM / 1000);
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} /km`;
}

function fmtTime(sec: number): string {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const sendTelegram = body.telegram !== false;

    // 1. Pobierz plan
    const { data: plan, error: planErr } = await supabase
      .from('training_plan_workouts')
      .select('*')
      .eq('user_id', VANGUARD_USER_ID)
      .order('planned_date', { ascending: true });

    if (planErr) throw new Error('Plan query error: ' + planErr.message);
    if (!plan || plan.length === 0) {
      return new Response(JSON.stringify({ ok: false, message: 'Brak planu treningowego w DB.' }), { status: 200 });
    }

    // 2. Pobierz Strava za okres planu (od najwcześniejszej do najpóźniejszej daty planu + 1 tydzień)
    const dates = plan.map((w: any) => w.planned_date).filter(Boolean).sort();
    const fromDate = dates[0];
    const toDate   = new Date(new Date(dates[dates.length - 1]).getTime() + 7 * 86400000).toISOString().split('T')[0];

    const { start: fromStart } = getWarsawDayBoundaries(fromDate);
    const { end: toEnd } = getWarsawDayBoundaries(toDate);
    const { data: activities } = await supabase
      .from('strava_activities_clean')
      .select('*')
      .eq('user_id', VANGUARD_USER_ID)
      .gte('start_date', fromStart)
      .lt('start_date', toEnd)
      .order('start_date', { ascending: true });

    // 3. Zbuduj kontekst tekstowy dla LLM
    const planText = plan.map((w: any) => {
      const targets = [
        w.target_duration_min  ? `czas: ${w.target_duration_min} min` : null,
        w.target_distance_km   ? `dystans: ${w.target_distance_km} km` : null,
        w.target_hr_max        ? `HR max: ${w.target_hr_max} BPM` : null,
        w.target_pace_min_km   ? `tempo: ${w.target_pace_min_km}–${w.target_pace_max_km || '?'} /km` : null,
      ].filter(Boolean).join(', ');

      return [
        `[Tydzień ${w.week_number} | ${w.day_of_week} | ${w.planned_date}]`,
        `Typ: ${w.workout_type} | Nazwa: ${w.workout_name}`,
        targets ? `Cele: ${targets}` : '',
        `Opis: ${(w.description || '').substring(0, 300)}`,
        `Cel ogólny: ${w.goal || '—'}`,
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    const activitiesText = (activities || []).length > 0
      ? (activities || []).map((a: any) => {
          const dt = new Date(a.start_date).toLocaleString('pl-PL', {
            timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', weekday: 'short',
            hour: '2-digit', minute: '2-digit'
          });
          const dist = a.distance ? `${(a.distance / 1000).toFixed(2)} km` : '—';
          const pace = fmtPace(a.moving_time, a.distance);
          const dur  = fmtTime(a.moving_time || a.elapsed_time);
          const hr   = a.average_heartrate
            ? `HR śr. ${Math.round(a.average_heartrate)} / max ${a.max_heartrate ?? '?'}`
            : 'brak HR';
          return `• ${dt} | "${a.name}" | ${dist} | ${dur} | tempo ${pace} | ${hr}`;
        }).join('\n')
      : 'Brak aktywności Strava w tym okresie.';

    // 4. DeepSeek — analiza plan vs reality
    const prompt = `Jesteś analitykiem planu treningowego biegacza. Masz dostęp do planu treningowego i faktycznych aktywności ze Stravy.

PLAN TRENINGOWY:
${planText}

FAKTYCZNE AKTYWNOŚCI (Strava):
${activitiesText}

Wykonaj analizę plan vs reality:

1. **WYKONANE vs PLANOWANE** — dla każdego zaplanowanego treningu powiedz: czy był wykonany (znajdź dopasowanie w Stravie po dacie i typie), kiedy dokładnie, co się zgadzało a co nie.

2. **ANALIZA PARAMETRÓW** — dla wykonanych treningów:
   - HR: czy utrzymał założone limity (np. 155 BPM dla ER)?
   - Tempo: czy mieściło się w założeniach?
   - Czas/dystans: czy osiągnął plan?
   - Odchylenia: co konkretnie wyszło poza targety i o ile?

3. **TRENINGI NIEPLANOWANE** — aktywności z Stravy które nie pasują do żadnego dnia planu.

4. **OCENA TYGODNIA** — krótko: co poszło dobrze, co wymaga korekty w kolejnym tygodniu.

5. **JEDNA REKOMENDACJA** — jeden konkretny wniosek na następny trening.

Styl: zimne fakty, liczby, bez motywowania. Max 400 słów.`;

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: 'Jesteś analitykiem planu treningowego. Odpowiadasz po polsku, krótko i konkretnie.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text().catch(() => '');
      throw new Error(`DeepSeek error ${dsRes.status}: ${errText.substring(0, 200)}`);
    }
    const dsData = await dsRes.json();
    console.log('[analyze-training] dsData keys:', Object.keys(dsData), 'choices:', dsData.choices?.length);
    const analysis = dsData.choices?.[0]?.message?.content?.trim() || ('Brak odpowiedzi. Raw: ' + JSON.stringify(dsData).substring(0, 300));

    // 5. Wyślij przez Telegram
    if (sendTelegram && TELEGRAM_CHAT_ID) {
      const header = `📊 *Analiza treningowa — plan vs Strava*\n\n`;
      // Telegram ma limit 4096 znaków
      const msg = (header + analysis).substring(0, 4096);
      await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, msg, { parseMode: 'Markdown' });
    }

    console.log('[analyze-training] done, analysis length:', analysis.length);
    return new Response(JSON.stringify({ ok: true, analysis }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[analyze-training] error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
