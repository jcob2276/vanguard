import type { ReactNode } from 'react';

export interface PageShellProps {
  sidebar?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageShell({ sidebar, header, children, className = '' }: PageShellProps) {
  return (
    <div className={`flex h-screen overflow-hidden bg-background text-text-primary ${className}`}>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header}
        {children}
      </div>
    </div>
  );
}

export default PageShell;
