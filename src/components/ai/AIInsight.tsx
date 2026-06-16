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

function writeCache(text: string | null) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ text, ts: Date.now() }));
  } catch (_e) { /* localStorage unavailable */ }
}

export default function AIInsight({ session }: { session: any }) {
  const [insight, setInsight] = useState<string | null>(() => readCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Błąd systemu: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchInsight(false);
  }, [fetchInsight]);

  if (loading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={14} className="text-text-muted animate-spin" />
          <div className="h-2 w-24 bg-text-muted/20 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-text-muted/20 rounded"></div>
          <div className="h-3 w-2/3 bg-text-muted/20 rounded"></div>
        </div>
      </div>
    );
  }

  if (!insight && !error) return null;

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="card relative overflow-hidden p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.18em]">Oracle Insight</h3>
          </div>
          <button
            onClick={() => fetchInsight(true)}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-solid hover:text-text-primary border border-transparent hover:border-border-custom"
            title="Odśwież analizę"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 text-red-500">
            <ShieldAlert size={14} />
            <p className="text-[11px] font-bold">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[14px] font-medium text-text-primary leading-[1.72] whitespace-pre-wrap">
              {insight}
            </p>
            <div className="pt-4 border-t border-border-custom">
              <p className="text-[8px] font-black text-text-muted uppercase tracking-[0.2em]">Vanguard Oracle 5.0 · pełny kontekst · 24h</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
