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
  tabOrder: _tabOrder,
}: DashboardNavBarProps) {
  const haptics = useHaptics();

  return (
    <nav
      className="fixed left-1/2 z-[var(--z-modal)] flex w-[92%] max-w-[380px] -translate-x-1/2 items-center justify-between p-1.5 ios-pill-nav"
      style={{ bottom: 'max(14px, env(safe-area-inset-bottom))' }}
    >
      {(() => {
        const elements: React.ReactNode[] = [];
        navItems.forEach((item, idx) => {
          const isActive = view === item.id;
          elements.push(
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => {
                if (!isActive) haptics.selection();
                navigateTo(item.id);
              }}
              className={`relative z-10 flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 px-0 min-w-0 h-auto transition-transform active:scale-95 hover:bg-transparent ${
                isActive ? 'text-text-primary font-bold' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/15 shadow-sm -z-10 border border-black/10 dark:border-white/10"
                  transition={IOS_SPRING.interactive}
                />
              )}
              <div className="relative">
                <item.icon size={18} className={`transition-transform ${isActive ? 'scale-110 text-primary' : 'scale-100 opacity-70'}`} />
                {item.id === 'dzis' && urgentTodoCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 shadow-sm">
                    <Badge count={urgentTodoCount} color="var(--color-danger)" />
                  </span>
                )}
              </div>
              <span className="text-3xs font-semibold tracking-tight">{item.label}</span>
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

