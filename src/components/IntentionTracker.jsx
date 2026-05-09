import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Target, AlertCircle } from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';

export default function IntentionTracker({ session }) {
  const [currentIntent, setCurrentIntent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntents();
    const interval = setInterval(fetchIntents, 60000); // Odświeżaj co minutę
    return () => clearInterval(interval);
  }, []);

  async function fetchIntents() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('vanguard_calendar')
        .select('*')
        .lte('start_time', now)
        .gte('end_time', now)
        .maybeSingle();

      if (data) {
        setCurrentIntent(data);
      } else {
        // Jeśli nie ma nic teraz, znajdź następne
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

  if (loading) return null;

  return (
    <div className="bg-neutral-900/40 border border-white/5 rounded-3xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="text-primary" size={16} />
          <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Intention Alignment</h3>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${currentIntent?.isNext ? 'bg-blue-500/10 text-blue-400' : 'bg-primary/10 text-primary animate-pulse'}`}>
          {currentIntent?.isNext ? 'Coming Up' : 'Active Protocol'}
        </div>
      </div>

      <div className="flex-1">
        <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-1 italic">Active Protocol</h2>
        <p className="text-xl font-black text-white uppercase tracking-tight leading-none">
          {currentIntent ? currentIntent.summary : (() => {
            const hour = new Date().getHours();
            if (hour >= 0 && hour < 6) return "SEN / REGENERACJA";
            if (hour >= 22) return "PRZYGOTOWANIE DO SNU";
            return "TRYB OPERACYJNY WOLNY";
          })()}
        </p>
        {!currentIntent && (
          <p className="text-[8px] font-bold text-primary uppercase tracking-widest mt-1 italic animate-pulse">
            System Auto-Assigned Protocol
          </p>
        )}
      </div>

      {currentIntent && (
        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
          <Calendar size={12} />
          {format(parseISO(currentIntent.start_time), 'HH:mm')} - {format(parseISO(currentIntent.end_time), 'HH:mm')}
        </div>
      )}
    </div>
  );
}
