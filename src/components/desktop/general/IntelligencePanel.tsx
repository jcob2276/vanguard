import React from 'react';
import { INTEL_CFG, cleanIntelText, isUsefulIntelCard, intelScore, computeNarrativeInsights, type OuraRow, type WorkoutSessionSummary, type NutritionDayRow, type IntelCard } from '../desktopUtils';
import { Panel } from '../shell/Panel';
import { Card } from '../../ui/Card';

export interface PatternRow {
  confidence?: number | null;
  title: string;
  evidence_text?: string | null;
  occurrence_count?: number | null;
  last_seen?: string | null;
}

export interface WikiRow {
  summary?: string | null;
  title: string;
  page_type?: string | null;
}

export interface KnowledgeRow {
  importance_score?: number | null;
  title: string;
  content?: string | null;
  category?: string | null;
}

export interface IntelligencePanelProps {
  oura: OuraRow[];
  sessions: WorkoutSessionSummary[];
  nutrition: NutritionDayRow[];
  patterns: PatternRow[];
  wiki: WikiRow[];
  knowledge: KnowledgeRow[];
}

export default function IntelligencePanel({
  oura,
  sessions,
  nutrition,
  patterns,
  wiki,
  knowledge
}: IntelligencePanelProps) {
  const dataInsights = computeNarrativeInsights(oura, sessions, nutrition);

  const cards: IntelCard[] = [
    ...dataInsights.map((i) => ({ ...i, type: 'data' as const })),
    ...(patterns || []).map((p) => ({
      type: 'pattern' as const,
      urgency: ((p.confidence || 0) >= 0.7 ? 'high' : 'medium') as 'high' | 'medium',
      headline: p.title,
      evidence: p.evidence_text,
      meta: `${p.occurrence_count}× · ${p.last_seen || ''}`
    })),
    ...(wiki || [])
      .filter((w) => w.summary)
      .map((w) => ({
        type: 'wiki' as const,
        urgency: 'medium' as const,
        headline: w.title,
        evidence: w.summary,
        meta: w.page_type
      })),
    ...(knowledge || []).map((k) => ({
      type: 'knowledge' as const,
      urgency: ((k.importance_score || 0) >= 9 ? 'high' : 'medium') as 'high' | 'medium',
      headline: k.title,
      evidence: k.content,
      meta: k.category
    }))
  ];

  const visibleCards = cards
    .map((card) => ({
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
        <p className="text-xs text-text-muted text-center py-8">Wnioski pojawią się po kilku tygodniach danych.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Intelligence — co powinieneś wiedzieć">
      <div className="grid grid-cols-3 gap-3">
        {visibleCards.map((card, index) => {
          const cfg = INTEL_CFG[card.type] || INTEL_CFG.data;
          const urgency = card.urgency || 'medium';
          return (
            <Card key={`${card.type}-${card.headline}-${index}`} variant="surface" padding="1rem" className={`flex flex-col gap-2 ${cfg.urgencyMap[urgency]}`}>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot[urgency]}`} />
                <span
                  className={`text-3xs font-black uppercase tracking-[var(--ds-arbitrary-0-2em)] border rounded-md px-1.5 py-0.5 ${cfg.badge}`}
                >
                  {cfg.label}
                </span>
                {card.meta && <span className="text-3xs text-text-muted ml-auto truncate max-w-[var(--ds-maxw-100px)]">{card.meta}</span>}
              </div>
              <p className="text-sm font-bold text-text-primary leading-snug">{card.headline}</p>
              {card.evidence && (
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-4">{card.evidence}</p>
              )}
            </Card>
          );
        })}
      </div>
    </Panel>
  );
}
