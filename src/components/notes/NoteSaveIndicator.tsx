import type { NoteSaveStatus } from './useNoteDraftAutosave';
import { Pressable } from '../ui/ControlPrimitives';

interface NoteSaveIndicatorProps {
  status: NoteSaveStatus;
  idleLabel?: string;
  onRetry: () => void;
  className?: string;
}

export default function NoteSaveIndicator({
  status,
  idleLabel = '',
  onRetry,
  className = '',
}: NoteSaveIndicatorProps) {
  const label = {
    idle: idleLabel,
    dirty: 'Niezapisane zmiany',
    saving: 'Zapisywanie…',
    saved: 'Zapisano',
    error: 'Nie udało się zapisać',
  }[status];

  return (
    <span className={className} aria-live="polite">
      {label}
      {status === 'error' && (
        <Pressable variant="ghost" size="sm" onClick={onRetry} className="ml-1 text-4xs">
          Ponów
        </Pressable>
      )}
    </span>
  );
}
