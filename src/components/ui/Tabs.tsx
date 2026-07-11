interface Tab {
  key: string;
  label: string;
}

export interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function Tabs({ tabs, active, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 p-1 rounded-xl bg-surface-solid/50 border border-border-custom/40 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2 rounded-lg transition-all cursor-pointer ${
            active === tab.key
              ? 'bg-background text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
