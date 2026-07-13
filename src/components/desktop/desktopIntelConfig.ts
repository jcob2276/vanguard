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
      high: 'border-rose-500/30 bg-rose-500/[0.04]',
      medium: 'border-amber-500/30 bg-amber-500/[0.04]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' },
    badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
  },
  pattern: {
    label: 'WZORZEC',
    urgencyMap: {
      high: 'border-rose-500/30 bg-rose-500/[0.04]',
      medium: 'border-amber-500/30 bg-amber-500/[0.04]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-text-muted' },
    badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
  },
  wiki: {
    label: 'WIEDZA',
    urgencyMap: {
      high: 'border-emerald-500/30 bg-emerald-500/[0.04]',
      medium: 'border-emerald-500/20 bg-emerald-500/[0.03]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-emerald-500', medium: 'bg-emerald-400', low: 'bg-emerald-400/50' },
    badge: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
  },
  knowledge: {
    label: 'ZASADA',
    urgencyMap: {
      high: 'border-amber-500/30 bg-amber-500/[0.04]',
      medium: 'border-amber-500/20 bg-amber-500/[0.03]',
      low: 'border-border-custom bg-surface-solid'
    },
    dot: { high: 'bg-amber-500', medium: 'bg-amber-400', low: 'bg-amber-300' },
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
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
