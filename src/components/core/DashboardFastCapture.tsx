import { Pressable } from '../ui/ControlPrimitives';
import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Fab from '../ui/Fab';
import Modal from '../ui/Modal';

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
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Modal
      isOpen={show}
      onClose={onClose}
      title="Szybkie akcje"
      showCloseButton={false}
      size="sm"
      padding="p-4"
      overflowY={false}
      overlayClassName="items-end"
      className="ios-fast-capture-modal"
    >
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
        <p className="mb-2 px-1 text-xs font-semibold tracking-[var(--ios-metadata-tracking)] text-text-muted">Narzędzia</p>
        <div className="grid grid-cols-4 gap-2">
          {tools.map(({ label, icon: Icon, action }) => (
            <Pressable
              key={label}
              variant="ghost"
              onClick={() => run(action)}
              className="flex min-w-0 flex-col gap-2 rounded-2xl px-1 py-3 text-center active:scale-95"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[var(--ios-icon-radius)] bg-surface-1 text-primary shadow-sm ring-1 ring-border-custom/50"><Icon size={20} /></span>
              <span className="text-3xs font-bold leading-tight text-text-secondary">{label}</span>
            </Pressable>
          ))}
        </div>
    </Modal>
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
