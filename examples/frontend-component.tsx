/**
 * Canonical Vanguard React component pattern.
 *
 * Demonstrates:
 *   - useState for data / loading / error / refreshing
 *   - useEffect with session.user.id dependency
 *   - fetchRow() reads with .eq('user_id', session.user.id) - never omit this
 *   - call() helper that throws on !response.ok (error visible in UI, not swallowed)
 *   - DataStateNotice for loading / error / empty states
 *   - Tailwind dark theme: bg-neutral-950, border-white/[0.08], text-white/35
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../src/lib/supabase';
import DataStateNotice from '../src/components/core/DataStateNotice';

type SessionLike = {
  user: { id: string };
};

type ExampleRow = {
  value: string;
};

type EdgeErrorPayload = {
  error?: string;
};

export default function ExampleCard({ session }: { session: SessionLike }) {
  const [row, setRow] = useState<ExampleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // CRITICAL: always filter by user_id - missing filter = data from other users.
  const fetchRow = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('some_table')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle<ExampleRow>();

    if (qErr) {
      setError(qErr.message);
      setRow(null);
      return;
    }

    setRow(data);
  }, [session.user.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      await fetchRow();
      setLoading(false);
    })();
  }, [fetchRow]);

  async function refresh() {
    setRefreshing(true);
    setError(null);

    try {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      const token = activeSession?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL;

      // Canonical call() helper: throw on !response.ok so error surfaces in UI.
      const call = async (fn: string, body: Record<string, unknown>) => {
        const res = await fetch(`${base}/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({} as EdgeErrorPayload));
          throw new Error(`${fn} failed: ${payload.error || res.statusText || res.status}`);
        }

        return res;
      };

      await Promise.all([
        call('sync-source-a', { userId: session.user.id }),
        call('sync-source-b', { userId: session.user.id }),
      ]);
      await call('compute-derived', { userId: session.user.id });

      await fetchRow();
    } catch (e) {
      console.error('ExampleCard refresh:', e);
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <DataStateNotice tone="loading" title="Laduje..." detail="Pobieram dane." />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-500/15 bg-neutral-950/80 p-5">
        <DataStateNotice tone="warning" title="Blad" detail={error} />
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
