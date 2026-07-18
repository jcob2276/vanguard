import { useEffect } from 'react';
import { notify } from '../../lib/notify';
import { redoLastAction, undoLastAction } from '../../lib/actionHistory';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export default function ActionHistoryController() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      const operation = event.shiftKey ? redoLastAction() : undoLastAction();
      void operation.catch((error: unknown) => {
        notify(error instanceof Error ? error.message : 'Nie udało się cofnąć zmiany.', 'error');
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}

