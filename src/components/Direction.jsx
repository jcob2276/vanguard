import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Compass, Target, Shield, Wallet, CheckSquare, Square, Save, Edit2, TrendingUp, Calendar, Zap, AlertCircle, Plus, Trash2, X, Smile, Meh, Frown, Laugh, Angry, Star, Mic, RotateCw, Trophy, Activity } from 'lucide-react';
import { format, subDays, startOfDay, parseISO, differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { pl } from 'date-fns/locale';
import { VanguardCore, computeSignals } from '../lib/vanguardCore';
import StayFreeSync from './StayFreeSync';
import ManifestationBoard from './ManifestationBoard';

const TrendArrow = ({ current, previous, better = 'up' }) => {
  if (previous === undefined || previous === null || current === undefined || current === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="ml-1 text-neutral-500">→</span>;
  const isImproving = better === 'up' ? diff > 0 : diff < 0;
  return <span className={`ml-1 font-black ${isImproving ? 'text-dayC' : 'text-dayB'}`}>{diff > 0 ? '↑' : '↓'}</span>;
};

export default function Direction({ session }) {
  const [loading, setLoading] = useState(true);
  const [lifeGoals, setLifeGoals] = useState({ goal_cialo: '', goal_duch: '', goal_konto: '' });
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [todayWin, setTodayWin] = useState(null);
  const [history, setHistory] = useState([]);
  const [newTaskForm, setNewTaskForm] = useState([
    { task: '', category: 'cialo' },
    { task: '', category: 'duch' },
    { task: '', category: 'konto' },
    { task: '', category: 'cialo' },
    { task: '', category: 'duch' },
  ]);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', icon: '💪', is_positive: true });
  const [tomorrowWin, setTomorrowWin] = useState(null);
  const [isPlanningTomorrow, setIsPlanningTomorrow] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ proud_of: '', sabotage: '', do_differently: '' });
  const isSunday = new Date().getDay() === 0;
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const [showStayFree, setShowStayFree] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }
  }, [session?.user?.id]);

  async function fetchData() {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(subDays(new Date(), -1), 'yyyy-MM-dd');

    try {
      const [
        { data: goals },
        { data: todayData },
        { data: tomorrowData },
        { data: historyData },
        { data: habitsData },
        { data: logsData },
        { data: reviewData }
      ] = await Promise.all([
        supabase.from('life_goals').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', session.user.id).eq('date', today).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', session.user.id).eq('date', tomorrow).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60),
        supabase.from('habits').select('*').eq('user_id', session.user.id),
        supabase.from('habit_logs').select('*').eq('user_id', session.user.id).gte('date', subDays(new Date(), 30).toISOString().split('T')[0]),
        isSunday ? supabase.from('weekly_reviews').select('*').eq('user_id', session.user.id).eq('week_start', currentWeekStart).maybeSingle() : Promise.resolve({ data: null })
      ]);
      
      if (goals) setLifeGoals(goals);
      setTodayWin(todayData);
      setTomorrowWin(tomorrowData);
      setHistory(historyData || []);
      setHabits(habitsData || []);
      setHabitLogs(logsData || []);
      if (reviewData) setCurrentReview(reviewData);

      // Auto-finalize logic - only for PAST days
      const pastUnfinished = historyData?.filter(d => d.date < today && d.result === null) || [];
      
      if (pastUnfinished.length > 0) {
        const ids = pastUnfinished.map(d => d.id);
        const { error: updateError } = await supabase
          .from('daily_wins')
          .update({ result: 'P' })
          .in('id', ids);

        if (!updateError) {
          // Refresh history with a single efficient query
          const { data: updatedHistory } = await supabase
            .from('daily_wins')
            .select('*')
            .eq('user_id', session.user.id)
            .order('date', { ascending: false })
            .limit(60);
          setHistory(updatedHistory || []);
        }
      }
    } catch (err) {
      console.error('Fetch Data Error:', err);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    if (!history.length) return { streak: 0, weeklyWin: false, monthlyWin: false, weeks: [] };

    // Streak
    let streak = 0;
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    if (sortedHistory[0]?.date === todayStr || sortedHistory[0]?.date === yesterdayStr) {
      for (const day of sortedHistory) {
        if (day.result === 'Z') streak++;
        else if (day.date !== todayStr) break;
      }
    }

    // Weekly/Monthly logic
    const START_DATE_OBJ = parseISO('2026-05-03');
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      const start = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const weekDays = history.filter(d => {
        const dDate = parseISO(d.date);
        return dDate >= start && dDate <= end;
      });
      
      const today = startOfDay(new Date());
      let expectedPastDays;
      
      if (isWithinInterval(today, { start, end })) {
        expectedPastDays = differenceInDays(today, start);
      } else {
        expectedPastDays = 7;
      }

      // Liczymy ile dni w historii tego tygodnia to porażki 'P' 
      // ORAZ ile dni w przeszłości tego tygodnia w ogóle nie ma wpisu
      const zCount = weekDays.filter(d => d.result === 'Z').length;
      const explicitPCount = weekDays.filter(d => d.result === 'P').length;
      
      // Sprawdzamy brakujące dni TYLKO dla dat < dzisiaj
      let missingDaysCount = 0;
      for (let d = 0; d < expectedPastDays; d++) {
        const checkDate = format(subDays(today, expectedPastDays - d), 'yyyy-MM-dd');
        const hasEntry = weekDays.some(wd => wd.date === checkDate);
        if (!hasEntry && checkDate >= '2026-05-03') {
          missingDaysCount++;
        }
      }

      const pCount = explicitPCount + missingDaysCount;
      weeks.push({ isWeekWin: pCount <= 2 && (expectedPastDays > 0 || weekDays.length > 0), pCount, zCount, start });
    }

    return { streak, weeklyWin: weeks[0]?.isWeekWin, weeklyP: weeks[0]?.pCount, monthlyWin: weeks.filter(w => w.isWeekWin).length >= 3, weeks };
  }, [history]);

  const { streak, weeklyWin, weeklyP, monthlyWin, weeks } = stats;

  const [currentState, setCurrentState] = useState('CALIBRATING');

  useEffect(() => {
    async function checkDrift() {
      if (loading || !session?.user?.id) return;
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const core = new VanguardCore(session.user.id, supabase);

      const [ouraRes, stayfreeRes, nutritionRes, lastWorkoutRes] = await Promise.all([
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('stayfree_usage').select('*').eq('user_id', session.user.id).eq('date', today),
        supabase.from('daily_nutrition').select('*').eq('user_id', session.user.id).eq('date', today).maybeSingle(),
        supabase.from('workout_sessions').select('date').eq('user_id', session.user.id).order('date', { ascending: false }).limit(1).maybeSingle()
      ]);

      const signals = computeSignals(
        stayfreeRes.data || [], 
        ouraRes.data, 
        todayWin,
        nutritionRes.data,
        lastWorkoutRes.data?.date
      );
      const baseline = await core.getPersonalBaseline();
      const { state } = await core.determineState(signals, baseline);
      
      setCurrentState(state);
    }
    checkDrift();
  }, [loading, todayWin, session?.user?.id]);

  const isDrifting = ['CHAOS', 'AVOIDANCE'].includes(currentState);

  async function saveLifeGoals() {
    // Remove ID if present to avoid conflict, rely on user_id for upsert
    const { id, created_at, ...goalsToSave } = lifeGoals;
    const { error } = await supabase
      .from('life_goals')
      .upsert({ user_id: session.user.id, ...goalsToSave }, { onConflict: 'user_id' });
    
    if (!error) {
      setIsEditingGoals(false);
      fetchData();
    } else {
      console.error(error);
      alert('Błąd zapisu celów: ' + error.message);
    }
  }

  async function startNewDay() {
    if (newTaskForm.some(t => !t.task.trim())) {
      alert('Wypełnij wszystkie 5 zadań!');
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const entry = {
      user_id: session.user.id,
      date: today,
      task_1: newTaskForm[0].task, category_1: newTaskForm[0].category,
      task_2: newTaskForm[1].task, category_2: newTaskForm[1].category,
      task_3: newTaskForm[2].task, category_3: newTaskForm[2].category,
      task_4: newTaskForm[3].task, category_4: newTaskForm[3].category,
      task_5: newTaskForm[4].task, category_5: newTaskForm[4].category,
      result: null // Initial state
    };

    const { data, error } = await supabase.from('daily_wins').insert(entry).select().single();
    if (!error) {
      setTodayWin(data);
      setNewTaskForm([
        { task: '', category: 'cialo' },
        { task: '', category: 'duch' },
        { task: '', category: 'konto' },
        { task: '', category: 'cialo' },
        { task: '', category: 'duch' },
      ]);
    }
    else alert('Błąd startu dnia');
  }

  async function planTomorrow() {
    if (newTaskForm.some(t => !t.task.trim())) {
      alert('Wypełnij wszystkie 5 zadań na jutro!');
      return;
    }

    const tomorrow = format(subDays(new Date(), -1), 'yyyy-MM-dd');
    const entry = {
      user_id: session.user.id,
      date: tomorrow,
      task_1: newTaskForm[0].task, category_1: newTaskForm[0].category,
      task_2: newTaskForm[1].task, category_2: newTaskForm[1].category,
      task_3: newTaskForm[2].task, category_3: newTaskForm[2].category,
      task_4: newTaskForm[3].task, category_4: newTaskForm[3].category,
      task_5: newTaskForm[4].task, category_5: newTaskForm[4].category,
      result: null
    };

    const { data, error } = await supabase.from('daily_wins').insert(entry).select().single();
    if (!error) {
      setTomorrowWin(data);
      setIsPlanningTomorrow(false);
      setNewTaskForm([
        { task: '', category: 'cialo' },
        { task: '', category: 'duch' },
        { task: '', category: 'konto' },
        { task: '', category: 'cialo' },
        { task: '', category: 'duch' },
      ]);
    }
    else alert('Błąd planowania jutra');
  }

  async function toggleTask(index) {
    if (!todayWin) return;
    const field = `done_${index + 1}`;
    const newValue = !todayWin[field];
    
    // Check if all 5 will be done
    const allDone = [1, 2, 3, 4, 5].every(i => {
      if (i === index + 1) return newValue;
      return todayWin[`done_${i}`];
    });

    const updates = { [field]: newValue };
    if (allDone) {
      updates.result = 'Z';
    } else {
      // If we are past 23:00, any change that isn't 5/5 keeps/sets the status to 'P'
      const isPastDeadline = new Date().getHours() >= 23;
      updates.result = isPastDeadline ? 'P' : null;
    }

    const { data, error } = await supabase
      .from('daily_wins')
      .update(updates)
      .eq('id', todayWin.id)
      .select()
      .single();
    
    if (!error) setTodayWin(data);
  }

  async function addHabit() {
    if (!newHabit.name) return;
    const { data, error } = await supabase.from('habits').insert({ user_id: session.user.id, ...newHabit }).select().single();
    if (!error) {
      setHabits([...habits, data]);
      setNewHabit({ name: '', icon: '💪', is_positive: true });
      setIsAddingHabit(false);
    }
  }

  async function deleteHabit(id) {
    if (!confirm('Usunąć nawyk?')) return;
    await supabase.from('habits').delete().eq('id', id);
    setHabits(habits.filter(h => h.id !== id));
  }

  async function toggleHabit(habitId) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = habitLogs.find(l => l.habit_id === habitId && l.date === today);

    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
      if (!error) setHabitLogs(habitLogs.filter(l => l.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('habit_logs').insert({ user_id: session.user.id, habit_id: habitId, date: today, completed: true }).select().single();
      if (!error) setHabitLogs([...habitLogs, data]);
    }
  }

  const saveWeeklyReview = async () => {
    if (currentReview) return;
    
    const { data, error } = await supabase
      .from('weekly_reviews')
      .upsert({
        user_id: session.user.id,
        week_start: currentWeekStart,
        ...reviewForm
      }, { onConflict: 'user_id,week_start' })
      .select()
      .maybeSingle();
    
    if (!error) {
      setCurrentReview(data);
      alert('Tydzień zamknięty pomyślnie!');
    } else {
      console.error('Weekly Review Save Error Details:', error);
      alert(`Błąd zapisu przeglądu: ${error.message || 'Nieznany błąd'}\n\nSzczegóły: ${JSON.stringify(error)}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-neutral-500 uppercase font-black animate-pulse tracking-widest">Wczytywanie Kierunku...</div>;

  return (
    <div className="flex-1 p-6 space-y-10 pb-24 overflow-y-auto">
      {/* Header: Life Goals */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Compass size={12} /> Twoje Cele (Context)
          </h2>
          <button onClick={() => isEditingGoals ? saveLifeGoals() : setIsEditingGoals(true)} className="text-neutral-500 hover:text-white p-2">
            {isEditingGoals ? <Save size={16} /> : <Edit2 size={16} />}
          </button>
        </div>

        <div className="grid gap-4">
          {[
            { key: 'goal_cialo', dateKey: 'date_cialo', label: 'Ciało', icon: <Shield size={14} className="text-dayC" /> },
            { key: 'goal_duch', dateKey: 'date_duch', label: 'Duch', icon: <Zap size={14} className="text-dayA" /> },
            { key: 'goal_konto', dateKey: 'date_konto', label: 'Konto', icon: <Wallet size={14} className="text-dayD" /> },
          ].map((g) => {
            const daysLeft = lifeGoals[g.dateKey] ? differenceInDays(parseISO(lifeGoals[g.dateKey]), new Date()) : null;
            
            return (
              <div key={g.key} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-neutral-950 flex items-center justify-center border border-neutral-800">
                      {g.icon}
                    </div>
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{g.label}</p>
                  </div>
                  {daysLeft !== null && (
                    <div className="bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
                      <p className="text-[8px] font-black text-primary uppercase">Zostało {daysLeft} dni</p>
                    </div>
                  )}
                </div>

                <div className="min-h-[40px]">
                  {isEditingGoals ? (
                    <div className="space-y-2">
                      <textarea 
                        value={lifeGoals[g.key]} 
                        onChange={(e) => setLifeGoals({...lifeGoals, [g.key]: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-[12px] font-bold text-white outline-none focus:border-primary resize-none"
                        rows={2}
                      />
                      <input 
                        type="date"
                        value={lifeGoals[g.dateKey] || ''}
                        onChange={(e) => setLifeGoals({...lifeGoals, [g.dateKey]: e.target.value})}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-[10px] font-bold text-white outline-none"
                      />
                    </div>
                  ) : (
                    <p className="text-[14px] font-black text-white uppercase italic leading-tight break-words">
                      {lifeGoals[g.key] || 'Brak zdefiniowanego celu'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Weekly Review Section (Sunday Only) */}
      {isSunday && !currentReview && (
        <section className="space-y-6 animate-in slide-in-from-top-4 duration-500">
          <header className="flex justify-between items-center">
            <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
              <Calendar size={12} /> Przegląd Tygodnia
            </h2>
            {currentReview && <span className="text-[8px] font-black text-dayC uppercase">Tydzień Zamknięty</span>}
          </header>

          <div className="bg-neutral-900 border border-primary/20 rounded-2xl p-6 space-y-6 shadow-xl shadow-primary/5">
            {[
              { key: 'proud_of', label: 'Co zrobiłem w tym tygodniu z czego jestem dumny?', icon: <Trophy size={14} className="text-dayD" /> },
              { key: 'sabotage', label: 'Co sabotowało mój postęp — i dlaczego na to pozwoliłem?', icon: <AlertCircle size={14} className="text-dayB" /> },
              { key: 'do_differently', label: 'Gdybym mógł powtórzyć ten tydzień — co zrobiłbym inaczej?', icon: <RotateCw size={14} className="text-dayA" /> },
            ].map((q) => (
              <div key={q.key} className="space-y-3">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center justify-between">
                  <span className="flex items-center gap-2">{q.icon} {q.label}</span>
                  {!currentReview && <Mic size={10} className="text-neutral-700 hover:text-primary cursor-pointer" />}
                </label>
                {currentReview ? (
                  <div className="bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 text-[12px] font-bold text-neutral-400 italic leading-relaxed">
                    {currentReview[q.key]}
                  </div>
                ) : (
                  <textarea 
                    value={reviewForm[q.key]}
                    onChange={(e) => setReviewForm({...reviewForm, [q.key]: e.target.value})}
                    placeholder="Wpisz swoje przemyślenia..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-[12px] font-bold text-white outline-none focus:border-primary resize-none min-h-[80px] transition-all"
                  />
                )}
              </div>
            ))}

            {!currentReview && (
              <button 
                onClick={saveWeeklyReview}
                className="w-full bg-primary text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20"
              >
                Zamknij Tydzień
              </button>
            )}
          </div>
        </section>
      )}

      {/* Identity Drift Alert */}
      {isDrifting && (
        <div className="bg-dayB/20 border-2 border-dayB rounded-2xl p-6 animate-pulse mb-8">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="text-dayB" size={24} />
            <h3 className="text-lg font-black text-dayB uppercase italic tracking-tighter">Identity Alert: Drift Detected</h3>
          </div>
          <p className="text-[11px] font-bold text-white uppercase leading-tight italic">
            Twoje obecne działania (Stan: {currentState}) przestają być zgodne z Twoim Fundamentem. 
            Mówisz o dyscyplinie, ale system wykrywa regres. Wróć do bazy.
          </p>
        </div>
      )}

      {/* Habits Section */}
      <section className="space-y-6">
        <header className="flex justify-between items-center">
          <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Target size={12} /> Twoje Nawyki
          </h2>
          <button onClick={() => setIsAddingHabit(true)} className="flex items-center gap-1 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 text-[10px] font-black uppercase text-primary hover:bg-primary hover:text-white transition-all">
            <Plus size={12} /> Dodaj
          </button>
        </header>

        {isAddingHabit && (
          <div className="bg-neutral-900 border-2 border-primary rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase text-white">Nowy Nawyk</span>
              <button onClick={() => setIsAddingHabit(false)} className="text-neutral-500"><X size={16} /></button>
            </div>
            <div className="grid gap-4">
              <div className="flex gap-3">
                <input 
                  value={newHabit.icon} 
                  onChange={e => setNewHabit({...newHabit, icon: e.target.value})}
                  className="w-12 h-12 bg-neutral-950 border border-neutral-800 rounded-xl text-center text-xl"
                  placeholder="🔥"
                />
                <input 
                  placeholder="Nazwa nawyku..."
                  value={newHabit.name}
                  onChange={e => setNewHabit({...newHabit, name: e.target.value})}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-[12px] font-bold text-white outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setNewHabit({...newHabit, is_positive: true})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newHabit.is_positive ? 'bg-dayC/10 border-dayC text-dayC' : 'bg-neutral-950 border-neutral-800 text-neutral-600'}`}
                >
                  Zrób (Dobre)
                </button>
                <button 
                  onClick={() => setNewHabit({...newHabit, is_positive: false})}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${!newHabit.is_positive ? 'bg-dayB/10 border-dayB text-dayB' : 'bg-neutral-950 border-neutral-800 text-neutral-600'}`}
                >
                  Unikaj (Złe)
                </button>
              </div>
              <button onClick={addHabit} className="w-full bg-primary text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20">Dodaj do listy</button>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {habits.map(h => {
            const isDoneToday = habitLogs.some(l => l.habit_id === h.id && l.date === format(new Date(), 'yyyy-MM-dd'));
            const logsLast30 = Array.from({ length: 30 }).map((_, i) => {
              const date = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
              const log = habitLogs.find(l => l.habit_id === h.id && l.date === date);
              if (h.is_positive) return log ? 'S' : (date === format(new Date(), 'yyyy-MM-dd') ? 'N' : 'F');
              return log ? 'F' : 'S';
            });

            return (
              <div key={h.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{h.icon}</div>
                    <div>
                      <p className="text-[12px] font-black uppercase text-white leading-none">{h.name}</p>
                      <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-1">{h.is_positive ? 'Cel: Wykonać' : 'Cel: Unikać'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleHabit(h.id)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${isDoneToday ? (h.is_positive ? 'bg-dayC border-dayC text-white' : 'bg-dayB border-dayB text-white') : 'bg-neutral-950 border-neutral-800 text-neutral-700'}`}
                    >
                      {isDoneToday ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                    <button onClick={() => deleteHabit(h.id)} className="p-2 text-neutral-800 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Heatmap Bar */}
                <div className="flex gap-1 overflow-hidden h-3">
                  {logsLast30.map((status, idx) => (
                    <div 
                      key={idx} 
                      className={`flex-1 rounded-sm ${status === 'S' ? 'bg-dayC' : status === 'F' ? 'bg-dayB' : 'bg-neutral-950 border border-neutral-800'}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Power List Stats (New Section) */}
      <section className="space-y-6">
        <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={12} /> Status Power List
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className={`bg-neutral-900 border ${weeklyP > 2 ? 'border-dayB/30' : 'border-dayC/30'} rounded-2xl p-5 space-y-3`}>
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Tydzień</p>
            <div className="flex justify-between items-end">
              <h3 className={`text-xl font-black uppercase italic ${weeklyP > 2 ? 'text-dayB' : 'text-dayC'}`}>
                {weeklyP > 2 ? 'PRZEGRANY' : (isSunday ? 'WYGRANY' : 'W TRAKCIE')}
              </h3>
              <p className="text-[10px] font-black text-white">{weeklyP} / 2 P</p>
            </div>
            <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${weeklyP > 2 ? 'bg-dayB' : 'bg-dayC'}`}
                style={{ width: `${Math.max(10, 100 - (weeklyP * 33))}%` }}
              />
            </div>
          </div>

          <div className={`bg-neutral-900 border ${monthlyWin ? 'border-dayC/30' : 'border-dayB/30'} rounded-2xl p-5 space-y-3`}>
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Miesiąc</p>
            <div className="flex justify-between items-end">
              <h3 className={`text-xl font-black uppercase italic ${monthlyWin ? 'text-dayC' : 'text-dayB'}`}>
                {monthlyWin ? 'WYGRANY' : 'W TRAKCIE'}
              </h3>
              <p className="text-[10px] font-black text-white">{weeks.filter(w => w.isWeekWin).length} / 3 W</p>
            </div>
            <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-dayA transition-all"
                style={{ width: `${(weeks.filter(w => w.isWeekWin).length / 3) * 100}%` }}
              />
            </div>
          </div>

        </div>
      </section>

      {/* Visualization & Stats */}
      <section className="space-y-6 pt-4 border-t border-neutral-900">
        <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
          <Calendar size={12} /> Postęp (30 Dni)
        </h2>

        {/* Grid 30-dniowy */}
        {/* Grid 28-dniowy (Wyrównany do Poniedziałków) */}
        <div className="grid grid-cols-7 gap-2 w-fit mx-auto">
          {Array.from({ length: 28 }).map((_, i) => {
            // Grid zaczyna się 3 tygodnie temu w poniedziałek
            const gridStart = startOfWeek(subDays(new Date(), 21), { weekStartsOn: 1 });
            const dateObj = subDays(gridStart, -i);
            const date = format(dateObj, 'yyyy-MM-dd');
            const today = format(new Date(), 'yyyy-MM-dd');
            const dayData = history.find(d => d.date === date);
            const isFuture = dateObj > new Date();
            
            const START_DATE = '2026-05-03';
            let color = 'bg-neutral-900';
            if (isFuture) color = 'bg-transparent border border-white/5';
            else if (dayData?.result === 'Z') color = 'bg-dayC';
            else if (dayData?.result === 'P') color = 'bg-dayB';
            else if (date < today && !dayData && date >= START_DATE) color = 'bg-dayB'; 

            const isActive = !isFuture && (dayData?.result != null || (date < today && !dayData && date >= START_DATE));

            return (
              <div 
                key={i} 
                className={`w-8 h-8 rounded-md ${color} ${!isActive && !isFuture && 'border border-neutral-900'} relative group transition-colors duration-500 flex items-center justify-center`}
              >
                {!isFuture && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-950 px-2 py-1 rounded text-[8px] font-black text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 border border-neutral-800">
                    {format(parseISO(date), 'dd.MM')} {dayData?.result === 'Z' ? '(WIN)' : (dayData?.result === 'P' || (date < today && !dayData)) ? '(LOSS)' : '(EMPTY)'}
                  </div>
                )}
                {date === today && <div className="w-1 h-1 bg-white rounded-full absolute bottom-1" />}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="card bg-neutral-900/30 p-5 text-center">
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1">Aktualny Streak</p>
            <div className="flex items-center justify-center gap-2">
              <Zap size={16} className="text-dayA" />
              <span className="text-2xl font-black italic text-white">{streak}</span>
            </div>
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mt-1">Zwycięstw</p>
          </div>

          <div className="card bg-neutral-900/30 p-5 text-center">
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1">Tydzień Wygrany?</p>
            <div className={`text-xl font-black italic uppercase ${weeklyP > 2 ? 'text-dayB' : (isSunday ? 'text-dayC' : 'text-blue-400')}`}>
              {weeklyP > 2 ? 'NIE' : (isSunday ? 'TAK' : 'W TRAKCIE')}
            </div>
            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mt-1">{weeklyP} Porażek</p>
          </div>
        </div>
      </section>
    </div>
  );
}
