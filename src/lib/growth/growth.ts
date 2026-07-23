import { addWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { pl } from 'date-fns/locale';
import { getTodayWarsaw, formatWarsawDate, shiftDateStr } from '../date';

;

export type GrowthResourceType =
  | 'book'
  | 'video'
  | 'film'
  | 'article'
  | 'podcast'
  | 'exercise';

type GrowthPinSlot = 'must' | 'active';
type GrowthPinEntityType = 'link' | 'todo' | 'manual';

export interface LearningSkill {
  id: string;
  user_id: string;
  key: string;
  label: string;
  sort_order: number;
  active: boolean;
  parent_id: string | null;
}

export interface LearningSkillSnapshot {
  id: string;
  snapshot_date: string;
  scores: Record<string, number>;
}

export interface LearningWeekFocus {
  week_start: string;
  skill_id: string | null;
  subskill_id: string | null;
  why_text: string;
  drill_text: string;
  target_level: number | null;
  rep_target: number | null;
  rep_done: number;
  lateral_challenge: string;
  vertical_challenge: string;
}

export interface LearningWeekPin {
  id: string;
  week_start: string;
  entity_type: GrowthPinEntityType;
  entity_id: string | null;
  manual_title: string | null;
  manual_resource_type: GrowthResourceType | null;
  skill_id: string | null;
  project_id: string | null;
  slot: GrowthPinSlot;
  sort_order: number;
  done: boolean;
  done_at: string | null;
}

export const RESOURCE_TYPE_META: Record<
  GrowthResourceType,
  { label: string; emoji: string }
> = {
  book: { label: 'Książka', emoji: '📖' },
  video: { label: 'Wideo', emoji: '▶' },
  film: { label: 'Film', emoji: '🎬' },
  article: { label: 'Artykuł', emoji: '📄' },
  podcast: { label: 'Podcast', emoji: '🎧' },
  exercise: { label: 'Ćwiczenie', emoji: '🏋' },
};

/** Krótkie rubryki poziomów (devloop-style) — Twoja deklaracja, nie ocena systemu. */
export function computeScoreDeltas(
  skills: LearningSkill[],
  scoresA: Record<string, number>,
  scoresB: Record<string, number>,
): { key: string; label: string; from: number; to: number; delta: number }[] {
  return skills
    .map((s) => {
      const from = scoresA[s.key] ?? 0;
      const to = scoresB[s.key] ?? 0;
      return { key: s.key, label: s.label, from, to, delta: to - from };
    })
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function getWeekStartWarsaw(from?: string | Date): string {
  const todayStr =
    typeof from === 'string'
      ? from.slice(0, 10)
      : formatWarsawDate(from ?? new Date());
  const d = new Date(todayStr + 'T12:00:00Z');
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  const d = new Date(`${weekStart.slice(0, 10)}T12:00:00Z`);
  const next = deltaWeeks >= 0 ? addWeeks(d, deltaWeeks) : subWeeks(d, Math.abs(deltaWeeks));
  return format(startOfWeek(next, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart.slice(0, 10)}T12:00:00Z`);
  const end = new Date(shiftDateStr(weekStart, 6) + 'T12:00:00Z');
  const a = format(start, 'd MMM', { locale: pl });
  const b = format(end, 'd MMM', { locale: pl });
  return `${a} – ${b}`;
}

export function isCurrentWeek(weekStart: string): boolean {
  return weekStart === getWeekStartWarsaw(getTodayWarsaw());
}

export function inferResourceType(url: string, domain: string): GrowthResourceType {
  const d = (domain || url || '').toLowerCase();
  if (d.includes('youtube') || d.includes('youtu.be')) return 'video';
  if (d.includes('spotify') || d.includes('podcast')) return 'podcast';
  if (d.includes('netflix') || d.includes('film')) return 'film';
  return 'article';
}

export function partitionSkillTree(skills: LearningSkill[]) {
  const parents = skills.filter((s) => !s.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const childrenByParentId = new Map<string, LearningSkill[]>();
  for (const s of skills) {
    if (!s.parent_id) continue;
    const list = childrenByParentId.get(s.parent_id) ?? [];
    list.push(s);
    childrenByParentId.set(s.parent_id, list);
  }
  for (const list of childrenByParentId.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }
  return { parents, childrenByParentId };
}

export function scoresFromSnapshot(
  skills: LearningSkill[],
  snapshot: LearningSkillSnapshot | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of skills) {
    out[s.key] = snapshot?.scores?.[s.key] ?? 0;
  }
  return out;
}

export interface SkillMatchLink {
  title?: string | null;
  description?: string | null;
  domain?: string | null;
  category?: string | null;
}

export function matchLinkToSkill(link: SkillMatchLink, skillKey: string): boolean {
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
