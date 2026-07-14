import type { IntelCard } from './desktopDataTypes';

export const INTEL_CFG: Record<
  string,
  {
    label: string;
    urgencyMap: Record<string, string>;
    dot: Record<string, string>;
    badge: string;
  }
> = {
  data: {
    label: 'DANE',
    urgencyMap: {
      high: 'border-danger/30 bg-danger/[0.04]',
      medium: 'border-warning/30 bg-warning/[0.04]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-danger', medium: 'bg-warning', low: 'bg-text-muted' },
    badge: 'text-primary bg-primary/10 border-primary/20'
  },
  pattern: {
    label: 'WZORZEC',
    urgencyMap: {
      high: 'border-danger/30 bg-danger/[0.04]',
      medium: 'border-warning/30 bg-warning/[0.04]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-danger', medium: 'bg-warning', low: 'bg-text-muted' },
    badge: 'text-danger bg-danger/10 border-danger/20'
  },
  wiki: {
    label: 'WIEDZA',
    urgencyMap: {
      high: 'border-success/30 bg-success/[0.04]',
      medium: 'border-success/20 bg-success/[0.03]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-success', medium: 'bg-success', low: 'bg-success/50' },
    badge: 'text-success bg-success/10 border-success/20'
  },
  knowledge: {
    label: 'ZASADA',
    urgencyMap: {
      high: 'border-warning/30 bg-warning/[0.04]',
      medium: 'border-warning/20 bg-warning/[0.03]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-warning', medium: 'bg-warning', low: 'bg-warning' },
    badge: 'text-warning bg-warning/10 border-warning/20'
  }
};

const LOW_VALUE_INTEL_TYPES = new Set(['person', 'source_summary', 'operating_model', 'lesson', 'osoba']);
const LOW_VALUE_INTEL_TITLES = new Set([
  'jakub',
  'poprawka użytkownika',
  'aktualny snapshot operacyjny',
  'aktualne tematy ze streamu'
]);
const LOW_VALUE_INTEL_TEXT = [
  'osoba analizowana',
  'poprawka:',
  'desktop footprint',
  'aktualny model operacyjny składa się',
  'najmocniejszy sygnał:',
  'content:',
  'category:'
];

export function cleanIntelText(value: string | null | undefined, max = 260) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

export function isUsefulIntelCard(card: IntelCard) {
  const headline = String(card.headline || '').trim().toLowerCase();
  const evidence = String(card.evidence || '').trim().toLowerCase();
  const meta = String(card.meta || '').trim().toLowerCase();
  if (!headline || headline.length < 4) return false;
  if (LOW_VALUE_INTEL_TYPES.has(meta)) return false;
  if (LOW_VALUE_INTEL_TITLES.has(headline)) return false;
  if (LOW_VALUE_INTEL_TEXT.some(marker => evidence.includes(marker))) return false;
  if (card.type === 'pattern' && (card.count || 0) < 2) return false;
  if ((card.type === 'wiki' || card.type === 'knowledge') && cleanIntelText(card.evidence).length < 40) return false;
  return true;
}

export function intelScore(card: IntelCard) {
  const urgencyScore = card.urgency === 'high' ? 30 : card.urgency === 'medium' ? 15 : 0;
  const typeScore = card.type === 'data' ? 80 : card.type === 'pattern' ? 55 : card.type === 'knowledge' ? 25 : 15;
  const countScore = Math.min((card.count || 0) * 4, 20);
  const importanceScore = Math.min(card.importance || 0, 10);
  return typeScore + urgencyScore + countScore + importanceScore;
}
