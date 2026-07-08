import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { RefreshCw, Brain } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PatternCard, type PatternData } from './PatternCard';

const STATUS_ORDER: Record<string, number> = {
  user_confirmed: 0,
  visible: 1,
  hypothesis: 2,
  user_rejected: 3,
  archived: 4,
};

interface PatternsViewProps {
  session: Session;
}

export function PatternsView({ session }: PatternsViewProps) {
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const userId = session.user.id;

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vanguard_behavioral_patterns')
      .select('id, pattern_type, title, evidence_text, confidence, occurrence_count, status, last_seen')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('confidence', { ascending: false });
    if (data) {
      setPatterns(
        [...data].map(row => ({
          id: row.id,
          pattern_type: row.pattern_type,
          title: row.title,
          evidence_text: row.evidence_text ?? '',
          confidence: Number(row.confidence ?? 0),
          occurrence_count: row.occurrence_count ?? 0,
          status: row.status ?? 'hypothesis',
          last_seen: row.last_seen ?? null,
        })).sort((a, b) => (STATUS_ORDER[a.status ?? 'hypothesis'] ?? 9) - (STATUS_ORDER[b.status ?? 'hypothesis'] ?? 9))
      );
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchPatterns(); }, [fetchPatterns]);

  const runDetection = async () => {
    setRunning(true);
    try {
      await supabase.functions.invoke('vanguard-nightly?action=detect-patterns', {
        body: { user_id: userId },
      });
      await fetchPatterns();
    } catch (e: unknown) {
      console.error('[Background Error]', e);
    } finally {
      setRunning(false);
    }
  };

  const handleFeedback = (id: string, feedback: string) => {
    setPatterns(prev =>
      prev.map(p => p.id === id
        ? { ...p, status: feedback === 'confirmed' ? 'user_confirmed' : feedback === 'rejected' ? 'user_rejected' : p.status }
        : p
      )
    );
  };

  const visible = patterns.filter(p => p.status !== 'user_rejected');
  const rejected = patterns.filter(p => p.status === 'user_rejected');

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={15} className="text-primary" />
          <span className="text-[13px] font-[800]" style={{ color: 'var(--color-text-primary, #0A0A0A)' }}>
            Wzorce behawioralne
          </span>
          {!loading && (
            <span
              className="text-[10px] font-[700] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}
            >
              {visible.length}
            </span>
          )}
        </div>
        <button
          onClick={runDetection}
          disabled={running || loading}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-[700] transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <RefreshCw size={11} className={running ? 'animate-spin' : ''} />
          {running ? 'Analizuję...' : 'Wykryj wzorce'}
        </button>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-[18px] p-4 animate-pulse" style={{ background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', height: 120 }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && visible.length === 0 && (
        <div className="rounded-[18px] p-6 text-center space-y-2" style={{ background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))' }}>
          <p className="text-[24px]">🔍</p>
          <p className="text-[13px] font-[700]" style={{ color: 'var(--color-text-primary, #0A0A0A)' }}>
            Brak wykrytych wzorców
          </p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted, #9CA3AF)' }}>
            Kliknij "Wykryj wzorce" żeby uruchomić analizę danych z ostatnich 90 dni.
            Potrzeba min. 7–10 dni danych.
          </p>
        </div>
      )}

      {/* Visible patterns */}
      {!loading && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map(p => (
            <PatternCard key={p.id} pattern={p} userId={userId} onFeedback={handleFeedback} />
          ))}
        </div>
      )}

      {/* Rejected (collapsed) */}
      {!loading && rejected.length > 0 && (
        <details className="group">
          <summary
            className="cursor-pointer text-[11px] font-[700] list-none py-2"
            style={{ color: 'var(--color-text-muted, #9CA3AF)' }}
          >
            ▸ Odrzucone wzorce ({rejected.length})
          </summary>
          <div className="space-y-3 mt-2">
            {rejected.map(p => (
              <PatternCard key={p.id} pattern={p} userId={userId} onFeedback={handleFeedback} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
