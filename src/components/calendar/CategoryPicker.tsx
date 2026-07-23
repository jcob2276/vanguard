import React from 'react';
import { LIFE_SPHERES } from '../../lib/projects/lifeSpheres';
import { Pressable } from '../ui/ControlPrimitives';

interface CategoryPickerProps {
  selected: string | null;
  onSelect: (key: string | null) => void;
}

export default function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: null as string | null, label: 'Brak', dot: 'bg-text-muted/40' }, ...LIFE_SPHERES].map((cat) => {
        const isSelected = selected === cat.id;
        return (
          <Pressable
            key={cat.id || 'none'}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all duration-[var(--motion-fast)] select-none ${
              isSelected
                ? cat.id
                  ? 'bg-primary/15 border-primary/40 text-text-primary shadow-sm font-black'
                  : 'bg-text-primary/15 border-text-primary/30 text-text-primary font-black shadow-sm'
                : 'border-border-custom/30 bg-surface-solid/40 text-text-muted hover:text-text-primary hover:border-border-custom/60'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${cat.dot}`} />
            <span>{cat.label}</span>
          </Pressable>
        );
      })}
    </div>
  );
}
