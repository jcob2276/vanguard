import Button from './Button';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon: string;
  label: string;
  action?: EmptyStateAction;
}

export default function EmptyState({ icon, label, action }: EmptyStateProps) {
  return (
    <div className="mx-1 my-2 rounded-[var(--radius-lg)] border border-dashed border-border-custom/25 bg-surface-solid/10 p-6 text-center">
      <span className="block text-2xl mb-1">{icon}</span>
      <span className="block text-xs font-bold tracking-wide text-text-muted/60">{label}</span>
      {action && (
        <Button
          variant="tonal"
          size="sm"
          onClick={action.onClick}
          className="mt-3"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
