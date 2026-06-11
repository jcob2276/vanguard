import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckSquare,
  Plus,
  RotateCw,
  Square,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { differenceInDays, endOfWeek, format, isWithinInterval, parseISO, startOfDay, startOfWeek, subDays } from 'date-fns';
import { supabase } from '../../lib/supabase';

const todayDate = () => format(new Date(), 'yyyy-MM-dd');

function SectionTitle({ icon: Icon, title, detail, action }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
          <Icon size={12} /> {title}
        </p>
        {detail && <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/38">{detail}</p>}
      </div>
      {action}
    </header>
  );
}

function MiniStat({ label, value, tone = 'text-white', detail }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-neutral-950/70 p-4">
      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">{label}</p>
      <p className={`mt-2 text-[20px] font-black uppercase leading-none tracking-tight ${tone}`}>{value}</p>
      {detail && <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-white/25">{detail}</p>}
    </div>
  );
}

function HabitStrip({ habit, logs }) {
  return (
    <div className="flex h-3 gap-1 overflow-hidden">
      {Array.from({ length: 30 }).map((_, index) => {
        const date = format(subDays(new Date(), 29 - index), 'yyyy-MM-dd');
        const hasLog = logs.some((log) => log.habit_id === habit.id && log.date === date);
        const status = habit.is_positive ? (hasLog ? 'good' : date === todayDate() ? 'open' : 'miss') : hasLog ? 'miss' : 'good';
        return (
          <div
            key={date}
            title={date}
            className={`flex-1 rounded-sm ${
              status === 'good'
                ? 'bg-dayC'
                : status === 'miss'
                ? 'bg-dayB'
                : 'border border-white/[0.08] bg-neutral-950'
            }`}
          />
        );
      })}
    </div>
  );
}

export default function Direction({ session }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', icon: 'X', is_positive: true });
  const [currentReview, setCurrentReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ proud_of: '', sabotage: '', do_differently: '' });

  const isSunday = new Date().getDay() === 0;
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = todayDate();

    try {
      const [
        { data: _todayData },
        { data: historyData },
        { data: habitsData },
        { data: logsData },
        { data: reviewData },
      ] = await Promise.all([
        supabase.from('daily_wins').select('*').eq('user_id', session.user.id).eq('date', today).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60),
        supabase.from('habits').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', session.user.id).gte('date', subDays(new Date(), 45).toISOString().split('T')[0]),
        isSunday
          ? supabase.from('weekly_reviews').select('*').eq('user_id', session.user.id).eq('week_start', currentWeekStart).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setHistory(historyData || []);
      setHabits(habitsData || []);
      setHabitLogs(logsData || []);
      if (reviewData) setCurrentReview(reviewData);

      const pastUnfinished = historyData?.filter((day) => day.date < today && day.result === null) || [];
      if (pastUnfinished.length > 0) {
        const ids = pastUnfinished.map((day) => day.id);
        const { error } = await supabase.from('daily_wins').update({ result: 'P' }).in('id', ids);
        if (!error) {
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
      console.error('Fetch Direction Error:', err);
    } finally {
      setLoading(false);
    }
  }, [session, isSunday, currentWeekStart]);

  useEffect(() => {
    setTimeout(() => {
      if (session?.user?.id) fetchData();
    }, 0);
  }, [session?.user?.id, fetchData]);

  const stats = useMemo(() => {
    if (!history.length) return { streak: 0, weeklyP: 0, monthlyWin: false, weeks: [] };

    let streak = 0;
    const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const today = todayDate();
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    if (sorted[0]?.date === today || sorted[0]?.date === yesterday) {
      for (const day of sorted) {
        if (day.result === 'Z') streak++;
        else if (day.date !== today) break;
      }
    }

    const weeks = [];
    for (let i = 0; i < 4; i++) {
      const start = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      const end = endOfWeek(start, { weekStartsOn: 1 });
      const weekDays = history.filter((day) => {
        const date = parseISO(day.date);
        return date >= start && date <= end;
      });

      const now = startOfDay(new Date());
      const expectedPastDays = isWithinInterval(now, { start, end }) ? differenceInDays(now, start) : 7;
      const explicitP = weekDays.filter((day) => day.result === 'P').length;
      let missing = 0;

      for (let day = 0; day < expectedPastDays; day++) {
        const checkDate = format(subDays(now, expectedPastDays - day), 'yyyy-MM-dd');
        const hasEntry = weekDays.some((entry) => entry.date === checkDate);
        if (!hasEntry && checkDate >= '2026-05-03') missing++;
      }

      const pCount = explicitP + missing;
      weeks.push({ isWeekWin: pCount <= 2 && (expectedPastDays > 0 || weekDays.length > 0), pCount, start });
    }

    return {
      streak,
      weeklyP: weeks[0]?.pCount || 0,
      monthlyWin: weeks.filter((week) => week.isWeekWin).length >= 3,
      weeks,
    };
  }, [history]);

  async function addHabit() {
    if (!newHabit.name.trim()) return;
    const { data, error } = await supabase
      .from('habits')
      .insert({ user_id: session.user.id, ...newHabit, name: newHabit.name.trim() })
      .select()
      .single();

    if (!error) {
      setHabits([...habits, data]);
      setNewHabit({ name: '', icon: 'X', is_positive: true });
      setIsAddingHabit(false);
    }
  }

  async function deleteHabit(id) {
    if (!confirm('Usunac nawyk?')) return;
    await supabase.from('habits').delete().eq('id', id);
    setHabits(habits.filter((habit) => habit.id !== id));
  }

  async function toggleHabit(habitId) {
    const today = todayDate();
    const existing = habitLogs.find((log) => log.habit_id === habitId && log.date === today);

    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
      if (!error) setHabitLogs(habitLogs.filter((log) => log.id !== existing.id));
    } else {
      const { data, error } = await supabase
        .from('habit_logs')
        .insert({ user_id: session.user.id, habit_id: habitId, date: today, completed: true })
        .select()
        .single();
      if (!error) setHabitLogs([...habitLogs, data]);
    }
  }

  async function saveWeeklyReview() {
    if (currentReview) return;
    const { data, error } = await supabase
      .from('weekly_reviews')
      .upsert({ user_id: session.user.id, week_start: currentWeekStart, ...reviewForm }, { onConflict: 'user_id,week_start' })
      .select()
      .maybeSingle();

    if (!error) setCurrentReview(data);
  }

  if (loading) {
    return <div className="p-8 text-center text-neutral-500 uppercase font-black animate-pulse tracking-widest">Wczytywanie Kierunku...</div>;
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-5 pb-24">
      <section className="space-y-3">
        <SectionTitle
          icon={Target}
          title="Nawyki"
          detail="Nie jako checklista dla samej checklisty. To sa sygnaly, ktore maja pokazac powtarzalnosc."
          action={(
            <button
              onClick={() => setIsAddingHabit(true)}
              className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary"
            >
              <Plus size={12} /> Dodaj
            </button>
          )}
        />

        {isAddingHabit && (
          <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-white">Nowy sygnal</p>
              <button onClick={() => setIsAddingHabit(false)} className="text-white/35 hover:text-white">
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-[56px_1fr] gap-2">
              <input
                value={newHabit.icon}
                onChange={(e) => setNewHabit({ ...newHabit, icon: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/45 p-3 text-center text-[14px] font-black text-white outline-none"
                placeholder="X"
              />
              <input
                value={newHabit.name}
                onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                className="rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-bold text-white outline-none placeholder:text-white/18"
                placeholder="Nazwa"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setNewHabit({ ...newHabit, is_positive: true })}
                className={`rounded-lg border py-3 text-[9px] font-black uppercase tracking-widest ${newHabit.is_positive ? 'border-dayC/35 bg-dayC/10 text-dayC' : 'border-white/[0.08] bg-black/25 text-white/35'}`}
              >
                Wzmacniac
              </button>
              <button
                onClick={() => setNewHabit({ ...newHabit, is_positive: false })}
                className={`rounded-lg border py-3 text-[9px] font-black uppercase tracking-widest ${!newHabit.is_positive ? 'border-dayB/35 bg-dayB/10 text-dayB' : 'border-white/[0.08] bg-black/25 text-white/35'}`}
              >
                Unikac
              </button>
            </div>
            <button onClick={addHabit} className="w-full rounded-lg bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-white">
              Dodaj
            </button>
          </div>
        )}

        <div className="grid gap-3">
          {habits.map((habit) => {
            const doneToday = habitLogs.some((log) => log.habit_id === habit.id && log.date === todayDate());
            return (
              <article key={habit.id} className="rounded-lg border border-white/[0.07] bg-neutral-950/70 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-[15px] font-black text-white/80">
                      {habit.icon || 'X'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-black uppercase text-white">{habit.name}</p>
                      <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/30">
                        {habit.is_positive ? 'wzmacniac' : 'unikac'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleHabit(habit.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                        doneToday
                          ? habit.is_positive
                            ? 'border-dayC bg-dayC text-white'
                            : 'border-dayB bg-dayB text-white'
                          : 'border-white/[0.08] bg-black/35 text-white/35'
                      }`}
                    >
                      {doneToday ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <button onClick={() => deleteHabit(habit.id)} className="p-2 text-white/16 transition-colors hover:text-dayB">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <HabitStrip habit={habit} logs={habitLogs} />
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={TrendingUp} title="Status Power List" detail="Czy dzienne wykonanie realnie niesie kierunek." />
        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            label="Tydzien"
            value={stats.weeklyP > 2 ? 'Przegrany' : isSunday ? 'Wygrany' : 'W trakcie'}
            tone={stats.weeklyP > 2 ? 'text-dayB' : 'text-dayC'}
            detail={`${stats.weeklyP}/2 P`}
          />
          <MiniStat
            label="Miesiac"
            value={stats.monthlyWin ? 'Wygrany' : 'W trakcie'}
            tone={stats.monthlyWin ? 'text-dayC' : 'text-orange-300'}
            detail={`${stats.weeks.filter((week) => week.isWeekWin).length}/3 W`}
          />
        </div>

        <div className="rounded-lg border border-white/[0.07] bg-neutral-950/55 p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, index) => {
              const gridStart = startOfWeek(subDays(new Date(), 21), { weekStartsOn: 1 });
              const dateObj = subDays(gridStart, -index);
              const date = format(dateObj, 'yyyy-MM-dd');
              const dayData = history.find((day) => day.date === date);
              const isFuture = dateObj > new Date();
              const isMissingLoss = date < todayDate() && !dayData && date >= '2026-05-03';
              const color = isFuture
                ? 'border border-white/[0.05] bg-transparent'
                : dayData?.result === 'Z'
                ? 'bg-dayC'
                : dayData?.result === 'P' || isMissingLoss
                ? 'bg-dayB'
                : 'border border-white/[0.06] bg-neutral-900';

              return (
                <div key={date} title={date} className={`flex aspect-square items-end justify-center rounded-md ${color}`}>
                  {date === todayDate() && <span className="mb-1 h-1 w-1 rounded-full bg-white" />}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Streak" value={stats.streak} tone="text-primary" detail="zwyciestw" />
            <MiniStat label="Ten tydzien" value={stats.weeklyP > 2 ? 'Nie' : 'OK'} tone={stats.weeklyP > 2 ? 'text-dayB' : 'text-dayC'} detail={`${stats.weeklyP} porazek`} />
          </div>
        </div>
      </section>

      {isSunday && !currentReview && (
        <section className="space-y-3">
          <SectionTitle icon={Calendar} title="Przeglad tygodnia" detail="Krotkie zamkniecie, bez rozbudowanego rytualu." />
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            {[
              { key: 'proud_of', label: 'Co wzmocnilo kierunek?', icon: Trophy },
              { key: 'sabotage', label: 'Co bylo glownym odchyleniem?', icon: AlertCircle },
              { key: 'do_differently', label: 'Co zmienic w nastepnym tygodniu?', icon: RotateCw },
            ].map((item) => (
              <label key={item.key} className="block space-y-2">
                <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/35">
                  <item.icon size={11} /> {item.label}
                </span>
                <textarea
                  value={reviewForm[item.key]}
                  onChange={(e) => setReviewForm({ ...reviewForm, [item.key]: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-bold text-white outline-none"
                />
              </label>
            ))}
            <button onClick={saveWeeklyReview} className="w-full rounded-lg bg-primary py-3 text-[10px] font-black uppercase tracking-widest text-white">
              Zamknij tydzien
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
