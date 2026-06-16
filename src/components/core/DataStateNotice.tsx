import { AlertTriangle, Info, RefreshCw } from 'lucide-react';

const TONES = {
  info: {
    icon: Info,
    border: 'border-white/5',
    bg: 'bg-neutral-950/55',
    iconTone: 'text-white/35',
    titleTone: 'text-white/70',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/15',
    bg: 'bg-amber-500/5',
    iconTone: 'text-amber-400/75',
    titleTone: 'text-amber-300/85',
  },
  loading: {
    icon: RefreshCw,
    border: 'border-white/5',
    bg: 'bg-neutral-950/55',
    iconTone: 'text-white/35',
    titleTone: 'text-white/70',
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
    <div className={`flex items-start gap-3 rounded-xl border ${state.border} ${state.bg} px-3 py-3`}>
      <Icon size={14} className={`${state.iconTone} mt-0.5 shrink-0 ${tone === 'loading' ? 'animate-spin' : ''}`} />
      <div className="min-w-0 space-y-1">
        <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${state.titleTone}`}>
          {title}
        </p>
        {detail && (
          <p className="text-[10px] font-semibold leading-relaxed text-white/40">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
