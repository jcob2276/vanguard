import type { LucideIcon } from 'lucide-react';

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
  return (
    <nav className="fixed left-1/2 z-40 flex w-[90%] max-w-[360px] -translate-x-1/2 items-center justify-between rounded-full border border-border-custom bg-surface/80 p-1.5 shadow-[var(--shadow-nav)] backdrop-blur-xl" style={{ bottom: 'max(2rem, calc(1rem + env(safe-area-inset-bottom)))' }}>
      {/* Sliding background indicator pill */}
      <div 
        className="absolute top-1.5 bottom-1.5 rounded-full nav-pill-active transition-all duration-300"
        style={{
          width: 'calc(20% - 3px)',
          left: (() => {
            const idx = tabOrder.indexOf(view);
            const slotIndex = idx < 2 ? idx : idx + 1;
            return `calc(${slotIndex * 20}% + 1.5px)`;
          })(),
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
      {(() => {
        const elements: React.ReactNode[] = [];
        navItems.forEach((item, idx) => {
          elements.push(
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              disabled={false}
              className={`relative z-10 flex flex-1 flex-col items-center gap-1 rounded-full py-2.5 transition-all duration-300 active:scale-95 cursor-pointer disabled:cursor-default ${
                view === item.id
                  ? 'text-primary font-black'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <div className="relative">
                <item.icon size={16} className={`transition-transform duration-300 ${view === item.id ? 'scale-110' : 'scale-100'}`} />
                {item.id === 'dzis' && urgentTodoCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-black text-white shadow-sm">
                    {urgentTodoCount > 9 ? '9+' : urgentTodoCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
            </button>
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
