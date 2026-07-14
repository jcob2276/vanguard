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
        className="fixed inset-0 z-35 bg-black/40 backdrop-blur-[2.5px] transition-all animate-fadeIn"
        onClick={onClose}
      />

      {/* Menu overlay */}
      <div
        className="fixed left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-3 transition-all duration-300 pointer-events-none"
        style={{ bottom: 'calc(max(2rem, calc(1rem + env(safe-area-inset-bottom))) + 5.6rem)' }}
      >
        {items.map((item, idx) => (
          <div
            key={item.label}
            className="flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200 pointer-events-auto"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <button
              onClick={() => {
                item.action();
                onClose();
              }}
              style={{ backgroundColor: item.color }}
              className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg active:scale-90 transition-transform cursor-pointer"
            >
              <span className="text-xl">{item.emoji}</span>
            </button>
            <span className="rounded-lg bg-slate-900/90 border border-slate-800 px-2 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md">
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
      className="fast-capture-btn"
      style={{ bottom: 'calc(max(2rem, calc(1rem + env(safe-area-inset-bottom))) + 1.95rem)' }}
    >
      <div className={`transition-transform duration-300 ${active ? 'rotate-[135deg]' : ''}`}>
        <Plus size={18} strokeWidth={3.5} />
      </div>
    </Fab>
  );
}
