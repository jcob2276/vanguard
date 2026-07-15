import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';

// Tokens use CSS custom properties (--text-primary, --border, --surface) defined in index.css
// for both light and dark mode — avoids the previous dark-only text-on-accent/35 hardcoded values.
const TONES = {
  info: {
    icon: Info,
    border: 'border-[var(--border)]',
    bg: 'bg-[var(--surface)]/60',
    iconTone: 'text-[var(--text-muted)]',
    titleTone: 'text-[var(--text-secondary)]',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-warning/20',
    bg: 'bg-warning/5',
    iconTone: 'text-warning/80',
    titleTone: 'text-warning dark:text-warning/85',
  },
  loading: {
    icon: RefreshCw,
    border: 'border-[var(--border)]',
    bg: 'bg-[var(--surface)]/60',
    iconTone: 'text-[var(--text-muted)]',
    titleTone: 'text-[var(--text-secondary)]',
  },
};

interface DataStateNoticeProps {
  title: string;
  detail?: string | null;
  tone?: 'info' | 'warning' | 'loading';
}

export default function DataStateNotice({ title, detail, tone = 'info' }: DataStateNoticeProps) {
  const state = TONES[tone] || TONES.info;
  const Icon = state.icon;

  return (
    <Card
      variant="surface"
      padding="0.75rem"
      style={{ boxShadow: 'none' }}
      className={`flex items-start gap-3 !bg-transparent !rounded-xl border ${state.border} ${state.bg}`}
    >
      <Icon size={14} className={`${state.iconTone} mt-0.5 shrink-0 ${tone === 'loading' ? 'animate-spin' : ''}`} />
      <div className="min-w-0 space-y-1">
        <p className={`text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-16em)] ${state.titleTone}`}>
          {title}
        </p>
        {detail && (
          <p className="text-xs font-semibold leading-relaxed text-[var(--text-muted)]">
            {detail}
          </p>
        )}
      </div>
    </Card>
  );
}
