import { Pressable } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Target } from 'lucide-react';
import type { SkillInventoryRow } from '../../lib/growth/growthOverview';
import { Card } from '../ui/Card';

function scoreBar(val: number) {
  return (
    <div className="flex items-center gap-2 min-w-[var(--ds-w-72px)]">
      <div className="flex-1 h-1.5 rounded-full bg-border-custom overflow-hidden">
        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
      </div>
      <span className="text-xs font-black text-primary tabular-nums w-8 text-right">{val}/5</span>
    </div>
  );
}

import { matchLinkToSkill, type GrowthPinSlot } from '../../lib/growth/growth';
import type { GrowthLinkRow } from './hooks/useGrowthData';

export default function GrowthSkillsList({
  rows,
  onEditScores,
  readOnly,
  unreadLinks = [],
  onQuickPinLink,
}: {
  rows: SkillInventoryRow[];
  onEditScores?: () => void;
  readOnly: boolean;
  unreadLinks?: GrowthLinkRow[];
  onQuickPinLink?: (linkId: string, slot: GrowthPinSlot) => void;
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
        <p className="text-2xs font-black uppercase tracking-wider text-text-muted">Umiejętności</p>
        <p className="text-sm text-text-muted mt-2">Brak skilli — przywróć domyślne drzewo.</p>
      </section>
    );
  }

  return (
    <Card variant="surface" padding="1rem" className="h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-2xs font-black uppercase tracking-wider text-text-muted">Umiejętności</p>
          <p className="text-xs text-text-muted mt-0.5">Twoja ocena 0–5 · pod-skilli po rozwinięciu</p>
        </div>
        {!readOnly && onEditScores && (
          <Pressable
            type="button"
            onClick={onEditScores}
            variant="ghost"
            size="sm"
            className="shrink-0 text-2xs font-black uppercase text-primary hover:underline"
          >
            Oceń →
          </Pressable>
        )}
      </div>

      <ul className="space-y-1.5 flex-1 overflow-y-auto max-h-[var(--ds-h-520px)] pr-1">
        {rows.map((row) => {
          const open = expanded.has(row.parent.id);
          const hasSubs = row.subskills.length > 0;
          const matchedLinks = unreadLinks.filter(l => matchLinkToSkill(l, row.parent.key));

          return (
            <li
              key={row.parent.id}
              className={`rounded-xl border ${
                row.isFocus ? 'border-primary/35 bg-primary/[0.06]' : 'border-border-custom bg-background/40'
              }`}
            >
              <Pressable
                type="button"
                onClick={() => (hasSubs || matchedLinks.length > 0) && toggle(row.parent.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${(hasSubs || matchedLinks.length > 0) ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {(hasSubs || matchedLinks.length > 0) ? (
                  open ? (
                    <ChevronDown size={14} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-text-muted shrink-0" />
                  )
                ) : (
                  <span className="w-[var(--ds-w-14px)] shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-text-primary truncate">{row.parent.label}</span>
                    {row.isFocus && (
                      <Target size={11} className="text-primary shrink-0" aria-label="Focus tygodnia" />
                    )}
                  </span>
                </span>
                {scoreBar(row.parentScore)}
              </Pressable>
              {open && (
                <div className="border-t border-border-custom/60 pb-2">
                  {hasSubs && (
                    <ul className="mb-2">
                      {row.subskills.map((sub) => (
                        <li
                          key={sub.skill.id}
                          className="flex items-center gap-2 px-3 py-2 pl-9 border-b border-border-custom/30 last:border-0"
                        >
                          <span className="flex-1 text-xs font-semibold text-text-secondary truncate">
                            {sub.skill.label}
                          </span>
                          {scoreBar(sub.score)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {matchedLinks.length > 0 && (
                    <div className="mt-2 px-3 pt-2 border-t border-border-custom/30">
                      <p className="text-2xs font-black uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                        <span>📚 Materiały z Keep</span>
                        <span className="rounded-full bg-primary/10 px-1 py-0.2 text-2xs font-bold text-primary">{matchedLinks.length}</span>
                      </p>
                      <ul className="space-y-1">
                        {matchedLinks.map((link) => (
                          <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-border-custom bg-background/20 px-2 py-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-text-primary truncate" title={link.title}>
                                {link.title || link.domain}
                              </p>
                              <p className="text-2xs text-text-muted">{link.domain}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1 text-text-muted hover:text-text-primary">
                                <ExternalLink size={12} />
                              </a>
                              {!readOnly && onQuickPinLink && (
                                <Pressable
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onQuickPinLink(link.id, 'active'); }}
                                  variant="tonal"
                                  size="sm"
                                  className="rounded px-1.5 py-0.5 text-2xs font-black uppercase"
                                >
                                  Przypnij
                                </Pressable>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
