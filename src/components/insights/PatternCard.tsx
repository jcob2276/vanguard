import Button from '../ui/Button';
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
    pattern.status === 'user_rejected' ? 'var(--legacy-color-025)' :
    pattern.confidence >= 0.75 ? 'var(--color-warning)' : 'var(--legacy-color-024)';

  return (
    <Card
      variant="outline"
      padding="1rem"
      className="space-y-3"
      style={{
        background: 'var(--color-surface, var(--legacy-color-046))',
        borderRadius: 'var(--legacy-inline-style-007)',
        boxShadow: 'var(--shadow-pattern-card)',
        opacity: pattern.status === 'user_rejected' ? 'var(--opacity-pattern-rejected)' : 'var(--opacity-100)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <div>
            <p className="text-sm font-[var(--legacy-arbitrary-022)] leading-tight" style={{ color: 'var(--color-text-primary, var(--legacy-color-002))' }}>
              {pattern.title ?? pattern.pattern_type}
            </p>
            <p className="text-xs font-medium mt-0.5" style={{ color: statusColor }}>
              N={pattern.occurrence_count} · {Math.round(pattern.confidence * 100)}% pewność
              {weeks !== null ? ` · ${weeks === 0 ? 'ten tydzień' : `${weeks}tg temu`}` : ''}
            </p>
          </div>
        </div>
        <span
          className="text-2xs font-[var(--legacy-arbitrary-022)] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, color: statusColor }}
        >
          {pattern.status === 'user_confirmed' ? 'potwierdzone' :
           pattern.status === 'user_rejected' ? 'odrzucone' :
           pattern.status === 'visible' ? 'widoczne' : 'hipoteza'}
        </span>
      </div>

      {/* Evidence text */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary, var(--legacy-color-025))' }}>
        {pattern.evidence_text}
      </p>

      {/* Feedback buttons */}
      {done ? (
        <p className="text-xs font-medium text-center" style={{ color: statusColor }}>
          {done === 'confirmed' ? '✓ Zaznaczono jako prawdziwe' :
           done === 'rejected' ? '✗ Odrzucono' : '👁 Obserwuj dalej'}
        </p>
      ) : pattern.status !== 'user_rejected' && (
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => handleFeedback('confirmed')}
            disabled={!!loading}
            variant="ghost"
            className="flex-1 gap-1.5 rounded-xl py-2 px-0 text-xs font-[var(--legacy-arbitrary-049)] active:scale-95"
            style={{ background: 'var(--legacy-color-095)', color: 'var(--color-success)', border: 'var(--border-width-thin) solid var(--legacy-color-097)' }}
          >
            {loading === 'confirmed' ? <Spinner size="sm" className="h-3 w-3" /> : <CheckCircle2 size={11} />}
            To ma sens
          </Button>
          <Button
            onClick={() => handleFeedback('observe')}
            disabled={!!loading}
            variant="ghost"
            className="flex-1 gap-1.5 rounded-xl py-2 px-0 text-xs font-[var(--legacy-arbitrary-049)] active:scale-95"
            style={{ background: 'var(--primary-8)', color: 'var(--color-primary)', border: 'var(--border-width-thin) solid var(--primary-20)' }}
          >
            {loading === 'observe' ? <Spinner size="sm" className="h-3 w-3" /> : <Eye size={11} />}
            Obserwuj
          </Button>
          <Button
            onClick={() => handleFeedback('rejected')}
            disabled={!!loading}
            variant="ghost"
            className="flex-1 gap-1.5 rounded-xl py-2 px-0 text-xs font-[var(--legacy-arbitrary-049)] active:scale-95"
            style={{ background: 'var(--legacy-color-061)', color: 'var(--text-secondary)', border: 'var(--border-width-thin) solid var(--legacy-color-062)' }}
          >
            {loading === 'rejected' ? <Spinner size="sm" className="h-3 w-3" /> : <XCircle size={11} />}
            To nie moje
          </Button>
        </div>
      )}
    </Card>
  );
}
