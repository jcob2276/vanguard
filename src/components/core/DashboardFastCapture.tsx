import { Pressable } from '../ui/ControlPrimitives';
import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Fab from '../ui/Fab';
import Sheet from '../ui/Sheet';
import { useHaptics } from '../../hooks/useHaptics';

interface FastCaptureItem {
  label: string;
  emoji: string;
  color: string;
  icon?: LucideIcon;
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
  const { selection } = useHaptics();

  const run = (action: () => void) => {
    selection();
    action();
    onClose();
  };

  const itemStyles: Record<string, string> = {
    'Dodaj Jedzenie': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'Zaloguj Trening': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    'Zaloguj Saunę': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    'Zmierz Wzrok': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  };

  return (
    <Sheet
      open={show}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="bottom"
      title="Szybkie akcje"
    >
      <div className="mx-auto max-w-md space-y-5 pb-4">
        {/* Szybkie dodawanie */}
        <div>
          <p className="ios-section-label mb-2 px-1">Dodaj wpis</p>
          <div className="grid grid-cols-4 gap-2.5">
            {items.map(({ label, icon: Icon, action }) => {
              const style = itemStyles[label] || 'bg-black/5 dark:bg-white/5 text-primary border-black/8 dark:border-white/10';
              return (
                <Pressable
                  key={label}
                  variant="ghost"
                  onClick={() => run(action)}
                  className="flex flex-col items-center gap-2 rounded-2xl p-2.5 text-center active:scale-95 transition-transform"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm ${style}`}>
                    {Icon ? <Icon size={22} /> : <Plus size={22} />}
                  </div>
                  <span className="text-2xs font-semibold tracking-tight text-text-primary line-clamp-2">{label}</span>
                </Pressable>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-black/8 dark:bg-white/10" />

        {/* Narzędzia */}
        <div>
          <p className="ios-section-label mb-2 px-1">Narzędzia</p>
          <div className="grid grid-cols-4 gap-2.5">
            {tools.map(({ label, icon: Icon, action }) => (
              <Pressable
                key={label}
                variant="ghost"
                onClick={() => run(action)}
                className="flex flex-col items-center gap-2 rounded-2xl p-2.5 text-center active:scale-95 transition-transform"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/8 dark:border-white/10 bg-black/5 dark:bg-white/5 text-text-primary shadow-sm">
                  <Icon size={20} />
                </div>
                <span className="text-2xs font-semibold tracking-tight text-text-primary truncate w-full">{label}</span>

              </Pressable>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

interface FabProps {
  active: boolean;
  onToggle: () => void;
}

export function DashboardFastCaptureFAB({ active, onToggle }: FabProps) {
  const { selection } = useHaptics();
  if (active) return null;

  return (
    <Fab
      position="bottom-center"
      size="sm"
      onClick={() => {
        selection();
        onToggle();
      }}
      title="Otwórz akcje i narzędzia"
      className="fast-capture-btn shadow-lg"
      style={{ bottom: 'max(24px, env(safe-area-inset-bottom))' }}
    >
      <Plus size={20} strokeWidth={2.5} />
    </Fab>
  );
}


