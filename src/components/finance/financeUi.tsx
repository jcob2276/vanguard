import type { ReactNode } from 'react';

/** Shared typography + layout for the finance module (Apple-style grouped sections). */

export const financeHeroNumberClass =
  'text-[var(--finance-display-size)] font-semibold tabular-nums tracking-[var(--tracking-display)] leading-[var(--line-height-display)] text-text-primary';

const financeAmountClass = 'tabular-nums tracking-[var(--tracking-tight)]';

export function FinanceSection({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(title || subtitle) && (
        <header className="mb-2.5 px-0.5">
          {title && (
            <h2 className="text-sm font-medium text-text-muted">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          )}
        </header>
      )}
      <div className="overflow-hidden rounded-2xl bg-surface-1/70 ring-1 ring-border-custom/25">
        {children}
      </div>
    </section>
  );
}

export function FinanceList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`divide-y divide-border-custom/20 ${className}`}>{children}</div>;
}

export function FinanceRow({
  primary,
  secondary,
  trailing,
  children,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium leading-snug text-text-primary">{primary}</div>
          {secondary && (
            <div className="mt-0.5 text-sm leading-relaxed text-text-muted">{secondary}</div>
          )}
        </div>
        {trailing && (
          <div className={`shrink-0 text-base font-medium ${financeAmountClass} text-text-primary`}>
            {trailing}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function FinanceEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-8 text-center text-sm leading-relaxed text-text-muted">{children}</p>
  );
}

export function FinanceProse({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-base leading-[var(--line-height-reading)] text-text-secondary ${className}`}>{children}</p>
  );
}
