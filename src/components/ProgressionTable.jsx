import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BENCH_PROGRESSION } from '../data/workoutPlan';
import { Trophy, CheckCircle, Circle } from 'lucide-react';
import { format, parseISO, startOfWeek, differenceInWeeks } from 'date-fns';
import { useStore } from '../store/useStore';

export default function ProgressionTable({ session }) {
  const { userSettings } = useStore();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const PROGRAM_START = userSettings?.program_start_date ? parseISO(userSettings.program_start_date) : new Date('2026-04-26');

  useEffect(() => {
    async function fetchBenchHistory() {
      const { data } = await supabase
        .from('exercise_logs')
        .select('*')
        .ilike('exercise_name', '%Wyciskanie płaskie%')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });
      
      setHistory(data || []);
      setLoading(false);
    }
    fetchBenchHistory();
  }, [session.user.id]);

  const currentWeekIndex = Math.max(0, differenceInWeeks(new Date(), PROGRAM_START));

  const getStatus = (weekRange, type) => {
    // Basic logic to check if a specific weight was hit in that week range
    // weekRange is e.g. "1-2"
    const weeks = weekRange.split('-').map(Number);
    const startWeek = weeks[0];
    const endWeek = weeks.length > 1 ? weeks[1] : weeks[0];
    
    const logsInPeriod = history.filter(log => {
      const logWeek = differenceInWeeks(parseISO(log.created_at), PROGRAM_START) + 1;
      return logWeek >= startWeek && logWeek <= endWeek;
    });

    if (logsInPeriod.length === 0) return 'pending';
    
    // Check if any log in period matches the target weight (simplified)
    return 'done';
  };

  return (
    <div className="card overflow-hidden p-0 border border-neutral-800 bg-neutral-900/50">
      <div className="bg-neutral-900 p-4 border-b border-neutral-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Trophy className="text-primary" size={18} />
          <h3 className="font-black text-white uppercase text-xs tracking-widest italic">VANGUARD MATRIX</h3>
        </div>
        <span className="text-[8px] font-black text-neutral-500 uppercase">PROTOCOL v1.0</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[10px]">
          <thead>
            <tr className="bg-black/40 text-neutral-500 uppercase font-black tracking-widest">
              <th className="p-3 w-16">Tydz.</th>
              <th className="p-3">Target Top</th>
              <th className="p-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900">
            {BENCH_PROGRESSION.map((row, idx) => {
              const weeks = row.week.split('-').map(Number);
              const isCurrent = currentWeekIndex + 1 >= weeks[0] && (weeks.length === 1 || currentWeekIndex + 1 <= weeks[1]);
              const status = getStatus(row.week);

              return (
                <tr key={idx} className={`${isCurrent ? 'bg-primary/5 border-l-2 border-primary' : ''} ${row.isPR ? 'bg-dayC/5' : ''} transition-colors`}>
                  <td className={`p-3 font-black ${isCurrent ? 'text-primary' : 'text-neutral-500'}`}>
                    {row.week}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="text-white font-black italic">{row.top}</span>
                      <span className="text-[8px] text-neutral-600 font-bold uppercase tracking-tighter">Back-off: {row.backoff}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    {status === 'done' ? (
                      <CheckCircle size={14} className="text-dayC inline-block" />
                    ) : (
                      <Circle size={14} className={`${isCurrent ? 'text-primary animate-pulse' : 'text-neutral-800'} inline-block`} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
