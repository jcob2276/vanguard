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
      const userData = await gatherUserContext(supabase, session.user.id);
      
      const { data, error: functionError } = await supabase.functions.invoke('ai-advisor', {
        body: { 
          context: {
            user_data: userData
          }
        }
      });

      if (functionError) throw functionError;
      setInsight(data.insight);
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
