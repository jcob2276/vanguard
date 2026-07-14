import { Pressable } from '../ui/ControlPrimitives';
import { Plus } from 'lucide-react';
import Fab from '../ui/Fab';

interface FastCaptureItem {
  label: string;
  emoji: string;
  color: string;
  action: () => void;
}

interface Props {
  show: boolean;
  onClose: () => void;
  items: FastCaptureItem[];
}

export function DashboardFastCaptureMenu({ show, onClose, items }: Props) {
  if (!show) return null;
  return (
    <>
      {/* NOTE: custom overlay — DashboardFastCapturMenu is a FAB radial action popup anchored above the FAB
          button via calc(bottom) coordinates. ui/Modal centers content on screen and cannot provide
          the required position, so a raw fixed overlay is intentional here. */}
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[var(--z-nav)] bg-scrim/40 backdrop-blur-[var(--blur-fine)] transition-all animate-fadeIn"
        onClick={onClose}
      />

      {/* Menu overlay */}
      <div
        className="fixed left-1/2 z-[var(--z-modal)] flex -translate-x-1/2 flex-col items-center gap-3 transition-all duration-[var(--motion-slow)] pointer-events-none"
        style={{ bottom: 'var(--legacy-inline-style-013)' }}
      >
        {items.map((item, idx) => (
          <div
            key={item.label}
            className="flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-[var(--motion-medium)] pointer-events-auto"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <Pressable
              onClick={() => {
                item.action();
                onClose();
              }}
              style={{ backgroundColor: item.color }}
              className="flex h-12 w-12 items-center justify-center rounded-full text-on-accent shadow-lg active:scale-90 transition-transform cursor-pointer"
              aria-label={item.label}
            >
              <span className="text-xl">{item.emoji}</span>
            </Pressable>
            <span className="rounded-lg bg-surface-2/90 border border-border-custom px-2 py-1 text-xs font-black uppercase tracking-wider text-on-accent shadow-md">
              {item.label}
            </span>
          </div>
        ))}
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
      title={active ? 'Zamknij szybkie dodawanie' : 'Otwórz szybkie dodawanie'}
      className="fast-capture-btn"
      style={{ bottom: 'var(--legacy-inline-style-012)' }}
    >
      <div className={`transition-transform duration-[var(--motion-slow)] ${active ? 'rotate-[var(--legacy-arbitrary-030)]' : ''}`}>
        <Plus size={18} strokeWidth={3.5} />
      </div>
    </Fab>
  );
}
