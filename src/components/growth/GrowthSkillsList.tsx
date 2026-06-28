import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Target } from 'lucide-react';
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

function matchLinkToSkill(link: any, skillKey: string): boolean {
  const t = `${link.title || ''} ${link.description || ''} ${link.domain || ''} ${link.category || ''}`.toLowerCase();
  const keywords: Record<string, string[]> = {
    storytelling: ['storytelling', 'histori', 'opowiad', 'pitch', 'narrac'],
    setting: ['setting', 'rozmowa', 'słuchan', 'mirroring', 'pytań', 'mówien', 'pauz'],
    closing: ['closing', 'sprzedaż', 'cena', 'ceny', 'decyzj', 'handlow', 'klient', 'sales'],
    negotiation: ['negocjac', 'ustępstw', 'granic', 'negotiat', 'anchor'],
    voice_presence: ['dykcj', 'artykulac', 'głos', 'wymow', 'intonac', 'oddech', 'tempo', 'korek'],
    social_exposure: ['relacj', 'kontakt', 'poznaw', 'randk', 'kobie', 'dziewczyn', 'social', 'ludzi', 'semen', 'manifesting'],
    deep_work: ['deep work', 'produktyw', 'skup', 'egzekuc', 'prokrastyn', 'czas', 'organizac', 'wasting'],
    body_base: ['sen', 'trening', 'siłown', 'biega', 'ruch', 'diet', 'calories', 'kalori', 'regenerac', 'oura', 'health', 'sleep'],
  };
  const list = keywords[skillKey];
  if (!list) return false;
  return list.some(kw => t.includes(kw));
}

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
  unreadLinks?: any[];
  onQuickPinLink?: (linkId: string, slot: any) => void;
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
          const matchedLinks = unreadLinks.filter(l => matchLinkToSkill(l, row.parent.key));
          
          return (
            <li
              key={row.parent.id}
              className={`rounded-xl border ${
                row.isFocus ? 'border-primary/35 bg-primary/[0.06]' : 'border-border-custom bg-background/40'
              }`}
            >
              <button
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
              {open && (
                <div className="border-t border-border-custom/60 pb-2">
                  {hasSubs && (
                    <ul className="mb-2">
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
                  {matchedLinks.length > 0 && (
                    <div className="mt-2 px-3 pt-2 border-t border-border-custom/30">
                      <p className="text-[9px] font-black uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                        <span>📚 Materiały z Keep</span>
                        <span className="rounded-full bg-primary/10 px-1 py-0.2 text-[8px] font-bold text-primary">{matchedLinks.length}</span>
                      </p>
                      <ul className="space-y-1">
                        {matchedLinks.map((link) => (
                          <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-border-custom bg-background/20 px-2 py-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold text-text-primary truncate" title={link.title}>
                                {link.title || link.domain}
                              </p>
                              <p className="text-[8px] text-text-muted">{link.domain}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1 text-text-muted hover:text-text-primary">
                                <ExternalLink size={10} />
                              </a>
                              {!readOnly && onQuickPinLink && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onQuickPinLink(link.id, 'active'); }}
                                  className="rounded bg-primary/10 px-1.5 py-0.5 text-[8.5px] font-black uppercase text-primary hover:bg-primary/20"
                                >
                                  Przypnij
                                </button>
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
    </section>
  );
}
