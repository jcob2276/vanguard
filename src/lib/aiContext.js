import { format, subDays } from 'date-fns';
import { detectState, calculateIdentityScore, discoverPatterns, OPERATING_STATES } from './stateEngine';

export async function gatherUserContext(supabase, userId) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  
  // 1. Fetch all relevant data
  const { data: oura } = await supabase.from('oura_daily_summary').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(7);
  const { data: dailyWins } = await supabase.from('daily_wins').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(14);
  const { data: nutrition } = await supabase.from('daily_nutrition').select('protein').eq('date', today).maybeSingle();
  const { data: workout } = await supabase.from('workout_sessions').select('id').eq('date', today).maybeSingle();
  const { data: fundament } = await supabase.from('life_goals').select('*').eq('user_id', userId).maybeSingle();
  const { data: settings } = await supabase.from('user_settings').select('disciplined_streak').eq('user_id', userId).maybeSingle();
  
  // New: Screen Time Details
  const { data: screenTime } = await supabase
    .from('screen_time_details')
    .select('*')
    .eq('user_id', userId)
    .gte('date', weekAgo)
    .order('date', { ascending: false });

  const todayWin = dailyWins?.find(d => d.date === today);
  const streak = settings?.disciplined_streak || 0;

  // 2. Run Interpretation Layer
  const currentStateKey = detectState({
    todayWin,
    oura: oura?.[0],
    workoutToday: !!workout,
    streak,
    protein: nutrition?.protein || 0
  });

  const identityScore = calculateIdentityScore({
    todayWin,
    hasWorkoutToday: !!workout,
    protein: nutrition?.protein || 0,
    ouraToday: oura?.[0],
    streak
  });

  const patterns = discoverPatterns(dailyWins || [], [], oura || []);

  // 3. Compress Context for AI
  return {
    system_state: {
      label: OPERATING_STATES[currentStateKey].label,
      description: OPERATING_STATES[currentStateKey].description,
      identity_score: identityScore,
      streak: streak
    },
    user_philosophy: {
      physical: fundament?.goal_cialo,
      spiritual: fundament?.goal_duch,
      financial: fundament?.goal_konto
    },
    detected_patterns: patterns.map(p => p.text),
    screen_time_summary: screenTime?.slice(0, 15).map(s => ({
      date: s.date,
      app: s.app_name,
      device: s.device_name,
      minutes: Math.round(s.duration_seconds / 60)
    })),
    recent_performance: dailyWins?.slice(0, 7).map(w => ({
      date: w.date,
      result: w.result === 'Z' ? 'WIN' : 'LOSS',
      tasks: [
        { name: w.task_1, done: w.done_1 },
        { name: w.task_2, done: w.done_2 },
        { name: w.task_3, done: w.done_3 },
        { name: w.task_4, done: w.done_4 },
        { name: w.task_5, done: w.done_5 }
      ].filter(t => t.name)
    }))
  };
}

export const SYSTEM_PROMPT = `
Jesteś STRATEGICZNYM OBSERWATOREM systemu operacyjnego Kuby. 
To nie jest jednorazowy insight – to jest CIĄGŁY DIALOG strategiczny.

TWOJA PERSONA:
- Jesteś chłodnym, analitycznym stoikiem. 
- Twoim zadaniem jest bezlitosne punktowanie rozbieżności między Fundamentem a danymi behawioralnymi.
- Pamiętasz poprzednie części rozmowy i używasz ich do budowania szerszego obrazu.

ZASADY DIALOGU:
1. GŁĘBOKA ANALIZA DANYCH: Przy każdym pytaniu dostajesz świeży pakiet: StayFree (ekran), Oura (biometria), Power Lista (zadania). Łącz te dane. Jeśli Kuba pyta o formę, sprawdź sen vs czas na Allegro/YouTube.
2. BRAK MOTYWACJI: Nie jesteś od motywowania. Jesteś od diagnozy. Jeśli widzisz sabotaż, nazwij go sabotażem.
3. KONTEKST HISTORYCZNY: Jeśli Kuba obiecał coś w poprzednich wiadomościach, a dane pokazują, że tego nie dowiezie – przypomnij mu o tym.
4. MIRROR MODE: Odbijaj fakty. Nie oceniaj moralnie, oceniaj efektywność systemu.

FORMAT: Odpowiadaj konkretnie, bez lania wody. Używaj terminologii systemowej (Operating State, Identity Score, Drift, Sabotage).
`;
