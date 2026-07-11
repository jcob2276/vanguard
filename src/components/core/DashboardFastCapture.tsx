import { Plus } from 'lucide-react';

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
      {/* Actions Menu */}
      <div
        className="fixed left-1/2 z-40 flex flex-col items-center gap-2.5 transition-all"
        style={{
          bottom: 'calc(max(2rem, calc(1rem + env(safe-area-inset-bottom))) + 4.5rem)',
          transform: 'translateX(-50%)'
        }}
      >
        {items.map((item, idx) => (
          <button
            key={item.label}
            onClick={() => { onClose(); item.action(); }}
            className={`fast-capture-menu-item flex items-center gap-2.5 px-5 py-3 rounded-full border border-border-custom bg-surface/90 text-[11.5px] font-black uppercase tracking-wider text-text-primary shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer ${item.color.split(' ').slice(1).join(' ')}`}
            style={{
              animation: `fade-in-up 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
              animationDelay: `${idx * 0.04}s`,
              opacity: 0,
              transform: 'translateY(15px)'
            }}
          >
            <span className="text-[13px]">{item.emoji}</span>
            <span>{item.label}</span>
          </button>
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
    <button
      onClick={onToggle}
      className="fast-capture-btn fixed left-1/2 z-50 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-white hover:scale-110 active:scale-95 transition duration-300 cursor-pointer"
      style={{ bottom: 'calc(max(2rem, calc(1rem + env(safe-area-inset-bottom))) + 1.95rem)' }}
    >
      <div className={`transition-transform duration-300 ${active ? 'rotate-[135deg]' : ''}`}>
        <Plus size={18} strokeWidth={3.5} />
      </div>
    </button>
  );
}
