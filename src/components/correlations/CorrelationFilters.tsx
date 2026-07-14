import { BarChart2, Coffee, Moon, Dumbbell, Brain, Activity, Pill, Smartphone } from 'lucide-react';
import type { CorrelationCategory } from '@vanguard/domain';
import Button from '../ui/Button';

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
          <Button
            key={f.id}
            variant={active ? 'primary' : 'outline'}
            onClick={() => setFilter(f.id)}
            className="gap-1.5 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-none hover:translate-y-0"
            icon={<Icon size={11} />}
          >
            {f.label}
          </Button>
        );
      })}
    </div>
  );
}
