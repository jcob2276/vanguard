import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { gatherUserContext } from '../../lib/aiContext';
import { ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

const CACHE_KEY = 'vanguard_oracle_insight';
const CACHE_TTL = 60 * 60 * 1000; // 1 godzina

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return text;
  } catch (_e) { /* localStorage unavailable */ }
  return null;
}

function writeCache(text) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ text, ts: Date.now() }));
  } catch (_e) { /* localStorage unavailable */ }
}

export default function AIInsight({ session }) {
  const [insight, setInsight] = useState(() => readCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsight = useCallback(async (force = false) => {
    if (!session?.user?.id) return;
    if (!force) {
      const cached = readCache();
      if (cached) { setInsight(cached); return; }
    }

    setLoading(true);
    setError(null);

    try {
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
      if (data?.text) {
        setInsight(data.text);
        writeCache(data.text);
      }

    } catch (err) {
      console.error('Vanguard Oracle Error:', err);
      setError(`Błąd systemu: ${err.message || 'Brak odpowiedzi od Wyroczni.'}`);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchInsight(false);
  }, [fetchInsight]);

  if (loading) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5 animate-pulse">
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
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(12,12,13,0.96))] p-5 shadow-2xl shadow-black/30">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <h3 className="text-[10px] font-black text-white/45 uppercase tracking-[0.18em]">Oracle Insight</h3>
          </div>
          <button
            onClick={() => fetchInsight(true)}
            className="rounded-md p-1 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white"
            title="Odśwież analizę"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 text-white/45">
            <ShieldAlert size={14} />
            <p className="text-[11px] font-bold">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[14px] font-medium text-white/86 leading-[1.72] whitespace-pre-wrap">
              {insight}
            </p>
            <div className="pt-4 border-t border-white/5">
              <p className="text-[8px] font-black text-white/28 uppercase tracking-[0.2em]">Vanguard Oracle 5.0 · pełny kontekst · 24h</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
