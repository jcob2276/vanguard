import type { ReactNode } from 'react';
import Button from './Button';
import Modal from './Modal';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  primaryAction?: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean };
  secondaryAction?: { label: string; onClick?: () => void };
}

function Dialog({ open, onOpenChange, title, description, children, primaryAction, secondaryAction }: DialogProps) {
  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} title={title} size="sm">
      {description && <p className="mt-[var(--space-2)] text-sm leading-relaxed text-text-secondary">{description}</p>}
      <div className="mt-[var(--space-4)]">{children}</div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-[var(--space-6)] flex justify-end gap-[var(--space-2)]">
          {secondaryAction && <Button variant="ghost" onClick={secondaryAction.onClick ?? (() => onOpenChange(false))}>{secondaryAction.label}</Button>}
          {primaryAction && <Button variant={primaryAction.danger ? 'danger' : 'primary'} disabled={primaryAction.disabled} onClick={primaryAction.onClick}>{primaryAction.label}</Button>}
        </div>
      )}
    </Modal>
  );
}

export default Dialog;
