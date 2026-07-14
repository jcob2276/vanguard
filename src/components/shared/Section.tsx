import type { ReactNode } from 'react';

export interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, description, actions, children, className = '' }: SectionProps) {
  return (
    <section className={`grid gap-[var(--space-4)] ${className}`}>
      {(title || description || actions) && (
        <header className="flex items-end justify-between gap-[var(--space-4)]">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>}
            {description && <p className="mt-[var(--space-1)] text-sm leading-relaxed text-text-secondary">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export default Section;
