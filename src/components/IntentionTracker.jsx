import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Target, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function IntentionTracker({ todayWin, stability }) {
  const [currentIntent, setCurrentIntent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntents();
    const interval = setInterval(fetchIntents, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchIntents() {
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .lte('start_time', now)
        .gte('end_time', now)
        .maybeSingle();

      if (data) {
        setCurrentIntent(data);
      } else {
        const { data: nextData } = await supabase
          .from('vanguard_calendar')
          .select('*')
          .gt('start_time', now)
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        setCurrentIntent(nextData ? { ...nextData, isNext: true } : null);
      }
    } catch (err) {
      console.error('Error fetching intents:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- LOGIKA TEMPEROWANIA (DISCIPLINE ENGINE) ---
  const getDisciplineStatus = () => {
    const hour = new Date().getHours();
    
    // 1. Jeśli jest coś w kalendarzu - to jest priorytet
    if (currentIntent && !currentIntent.isNext) {
      return { 
        label: currentIntent.summary, 
        type: 'ACTIVE', 
        color: 'text-white', 
        bg: 'bg-primary/20',
        icon: Target 
      };
    }

    // 2. Jeśli noc/wieczór - regeneracja
    if (hour >= 0 && hour < 6) return { label: "PROTOCOL: DEEP SLEEP", type: 'RECOVERY', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: ShieldCheck };
    if (hour >= 22) return { label: "PROTOCOL: SHADOW WORK", type: 'RECOVERY', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: ShieldCheck };

    // 3. Sprawdź Power Listę
    const tasks = [1,2,3,4,5].map(i => todayWin?.[`done_${i}`]);
    const remainingTasks = tasks.filter(t => t === false).length;
    const allDone = tasks.length > 0 && remainingTasks === 0;

    // 4. Jeśli zadania czekają - TRYB EGZEKUCJI (Temperowanie)
    if (!allDone) {
      if (stability < 40) {
        return { label: "PROTOCOL: CRITICAL ALIGNMENT", type: 'URGENT', color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertTriangle };
      }
      return { label: "PROTOCOL: EXECUTION REQUIRED", type: 'DISCIPLINE', color: 'text-primary', bg: 'bg-primary/10', icon: Zap };
    }

    // 5. Wszystko zrobione - Zasłużony odpoczynek
    return { label: "PROTOCOL: EARNED RECOVERY", type: 'RECOVERY', color: 'text-green-400', bg: 'bg-green-500/10', icon: ShieldCheck };
  };

  if (loading) return null;
  const status = getDisciplineStatus();
  const StatusIcon = status.icon;

  return (
    <div className={`border rounded-3xl p-5 backdrop-blur-sm transition-all duration-500 ${status.bg} ${status.type === 'URGENT' ? 'border-red-500/30' : 'border-white/5'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusIcon className={status.color} size={16} />
          <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">System Protocol</h3>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${status.bg} ${status.color}`}>
          {status.type}
        </div>
      </div>

      <div className="flex-1">
        <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-1 italic">Active Directive</h2>
        <p className={`text-xl font-black uppercase tracking-tight leading-none ${status.color}`}>
          {status.label}
        </p>
        
        {status.type === 'DISCIPLINE' && (
          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-2 italic">
            Zadania Power Listy czekają. System blokuje tryb wolny.
          </p>
        )}
        {status.type === 'URGENT' && (
          <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest mt-2 italic animate-pulse">
            Stabilność krytyczna. Wróć do fundamentów NATYCHMIAST.
          </p>
        )}
      </div>

      {currentIntent && currentIntent.isNext && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[8px] font-bold text-white/20 uppercase tracking-widest">
            <Calendar size={10} />
            Next: {currentIntent.summary}
          </div>
          <span className="text-[8px] font-bold text-white/20 uppercase">
            {format(parseISO(currentIntent.start_time), 'HH:mm')}
          </span>
        </div>
      )}
    </div>
  );
}
