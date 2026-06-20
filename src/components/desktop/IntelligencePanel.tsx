import React from 'react';
import { INTEL_CFG, cleanIntelText, isUsefulIntelCard, intelScore, computeNarrativeInsights } from './desktopUtils';
import { Panel } from './Panel';

export interface IntelligencePanelProps {
  oura: any[];
  sessions: any[];
  nutrition: any[];
  wins: any[];
  patterns: any[];
  wiki: any[];
  knowledge: any[];
}

export default function IntelligencePanel({
  oura,
  sessions,
  nutrition,
  wins,
  patterns,
  wiki,
  knowledge
}: IntelligencePanelProps) {
  const dataInsights = computeNarrativeInsights(oura, sessions, nutrition, wins);

  const cards: any[] = [
    ...dataInsights.map(i => ({ ...i, type: 'data' })),
    ...(patterns || []).map((p: any) => ({
      type: 'pattern',
      urgency: (p.confidence || 0) >= 0.7 ? 'high' : 'medium',
      headline: p.title,
      evidence: p.evidence_text,
      meta: `${p.occurrence_count}× · ${p.last_seen || ''}`
    })),
    ...(wiki || [])
      .filter((w: any) => w.summary)
      .map((w: any) => ({
        type: 'wiki',
        urgency: 'medium',
        headline: w.title,
        evidence: w.summary,
        meta: w.page_type
      })),
    ...(knowledge || []).map((k: any) => ({
      type: 'knowledge',
      urgency: (k.importance_score || 0) >= 9 ? 'high' : 'medium',
      headline: k.title,
      evidence: k.content,
      meta: k.category
    }))
  ];

  const visibleCards = cards
    .map(card => ({
      ...card,
      headline: cleanIntelText(card.headline, 120),
      evidence: cleanIntelText(card.evidence),
      count: card.count ?? Number(String(card.meta || '').match(/\d+/)?.[0] || 0),
      importance: card.importance ?? card.importance_score ?? 0
    }))
    .filter(isUsefulIntelCard)
    .sort((a, b) => intelScore(b) - intelScore(a))
    .slice(0, 6);

  if (!visibleCards.length) {
    return (
      <Panel title="Intelligence — za mało danych">
        <p className="text-[11px] text-text-muted text-center py-8">Wnioski pojawią się po kilku tygodniach danych.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Intelligence — co powinieneś wiedzieć">
      <div className="grid grid-cols-3 gap-3">
        {visibleCards.map((card, i) => {
          const cfg = INTEL_CFG[card.type] || INTEL_CFG.data;
          const urgency = card.urgency || 'medium';
          return (
            <div key={i} className={`rounded-[16px] border px-4 py-4 flex flex-col gap-2 ${cfg.urgencyMap[urgency]}`}>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot[urgency]}`} />
                <span
                  className={`text-[7px] font-black uppercase tracking-[0.2em] border rounded-md px-1.5 py-0.5 ${cfg.badge}`}
                >
                  {cfg.label}
                </span>
                {card.meta && <span className="text-[7px] text-text-muted ml-auto truncate max-w-[100px]">{card.meta}</span>}
              </div>
              <p className="text-[13px] font-bold text-text-primary leading-snug">{card.headline}</p>
              {card.evidence && (
                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-4">{card.evidence}</p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
