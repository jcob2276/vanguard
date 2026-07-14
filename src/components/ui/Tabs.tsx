import { ReactNode } from 'react';

interface Tab {
  key: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function Tabs({ tabs, active, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] py-2 text-xs font-bold transition-[transform,background-color,color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-97 cursor-pointer ${
            active === tab.key
              ? 'bg-surface-tonal text-primary shadow-sm'
              : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
          }`}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
