import { LIFE_SPHERES } from '../../lib/projects/lifeSpheres';
import Button from '../ui/Button';

interface CategoryPickerProps {
  selected: string | null;
  onSelect: (key: string | null) => void;
}

export default function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: null as string | null, label: 'Brak', dot: 'bg-text-muted/40', border: 'border-border-custom', bgSoft: 'bg-surface-solid' }, ...LIFE_SPHERES].map((cat) => {
        const isSelected = selected === cat.id;
        return (
          <Button
            key={cat.id || 'none'}
            type="button"
            variant="ghost"
            onClick={() => onSelect(cat.id)}
            className={`gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${
              isSelected
                ? cat.id
                  ? `${cat.bgSoft.replace('/8', '/20')} ${cat.border} text-text-primary font-black shadow-sm`
                  : 'bg-text-primary/10 border-text-primary/30 text-text-primary font-black shadow-sm'
                : 'border-border-custom/40 bg-surface-solid/20 text-text-muted hover:text-text-primary'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
            <span>{cat.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
