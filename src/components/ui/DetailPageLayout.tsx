import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface DetailPageLayoutProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DetailPageLayout({ title, subtitle, onBack, headerRight, children, className = '' }: DetailPageLayoutProps) {
  return (
    <div className={`flex flex-col min-h-screen bg-background text-text-primary ${className}`}>
      {/* Sticky fixed header */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 border-b"
        style={{
          height: 56,
          background: 'var(--background, white)',
          borderColor: 'rgba(153,161,175,0.12)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-90"
            style={{
              background: 'rgba(153,161,175,0.08)',
              boxShadow: 'var(--shadow-back-btn, 0 0 9px rgba(0,0,0,0.04))',
            }}
          >
            <ArrowLeft size={15} style={{ color: 'var(--text-primary)' }} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-[800] truncate" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          {subtitle && <p className="text-[10px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{subtitle}</p>}
        </div>
        {headerRight && <div className="flex-shrink-0">{headerRight}</div>}
      </header>

      {/* Scrollable content — offset by header height */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: 56, paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
    </div>
  );
}
