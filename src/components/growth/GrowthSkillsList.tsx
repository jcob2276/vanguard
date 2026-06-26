import { useState } from 'react';
import { ChevronDown, ChevronRight, Target } from 'lucide-react';
import type { SkillInventoryRow } from '../../lib/growthOverview';

function scoreBar(val: number) {
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-full bg-border-custom overflow-hidden">
        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
      </div>
      <span className="text-[11px] font-black text-primary tabular-nums w-8 text-right">{val}/5</span>
    </div>
  );
}

export default function GrowthSkillsList({
  rows,
  onEditScores,
  readOnly,
}: {
  rows: SkillInventoryRow[];
  onEditScores?: () => void;
  readOnly: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border-custom p-4">
        <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Umiejętności</p>
        <p className="text-[12px] text-text-muted mt-2">Brak skilli — przywróć domyślne drzewo.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border-custom bg-surface/30 p-4 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Umiejętności</p>
          <p className="text-[10px] text-text-muted mt-0.5">Twoja ocena 0–5 · pod-skilli po rozwinięciu</p>
        </div>
        {!readOnly && onEditScores && (
          <button
            type="button"
            onClick={onEditScores}
            className="shrink-0 text-[9px] font-black uppercase text-primary hover:underline cursor-pointer"
          >
            Oceń →
          </button>
        )}
      </div>

      <ul className="space-y-1.5 flex-1 overflow-y-auto max-h-[520px] pr-1">
        {rows.map((row) => {
          const open = expanded.has(row.parent.id);
          const hasSubs = row.subskills.length > 0;
          return (
            <li
              key={row.parent.id}
              className={`rounded-xl border ${
                row.isFocus ? 'border-primary/35 bg-primary/[0.06]' : 'border-border-custom bg-background/40'
              }`}
            >
              <button
                type="button"
                onClick={() => hasSubs && toggle(row.parent.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${hasSubs ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {hasSubs ? (
                  open ? (
                    <ChevronDown size={14} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-text-muted shrink-0" />
                  )
                ) : (
                  <span className="w-[14px] shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-text-primary truncate">{row.parent.label}</span>
                    {row.isFocus && (
                      <Target size={11} className="text-primary shrink-0" aria-label="Focus tygodnia" />
                    )}
                  </span>
                </span>
                {scoreBar(row.parentScore)}
              </button>
              {open && hasSubs && (
                <ul className="border-t border-border-custom/60 pb-2">
                  {row.subskills.map((sub) => (
                    <li
                      key={sub.skill.id}
                      className="flex items-center gap-2 px-3 py-2 pl-9 border-b border-border-custom/30 last:border-0"
                    >
                      <span className="flex-1 text-[11px] font-semibold text-text-secondary truncate">
                        {sub.skill.label}
                      </span>
                      {scoreBar(sub.score)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
