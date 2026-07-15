import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { acknowledgeLoggingGap, type LoggingGapReason } from '../../lib/behavior/behaviorLogClient';

interface Props {
  userId: string;
  lastLoggedDate: string;
  onClose: () => void;
}

const REASONS: { key: LoggingGapReason; label: string; icon: string }[] = [
  { key: 'ok', label: 'OK, po prostu nie logowałem', icon: '👍' },
  { key: 'chory', label: 'Choroba / infekcja', icon: '🤒' },
  { key: 'podroz', label: 'Podróż / zmiana strefy', icon: '✈️' },
];

export default function LoggingGapPromptModal({ userId, lastLoggedDate, onClose }: Props) {
  const [saving, setSaving] = useState<LoggingGapReason | null>(null);

  const handlePick = async (reason: LoggingGapReason) => {
    setSaving(reason);
    try {
      await acknowledgeLoggingGap(userId, lastLoggedDate, reason);
    } catch (e: unknown) {
      console.warn('[LoggingGapPromptModal] Failed to save gap acknowledgement:', e);
    }
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} padding="p-5" size="sm" title="Przerwa w logowaniu">
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          Od kilku dni nie ma wpisów. Zanim system policzy to jako "brak danych", zaznacz co się działo —
          korelacje wykluczą ten okres z analizy.
        </p>
        <div className="flex flex-col gap-2">
          {REASONS.map((r) => (
            <Button
              key={r.key}
              variant="outline"
              onClick={() => handlePick(r.key)}
              disabled={saving !== null}
              className="justify-start gap-2"
            >
              {saving === r.key ? <Spinner size="sm" /> : <span>{r.icon}</span>}
              {r.label}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
