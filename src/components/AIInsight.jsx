import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { gatherUserContext } from '../lib/aiContext';
import { MessageSquare, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

export default function AIInsight({ session }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchInsight() {
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();

      // 1. Fetch current intent
      const { data: intent } = await supabase
        .from('vanguard_calendar')
        .select('summary')
        .lte('start_time', now)
        .gte('end_time', now)
        .maybeSingle();

      // 2. Fetch Latest Real-time Behavior (Desktop & Mobile YouTube)
      const { data: awData } = await supabase
        .from('vanguard_footprint')
        .select('payload, timestamp')
        .eq('category', 'activitywatch_v2')
        .order('timestamp', { ascending: false })
        .limit(1);

      const { data: ytData } = await supabase
        .from('vanguard_youtube')
        .select('title, timestamp')
        .order('timestamp', { ascending: false })
        .limit(3);

      const latestActivity = awData?.[0];
      const activityAgeMin = latestActivity ? (new Date() - new Date(latestActivity.timestamp)) / 1000 / 60 : Infinity;
      
      // Only treat as active behavior if data is fresher than 15 minutes
      const behavior = activityAgeMin < 15 ? latestActivity?.payload : null;
      const isStale = activityAgeMin >= 15 && latestActivity;
      
      // 3. Fetch Big Picture Context (Biometrics, Goals, Fundamentals, Habits)
      const { data: biometrics } = await supabase.from('oura_daily_summary').select('*').order('date', { ascending: false }).limit(1);
      /* Temporarily disabled failing legacy tables
      const { data: yt } = await supabase
        .from('vanguard_youtube')
        .select('title, timestamp')
        .order('timestamp', { ascending: false })
        .limit(3);
      
      const { data: fundamentals } = await supabase.from('vanguard_fundamentals').select('payload').order('timestamp', { ascending: false }).limit(3);
      */
      
      const { data: goals } = await supabase.from('life_goals').select('*').eq('user_id', session.user.id).maybeSingle();
      
      const today = new Date().toISOString().split('T')[0];
      const { data: habitsToday } = await supabase
        .from('habit_logs')
        .select('*, habits(name, is_positive)')
        .eq('date', today);

      const { data: goals_raw } = await supabase
        .from('life_goals')
        .select('*')
        .single();
      
      const vaultContext = goals_raw?.vault_content ? `--- SKARBIEC TOŻSAMOŚCI (KIM JESTEM) ---\n${goals_raw.vault_content.substring(0, 5000)}\n` : '';

      const { data: foodToday } = await supabase
        .from('daily_food_entries')
        .select('*')
        .eq('date', today);

      const { data: powerListToday } = await supabase
        .from('daily_wins')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      const { data: lastWorkout } = await supabase
        .from('workout_sessions')
        .select('*, exercise_logs(*)')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: lastReview } = await supabase
        .from('weekly_reviews')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      const now_dt = new Date();
      const timeContext = `AKTUALNY CZAS LOKALNY: ${now_dt.toLocaleTimeString('pl-PL')} (${now_dt.toLocaleDateString('pl-PL')})`;
      
      const powerListContext = powerListToday ? `POWER LISTA (5 ZADAŃ): 
      1. ${powerListToday.task_1} [${powerListToday.done_1 ? 'ZALICZONE' : 'W TRAKCIE'}]
      2. ${powerListToday.task_2} [${powerListToday.done_2 ? 'ZALICZONE' : 'W TRAKCIE'}]
      3. ${powerListToday.task_3} [${powerListToday.done_3 ? 'ZALICZONE' : 'W TRAKCIE'}]
      4. ${powerListToday.task_4} [${powerListToday.done_4 ? 'ZALICZONE' : 'W TRAKCIE'}]
      5. ${powerListToday.task_5} [${powerListToday.done_5 ? 'ZALICZONE' : 'W TRAKCIE'}]
      DZIENNIK: Nastrój: ${powerListToday.mood_score}/5, Wdzięczność: ${powerListToday.gratitude_entry || 'brak'}, Refleksja: ${powerListToday.journal_entry || 'brak'}` : 'Power Lista i Dziennik nie rozpoczęte.';

      const latestOura = biometrics?.[0];
      const sleepContext = latestOura ? `OSTATNI SEN: Od ${latestOura.bedtime_timestamp?.split('T')[1]?.substring(0,5) || 'n/a'} do [Pobudka]. Czas snu: ${latestOura.total_sleep_hours}h. Gotowość: ${latestOura.readiness_score}%.` : 'Brak danych o śnie.';

      let systemMessage = `Jesteś Strategicznym Obserwatorem Digital Twin 2.0. Twoim zadaniem jest holistyczna analiza życia użytkownika. 
      ${timeContext}
      ${sleepContext}
      `;
      
      systemMessage += `\n--- KONTEKST BIOLOGICZNY (OURA) ---\n${JSON.stringify(latestOura || 'Brak danych')}\n`;
      systemMessage += `\n${vaultContext}\n`;
      systemMessage += `\n--- CELE DŁUGOTERMINOWE ---\n${goals_raw ? `CIAŁO: ${goals_raw.goal_cialo}, DUCH: ${goals_raw.goal_duch}, KONTO: ${goals_raw.goal_konto}` : 'Brak zdefiniowanych celów'}\n`;
      
      const habitsContext = habitsToday?.map(h => `${h.habits.name}: ${h.habits.is_positive ? 'ZREALIZOWANO (SUKCES)' : 'ZŁAMANO (SABOTAŻ)'}`).join(', ') || 'Brak zalogowanych nawyków dzisiaj';
      systemMessage += `\n--- DZISIEJSZE NAWYKI ---\n${habitsContext}\n`;
      
      const foodContext = foodToday?.map(f => `${f.meal_type}: ${f.name} (${f.calories}kcal, B:${f.protein}g)`).join(', ') || 'Brak wpisów w diecie';
      systemMessage += `\n--- PALIWO (DIETA DZISIAJ) ---\n${foodContext}\n`;

      systemMessage += `\n--- POWER LISTA & DZIENNIK ---\n${powerListContext}\n`;
      systemMessage += `\n--- OSTATNI TRENING ---\n${lastWorkout ? `Dzień: ${lastWorkout.workout_day}, Data: ${lastWorkout.date}, Ćwiczenia: ${lastWorkout.exercise_logs?.length || 0} serii.` : 'Brak danych o treningach.'}\n`;
      systemMessage += `\n--- OSTATNI PRZEGLĄD TYGODNIA ---\n${lastReview ? `Duma: ${lastReview.proud_of}, Sabotaż: ${lastReview.sabotage}, Wnioski: ${lastReview.do_differently}` : 'Brak przeglądu tygodnia.'}\n`;

      let activeIntent = intent?.summary;
      if (!activeIntent) {
        const hour = now_dt.getHours();
        if (hour >= 0 && hour < 6) activeIntent = "SEN / REGENERACJA (Automatyczny)";
        else if (hour >= 22) activeIntent = "PRZYGOTOWANIE DO SNU (Automatyczny)";
        else activeIntent = "TRYB OPERACYJNY WOLNY";
      }

      systemMessage += `\n--- AKTUALNA MISJA (PLAN) ---\n"${activeIntent}"\n`;

      if (behavior) {
        const { window, afk, web } = behavior;
        systemMessage += `\n--- RZECZYWISTOŚĆ DESKTOP ---\n${afk === 'afk' ? 'AFK' : `Aplikacja: ${window?.app}, Okno: ${window?.title}`}\n`;
      } else if (isStale) {
        systemMessage += `\n--- RZECZYWISTOŚĆ DESKTOP ---\nSTATUS: POZA KOMPUTEREM (OFFLINE). Ostatnia aktywność: ${Math.round(activityAgeMin)} min temu. NIE zakładaj, że użytkownik siedzi przed monitorem.\n`;
      } else {
        systemMessage += `\n--- RZECZYWISTOŚĆ DESKTOP ---\nBrak danych (OFFLINE).\n`;
      }

      systemMessage += `\nZADANIE: Dokonaj brutalnej syntezy. Jest godzina ${now_dt.toLocaleTimeString('pl-PL')}. Biorąc pod uwagę, że użytkownik ostatnio spał ${latestOura?.total_sleep_hours || 'nieznaną ilość'} godzin i ma przed sobą cele [Wymień je], oceń jego obecne zachowanie. Czy siedzenie teraz przy komputerze to optymalizacja czy autodestrukcja? Bądź bezlitosny, ale logiczny.`;

      const { data, error: functionError } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          plan: intent?.summary || 'Brak planu w kalendarzu',
          behavior: systemMessage
        }
      });

      if (functionError) throw functionError;
      if (data?.text) setInsight(data.text);
    } catch (err) {
      console.error('AI Insight Error:', err);
      setError(`Błąd: ${err.message || 'System interpretacji jest chwilowo niedostępny.'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInsight();
  }, []);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 animate-pulse">
        <div className="h-2 w-24 bg-neutral-800 rounded mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-neutral-800 rounded"></div>
          <div className="h-3 w-2/3 bg-neutral-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!insight && !error) return null;

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-1000"></div>

        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary animate-pulse" />
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest italic">System Mirror Mode</h3>
          </div>
          <button
            onClick={fetchInsight}
            className="text-neutral-600 hover:text-white transition-colors"
            title="Odśwież analizę"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {error ? (
          <p className="text-[11px] font-bold text-neutral-600 uppercase italic">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="text-[14px] font-normal text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {(() => {
                if (!insight) return null;
                const keywords = [
                  'CO SIĘ DZIEJE', 'DLACZEGO', 'CO TO OZNACZA', 'ROZKAZ OPERACYJNY',
                  'POST_WIN_COLLAPSE', 'NIGHT_DOPAMINE_LOOP', 'RECOVERY_DEBT', 'HIGH_FRAGMENTATION',
                  'CHAOS', 'LOCKED_IN', 'AVOIDANCE', 'STABLE', 'MOMENTUM', 'RECOVERY',
                  'Operational Drift', 'Biometric Strain', 'Signal Noise'
                ];
                const regex = new RegExp(`(${keywords.join('|')})`, 'g');
                return insight.split(regex).map((part, i) =>
                  keywords.includes(part) ? <span key={i} className="text-primary font-black uppercase tracking-tight">{part}</span> : part
                );
              })()}
            </div>
            <div className="pt-4 border-t border-white/5">
              <p className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.2em]">Strategiczny Obserwator v1.0</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
