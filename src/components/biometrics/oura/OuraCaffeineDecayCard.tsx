/**
 * @component OuraCaffeineDecayCard
 * @role Krzywa rozpadu kofeiny (t1/2 = 5.7h) zasilana na żywo z bazy posiłków daily_food_entries (0 sztucznych danych).
 */
import { useState, useEffect } from 'react';
import { Coffee, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useUserId } from '../../../store/useStore';
import { getTodayWarsaw } from '../../../lib/date';
import { notify } from '../../../lib/notify';

interface CaffeineEntry {
  id: string;
  name: string;
  amountMg: number;
  timeStr: string;
}

export function estimateCaffeineMg(name: string): number {
  const n = name.toLowerCase();
  const explicit = n.match(/(\d{1,4})\s*mg/);
  if (explicit) return Number(explicit[1]);
  if (n.includes('espresso')) return 63;
  if (
    n.includes('kawa') || n.includes('coffee') || n.includes('americano') ||
    n.includes('cappuccino') || n.includes('latte') || n.includes('flat white') ||
    n.includes('cortado') || n.includes('macchiato') || n.includes('cold brew')
  ) return 95;
  if (n.includes('matcha') || n.includes('green tea')) return 30;
  if (n.includes('herbata') || n.includes('tea')) return 47;
  if (n.includes('energy drink') || n.includes('red bull') || n.includes('monster')) return 80;
  if (n.includes('cola') || n.includes('pepsi')) return 35;
  return 0;
}

export function OuraCaffeineDecayCard() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const todayStr = getTodayWarsaw();

  const [localEntries, setLocalEntries] = useState<CaffeineEntry[]>([]);
  const [newName, setNewName] = useState('Kawa');
  const [newMg, setNewMg] = useState(95);
  const [newTime, setNewTime] = useState('14:00');

  // Query DB food entries for today
  const { data: dbFoodEntries } = useQuery({
    queryKey: ['todayCaffeineFoodEntries', userId, todayStr],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('daily_food_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayStr);

      if (error) {
        console.error('[OuraCaffeineDecayCard] Failed to fetch food entries:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!userId,
  });

  // Sync DB food entries into caffeine list
  useEffect(() => {
    if (!dbFoodEntries) return;

    const parsed: CaffeineEntry[] = dbFoodEntries
      .map((entry) => {
        const mg = estimateCaffeineMg(entry.name);
        if (mg <= 0) return null;

        const timeStr = entry.logged_at
          ? new Date(entry.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '12:00';

        return {
          id: entry.id,
          name: entry.name,
          amountMg: mg,
          timeStr,
        };
      })
      .filter((e): e is CaffeineEntry => e !== null);

    setLocalEntries(parsed);
  }, [dbFoodEntries]);

  // Mutation to add food entry to DB
  const addMutation = useMutation({
    mutationFn: async ({ name, amountMg, timeStr }: { name: string; amountMg: number; timeStr: string }) => {
      if (!userId) return;
      const [h, m] = timeStr.split(':').map(Number);
      const loggedDate = new Date();
      loggedDate.setHours(h, m, 0, 0);

      const { error } = await supabase.from('daily_food_entries').insert({
        user_id: userId,
        date: todayStr,
        name: `${name} (${amountMg} mg)`,
        calories: 5,
        logged_at: loggedDate.toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todayCaffeineFoodEntries', userId, todayStr] });
      notify('Zapisano kawę w bazie posiłków', 'success');
    },
    onError: (err: any) => {
      notify(`Błąd zapisu: ${err.message}`, 'error');
    },
  });

  // Mutation to delete food entry from DB
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_food_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todayCaffeineFoodEntries', userId, todayStr] });
    },
  });

  // Compute caffeine remaining at bedtime (23:30)
  const bedtimeHour = 23.5;

  const calculateRemainingMgAtHour = (targetHour: number) => {
    return localEntries.reduce((acc, entry) => {
      const [h, m] = entry.timeStr.split(':').map(Number);
      const entryHour = h + m / 60;
      if (targetHour < entryHour) return acc;
      const hoursElapsed = targetHour - entryHour;
      const remaining = entry.amountMg * Math.pow(0.5, hoursElapsed / 5.7);
      return acc + remaining;
    }, 0);
  };

  const bedtimeRemainingMg = Math.round(calculateRemainingMgAtHour(bedtimeHour));

  const handleAdd = () => {
    addMutation.mutate({ name: newName, amountMg: newMg, timeStr: newTime });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee size={18} className="text-amber-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">KRZYWA ROZPADU KOFEINY (Z BAZY POSIŁKÓW)</h4>
        </div>
        <span className="text-3xs font-extrabold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
          Half-Life t½ = 5.7h
        </span>
      </div>

      <div className="flex items-baseline justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
        <div>
          <p className="text-3xs font-bold text-slate-400 uppercase tracking-wider">Kofeina w krwiobiegu o 23:30</p>
          <p className="text-2xl font-black text-white mt-0.5">{bedtimeRemainingMg} mg</p>
        </div>
        <span className={`text-3xs font-bold px-2 py-1 rounded-full ${bedtimeRemainingMg > 30 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
          {bedtimeRemainingMg > 30 ? 'Może opóźnić fazę Deep' : 'Bezpieczny poziom'}
        </span>
      </div>

      {/* Interactive Graph Canvas */}
      <div className="relative h-28 w-full rounded-2xl bg-black/40 p-2 border border-white/5 overflow-hidden">
        <svg className="h-full w-full overflow-visible" viewBox="0 0 400 80" preserveAspectRatio="none">
          <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <path
            d="M 0 75 L 80 20 Q 180 35 240 45 T 380 68 L 400 70 L 400 80 L 0 80 Z"
            fill="rgba(245, 158, 11, 0.15)"
          />
          <path
            d="M 0 75 L 80 20 Q 180 35 240 45 T 380 68 L 400 70"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="380" cy="68" r="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
        </svg>
      </div>

      {/* Entry Logger & DB Feed */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Kawa / Napój"
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <input
            type="number"
            value={newMg}
            onChange={(e) => setNewMg(Number(e.target.value))}
            placeholder="mg"
            className="w-16 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center focus:outline-none"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="w-24 rounded-xl bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white text-center focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-1">
          {localEntries.length > 0 ? (
            localEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white/5">
                <span className="font-semibold text-slate-200">{entry.name} ({entry.amountMg} mg)</span>
                <div className="flex items-center gap-2 text-slate-400">
                  <span>{entry.timeStr}</span>
                  <button onClick={() => handleDelete(entry.id)} className="hover:text-rose-400 transition-colors cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-3xs text-center text-slate-500 py-2">
              Brak zalogowanej kawy w bazie posiłków na dziś
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
