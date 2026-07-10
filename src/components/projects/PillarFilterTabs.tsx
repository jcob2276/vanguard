import { PILLARS, PILLAR_META, PillarId } from './projectUtils';

type PillarFilter = PillarId | 'all';

interface Props {
  pillarFilter: PillarFilter;
  onChange: (filter: PillarFilter) => void;
}

export function PillarFilterTabs({ pillarFilter, onChange }: Props) {
  return (
    <div className="flex gap-0.5 p-1 rounded-[14px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <button
        onClick={() => onChange('all')}
        className={`flex-1 py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
          pillarFilter === 'all'
            ? 'bg-background text-text-primary shadow-sm'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        Wszystko
      </button>
      {PILLARS.map(p => {
        const meta = PILLAR_META[p];
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold rounded-[10px] transition-all ${
              pillarFilter === p
                ? `bg-background shadow-sm ${meta.text}`
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <meta.icon size={10} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
