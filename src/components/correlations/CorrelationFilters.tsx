import { BarChart2, Coffee, Moon, Dumbbell, Brain, Activity, Pill, Smartphone } from 'lucide-react';
import type { CorrelationCategory } from '@vanguard/domain';

const FILTERS: { id: CorrelationCategory | 'all'; icon: typeof Moon; label: string }[] = [
  { id: 'all', icon: BarChart2, label: 'Wszystkie' },
  { id: 'zywienie', icon: Coffee, label: 'Jedzenie' },
  { id: 'sen', icon: Moon, label: 'Sen' },
  { id: 'trening', icon: Dumbbell, label: 'Trening' },
  { id: 'regeneracja', icon: Activity, label: 'Regeneracja' },
  { id: 'zachowanie', icon: Brain, label: 'Zachowanie' },
  { id: 'suplementy', icon: Pill, label: 'Suplementy' },
  { id: 'ekran', icon: Smartphone, label: 'Ekran' },
];

interface CorrelationFiltersProps {
  filter: CorrelationCategory | 'all';
  setFilter: (id: CorrelationCategory | 'all') => void;
}

export default function CorrelationFilters({ filter, setFilter }: CorrelationFiltersProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTERS.map(f => {
        const Icon = f.icon;
        const active = filter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${
              active
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface border border-border-custom text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon size={11} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
