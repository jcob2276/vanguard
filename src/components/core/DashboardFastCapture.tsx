import { Pressable } from '../ui/ControlPrimitives';
import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Fab from '../ui/Fab';

interface FastCaptureItem {
  label: string;
  emoji: string;
  color: string;
  action: () => void;
}

interface ToolItem {
  label: string;
  icon: LucideIcon;
  action: () => void;
}

interface Props {
  show: boolean;
  onClose: () => void;
  items: FastCaptureItem[];
  tools: ToolItem[];
}

export function DashboardFastCaptureMenu({ show, onClose, items, tools }: Props) {
  if (!show) return null;
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[var(--z-nav)] bg-scrim/40 backdrop-blur-[var(--blur-fine)] animate-fadeIn"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 z-[var(--z-modal)] w-[calc(100%_-_2rem)] max-w-[360px] -translate-x-1/2 rounded-[28px] border border-border-custom/70 bg-background/90 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-3xl animate-in slide-in-from-bottom-4 fade-in duration-200"
        style={{ bottom: 'var(--ds-inline-style-calc-max-2rem-calc-1rem-env-safe-area-inset-bottom-5-6rem)' }}
      >
        <p className="mb-2 px-1 text-2xs font-black uppercase tracking-[0.16em] text-text-muted">Szybkie akcje</p>
        <div className="grid grid-cols-4 gap-2">
          {items.map(item => (
            <Pressable
              key={item.label}
              variant="ghost"
              onClick={() => run(item.action)}
              className="flex min-w-0 flex-col gap-2 rounded-2xl px-1 py-3 text-center active:scale-95"
              aria-label={item.label}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-on-accent shadow-sm" style={{ backgroundColor: item.color }}>{item.emoji}</span>
              <span className="line-clamp-2 text-3xs font-bold leading-tight text-text-secondary">{item.label}</span>
            </Pressable>
          ))}
        </div>

        <div className="my-3 h-px bg-border-custom/60" />
        <p className="mb-2 px-1 text-2xs font-black uppercase tracking-[0.16em] text-text-muted">Narzędzia</p>
        <div className="grid grid-cols-4 gap-2">
          {tools.map(({ label, icon: Icon, action }) => (
            <Pressable
              key={label}
              variant="ghost"
              onClick={() => run(action)}
              className="flex min-w-0 flex-col gap-2 rounded-2xl px-1 py-3 text-center active:scale-95"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-surface-1 text-primary shadow-sm ring-1 ring-border-custom/50"><Icon size={20} /></span>
              <span className="text-3xs font-bold leading-tight text-text-secondary">{label}</span>
            </Pressable>
          ))}
        </div>
      </div>
    </>
  );
}

interface FabProps {
  active: boolean;
  onToggle: () => void;
}

export function DashboardFastCaptureFAB({ active, onToggle }: FabProps) {
  return (
    <Fab
      position="bottom-center"
      size="sm"
      onClick={onToggle}
      title={active ? 'Zamknij menu' : 'Otwórz akcje i narzędzia'}
      className="fast-capture-btn"
      style={{ bottom: 'var(--ds-inline-style-calc-max-2rem-calc-1rem-env-safe-area-inset-bottom-1-95rem)' }}
    >
      <div className={`transition-transform duration-[var(--motion-slow)] ${active ? 'rotate-[var(--ds-arbitrary-135deg)]' : ''}`}>
        <Plus size={18} strokeWidth={3.5} />
      </div>
    </Fab>
  );
}
