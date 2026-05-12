import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { gatherUserContext } from '../lib/aiContext';
import { ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

export default function AIInsight({ session }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchInsight() {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Jeden shared builder — identyczny state_vector co MentorChat
      const stateVector = await gatherUserContext(session);

      const { data, error: functionError } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          current_query: 'Jak wygląda mój stan dziś? Co widzisz w danych?',
          user_id: session.user.id,
          mode: 'mirror'
        }
      });

      if (functionError) throw functionError;
      if (data?.text) setInsight(data.text);

    } catch (err) {
      console.error('Vanguard Oracle Error:', err);
      setError(`Błąd systemu: ${err.message || 'Brak odpowiedzi od Wyroczni.'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInsight();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={14} className="text-neutral-700 animate-spin" />
          <div className="h-2 w-24 bg-neutral-800 rounded"></div>
        </div>
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
          <div className="flex items-center gap-2 text-neutral-600">
            <ShieldAlert size={14} />
            <p className="text-[11px] font-bold uppercase italic">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[14px] font-normal text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {insight}
            </p>
            <div className="pt-4 border-t border-white/5">
              <p className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.2em]">Vanguard Oracle 5.0 — Pełny Kontekst</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
