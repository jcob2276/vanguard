import { Pressable } from '../ui/ControlPrimitives';
import { PILLARS, PILLAR_META, PillarId } from './projectUtils';

type PillarFilter = PillarId | 'all';

interface Props {
  pillarFilter: PillarFilter;
  onChange: (filter: PillarFilter) => void;
}

export function PillarFilterTabs({ pillarFilter, onChange }: Props) {
  return (
    <div className="flex gap-0.5 p-1 rounded-[var(--radius-md)] bg-surface shadow-[var(--legacy-shadow-071)]">
      <Pressable
        onClick={() => onChange('all')}
        className={`flex-1 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
          pillarFilter === 'all'
            ? 'bg-background text-text-primary shadow-sm'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        Wszystko
      </Pressable>
      {PILLARS.map(p => {
        const meta = PILLAR_META[p];
        return (
          <Pressable
            key={p}
            onClick={() => onChange(p)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
              pillarFilter === p
                ? `bg-background shadow-sm ${meta.text}`
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <meta.icon size={10} />
            {meta.label}
          </Pressable>
        );
      })}
    </div>
  );
}
