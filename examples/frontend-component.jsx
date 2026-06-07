/**
 * Canonical Vanguard React component pattern.
 *
 * Demonstrates:
 *   - useState for data / loading / error / refreshing
 *   - useEffect with session.user.id dependency
 *   - fetchRow() reads with .eq('user_id', session.user.id) — never omit this
 *   - call() helper that throws on !response.ok (error visible in UI, not swallowed)
 *   - DataStateNotice for loading / error / empty states
 *   - Tailwind dark theme: bg-neutral-950, border-white/[0.08], text-white/35
 */

import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw } from 'lucide-react';
import DataStateNotice from './DataStateNotice';

export default function ExampleCard({ session }) {
  const [row, setRow]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── DB read ──────────────────────────────────────────────────────────────────
  // CRITICAL: always filter by user_id — missing filter = data from other users
  const fetchRow = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('some_table')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (qErr) { setError(qErr.message); setRow(null); }
    else setRow(data);
  }, [session.user.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      await fetchRow();
      setLoading(false);
    })();
  }, [fetchRow]);

  // ── Edge function calls ──────────────────────────────────────────────────────
  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const base  = import.meta.env.VITE_SUPABASE_URL;

      // CANONICAL call() helper — throws on !response.ok so error surfaces in UI
      const call = async (fn, body) => {
        const res = await fetch(`${base}/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const p = await res.json().catch(() => ({}));
          throw new Error(`${fn} failed: ${p.error || res.statusText || res.status}`);
        }
        return res;
      };

      // Parallel calls when independent, sequential when each depends on the previous
      await Promise.all([
        call('sync-source-a', { userId: session.user.id }),
        call('sync-source-b', { userId: session.user.id }),
      ]);
      await call('compute-derived', { userId: session.user.id });

      await fetchRow();
    } catch (e) {
      console.error('ExampleCard refresh:', e);
      setError(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  // ── Render states ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice tone="loading" title="Ładuję..." detail="Pobieram dane." />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-500/15 bg-neutral-950/80 p-5">
        <DataStateNotice tone="warning" title="Błąd" detail={error} />
      </section>
    );
  }

  if (!row) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice title="Brak danych" detail="Uruchom sync." />
      </section>
    );
  }

  // ── Happy path ────────────────────────────────────────────────────────────────
  return (
    <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Label</p>
          <h3 className="text-lg font-black text-white">{row.value}</h3>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-white/45 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </section>
  );
}
