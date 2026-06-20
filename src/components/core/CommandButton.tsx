import { Play } from 'lucide-react';

interface CommandButtonProps {
  icon: any;
  label: string;
  eyebrow?: string;
  onClick: () => void;
  tone?: string;
  disabled?: boolean;
}

export default function CommandButton({
  icon: Icon,
  label,
  eyebrow,
  onClick,
  tone = 'primary',
  disabled = false,
}: CommandButtonProps) {
  const primary = tone === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-[24px] border p-4 text-left transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:transform-none cursor-pointer ${
        primary
          ? 'border-primary/10 bg-primary/[0.06] hover:bg-primary/[0.1] shadow-[0_8px_20px_rgba(79,70,229,0.05)]'
          : 'border-border-custom bg-surface backdrop-blur-md hover:border-primary/20 hover:bg-surface-solid hover:shadow-md'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
            primary
              ? 'bg-primary/10 text-primary'
              : 'bg-text-primary/[0.03] text-text-secondary border border-border-custom'
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          {eyebrow && (
            <p
              className={`text-[9px] font-bold uppercase tracking-[0.15em] ${
                primary ? 'text-primary/70' : 'text-text-muted'
              }`}
            >
              {eyebrow}
            </p>
          )}
          <p className="truncate font-display text-[13px] font-black tracking-tight text-text-primary mt-0.5">
            {label}
          </p>
        </div>
      </div>
      {primary && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-[0_2px_8px_rgba(79,70,229,0.3)]">
          <Play size={12} className="ml-0.5 shrink-0" fill="currentColor" />
        </div>
      )}
    </button>
  );
}
