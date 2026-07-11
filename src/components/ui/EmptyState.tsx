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
    <div className="mx-1 my-2 rounded-xl border border-dashed border-border-custom/25 bg-surface-solid/10 p-6 text-center">
      <span className="block text-[24px] mb-1">{icon}</span>
      <span className="block text-[11px] font-bold tracking-wide text-text-muted/60">{label}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 rounded-xl bg-primary/10 px-3.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 active:scale-95 transition-all cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
