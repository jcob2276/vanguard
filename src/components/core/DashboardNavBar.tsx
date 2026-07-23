import Button from '../ui/Button';
import type { LucideIcon } from 'lucide-react';
import Badge from '../ui/Badge';
import { motion } from 'framer-motion';
import { IOS_SPRING } from '../../lib/motion/iosMotion';
import { useHaptics } from '../../hooks/useHaptics';

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
}

interface DashboardNavBarProps {
  view: string;
  navigateTo: (dest: string) => void;
  urgentTodoCount: number;
  navItems: NavItem[];
  tabOrder: string[];
}

export function DashboardNavBar({
  view,
  navigateTo,
  urgentTodoCount,
  navItems,
  tabOrder,
}: DashboardNavBarProps) {
  const haptics = useHaptics();

  return (
    <nav className="fixed left-1/2 z-[var(--z-modal)] flex w-[var(--ds-w-90)] max-w-[var(--ds-maxw-360px)] -translate-x-1/2 items-center justify-between rounded-full border border-border-custom bg-surface/75 p-1.5 shadow-[var(--shadow-nav)] glass-structural" style={{ bottom: 'var(--ds-inline-style-max-2rem-calc-1rem-env-safe-area-inset-bottom)' }}>
      {/* Sliding background indicator pill */}
      <motion.div
        className="absolute top-1.5 bottom-1.5 rounded-full nav-pill-active"
        animate={{
          left: (() => {
            const idx = tabOrder.indexOf(view);
            const slotIndex = idx < 2 ? idx : idx + 1;
            return `calc(${slotIndex * 20}% + 1.5px)`;
          })(),
        }}
        transition={IOS_SPRING.interactive}
        style={{
          width: 'var(--ds-inline-style-calc-20-3px)',
        }}
      />
      {(() => {
        const elements: React.ReactNode[] = [];
        navItems.forEach((item, idx) => {
          elements.push(
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => {
                if (view !== item.id) haptics.selection();
                navigateTo(item.id);
              }}
              disabled={false}
              className={`relative z-[var(--z-raised)] flex flex-1 flex-col items-center gap-1 rounded-full py-2.5 px-0 min-w-0 h-auto transition-all duration-[var(--motion-slow)] active:scale-95 hover:bg-transparent disabled:cursor-default ${
                view === item.id
                  ? 'text-primary font-black'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <div className="relative">
                <item.icon size={16} className={`transition-transform duration-[var(--motion-slow)] ${view === item.id ? 'scale-110' : 'scale-100'}`} />
                {item.id === 'dzis' && urgentTodoCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 shadow-sm">
                    <Badge count={urgentTodoCount} color="var(--color-danger)" />
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold">{item.label}</span>
            </Button>
          );

          if (idx === 1) {
            elements.push(
              <div key="fab-slot" className="relative flex-1 flex items-center justify-center h-full" />
            );
          }
        });
        return elements;
      })()}
    </nav>
  );
}
