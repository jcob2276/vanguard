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
    <div className="mx-0 my-3 rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl shadow-inner">
        {icon}
      </div>
      <p className="text-xs font-semibold text-text-muted tracking-tight max-w-xs mx-auto leading-relaxed">{label}</p>
      {action && (
        <Button
          variant="tonal"
          size="sm"
          onClick={action.onClick}
          className="mt-4 !rounded-full !px-4 !py-2 text-xs font-bold active:scale-95 transition-transform"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

