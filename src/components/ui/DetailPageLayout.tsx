import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

interface DetailPageLayoutProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function DetailPageLayout({ title, subtitle, onBack, actions, children }: DetailPageLayoutProps) {
  return (
    <div className="flex flex-col min-h-0 h-full">
      <header
        className="sticky top-0 z-[var(--z-popover)] flex items-center gap-3 border-b border-border-custom bg-surface-solid/95 backdrop-blur-[var(--blur-md)] px-4 py-3"
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-custom text-text-secondary hover:text-text-primary"
            aria-label="Wróć"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-text-primary">{title}</h1>
          {subtitle && <p className="truncate text-xs text-text-tertiary">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  );
}
