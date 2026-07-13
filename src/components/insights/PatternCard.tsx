import { useState } from 'react';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { Card } from '../ui/Card';
import { updatePatternStatus } from '../../lib/insightsApi';
import { notify } from '../../lib/notify';

interface PatternData {
  id: string;
  pattern_type: string;
  title: string | null;
  evidence_text: string;
  confidence: number;
  occurrence_count: number;
  status: string;
  last_seen: string | null;
}

const PATTERN_EMOJI: Record<string, string> = {
  recurring_blocker: '🔁',
  morning_protocol_impact: '🌅',
  sleep_friction_correlation: '😴',
  plan_adherence: '📋',
  early_warning: '⚠️',
  narrative_biometric_mismatch: '🧬',
};

interface PatternCardProps {
  pattern: PatternData;
  onFeedback?: (id: string, feedback: string) => void;
}

export function PatternCard({ pattern, onFeedback }: PatternCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const handleFeedback = async (feedback: 'confirmed' | 'rejected' | 'observe') => {
    if (done || loading) return;
    setLoading(feedback);
    try {
      const newStatus = feedback === 'confirmed' ? 'user_confirmed' : feedback === 'rejected' ? 'user_rejected' : pattern.status;
      await updatePatternStatus(pattern.id, newStatus);
      setDone(feedback);
      onFeedback?.(pattern.id, feedback);
      notify('Opinia została zapisana.', 'success');
    } catch (e: unknown) {
      console.error('[PatternCard Feedback Error]', e);
      notify('Nie udało się zapisać opinii.', 'error');
    } finally {
      setLoading(null);
    }
  };

  const emoji = PATTERN_EMOJI[pattern.pattern_type] ?? '📊';
  const weeks = pattern.last_seen
    ? Math.round(Math.abs(new Date().getTime() - new Date(pattern.last_seen).getTime()) / (7 * 24 * 3600 * 1000))
    : null;

  const statusColor =
    pattern.status === 'user_confirmed' ? 'var(--color-success)' :
    pattern.status === 'user_rejected' ? '#6B7280' :
    pattern.confidence >= 0.75 ? 'var(--color-warning)' : '#6366F1';

  return (
    <Card
      variant="outline"
      padding="1rem"
      className="space-y-3"
      style={{
        background: 'var(--color-surface, #fff)',
        borderRadius: '18px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        opacity: pattern.status === 'user_rejected' ? 0.5 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[18px]">{emoji}</span>
          <div>
            <p className="text-[12px] font-[800] leading-tight" style={{ color: 'var(--color-text-primary, #0A0A0A)' }}>
              {pattern.title ?? pattern.pattern_type}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: statusColor }}>
              N={pattern.occurrence_count} · {Math.round(pattern.confidence * 100)}% pewność
              {weeks !== null ? ` · ${weeks === 0 ? 'ten tydzień' : `${weeks}tg temu`}` : ''}
            </p>
          </div>
        </div>
        <span
          className="text-[9px] font-[800] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: `${statusColor}18`, color: statusColor }}
        >
          {pattern.status === 'user_confirmed' ? 'potwierdzone' :
           pattern.status === 'user_rejected' ? 'odrzucone' :
           pattern.status === 'visible' ? 'widoczne' : 'hipoteza'}
        </span>
      </div>

      {/* Evidence text */}
      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-secondary, #6B7280)' }}>
        {pattern.evidence_text}
      </p>

      {/* Feedback buttons */}
      {done ? (
        <p className="text-[11px] font-medium text-center" style={{ color: statusColor }}>
          {done === 'confirmed' ? '✓ Zaznaczono jako prawdziwe' :
           done === 'rejected' ? '✗ Odrzucono' : '👁 Obserwuj dalej'}
        </p>
      ) : pattern.status !== 'user_rejected' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => handleFeedback('confirmed')}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-[700] transition-all active:scale-95"
            style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            {loading === 'confirmed' ? <Spinner size="sm" className="h-3 w-3" /> : <CheckCircle2 size={11} />}
            To ma sens
          </button>
          <button
            onClick={() => handleFeedback('observe')}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-[700] transition-all active:scale-95"
            style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            {loading === 'observe' ? <Spinner size="sm" className="h-3 w-3" /> : <Eye size={11} />}
            Obserwuj
          </button>
          <button
            onClick={() => handleFeedback('rejected')}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-[700] transition-all active:scale-95"
            style={{ background: 'rgba(107,114,128,0.08)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.2)' }}
          >
            {loading === 'rejected' ? <Spinner size="sm" className="h-3 w-3" /> : <XCircle size={11} />}
            To nie moje
          </button>
        </div>
      )}
    </Card>
  );
}
