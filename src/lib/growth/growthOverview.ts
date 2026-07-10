import type { GrowthLinkRow, GrowthWeekNote } from './growth.types';
import type { LearningSkill, LearningWeekFocus, LearningWeekPin } from './growth';
import { computeScoreDeltas, inferResourceType, RESOURCE_TYPE_META, type GrowthResourceType } from './growth';
import { suggestWeakestSubskillId } from './growthMastery';


export type FocusProposal = {
  parentId: string;
  parentLabel: string;
  subskillId: string | null;
  subskillLabel: string | null;
  score: number;
  source: 'saved' | 'computed';
};

export function deriveFocusProposal(
  parents: LearningSkill[],
  childrenByParentId: Map<string, LearningSkill[]>,
  scores: Record<string, number>,
  focus: LearningWeekFocus | null,
  skillsById: Map<string, LearningSkill>,
): FocusProposal | null {
  if (parents.length === 0) return null;

  if (focus?.skill_id) {
    const parent = skillsById.get(focus.skill_id) ?? parents.find((p) => p.id === focus.skill_id);
    if (parent) {
      const sub = focus.subskill_id ? skillsById.get(focus.subskill_id) : null;
      const score = sub ? scores[sub.key] ?? 0 : scores[parent.key] ?? 0;
      return {
        parentId: parent.id,
        parentLabel: parent.label,
        subskillId: sub?.id ?? null,
        subskillLabel: sub?.label ?? null,
        score,
        source: 'saved',
      };
    }
  }

  let bestParent = parents[0];
  let bestSubId = suggestWeakestSubskillId(bestParent.id, childrenByParentId, scores);
  let bestScore = -1;

  for (const parent of parents) {
    const subId = suggestWeakestSubskillId(parent.id, childrenByParentId, scores);
    const sub = subId ? childrenByParentId.get(parent.id)?.find((s) => s.id === subId) : null;
    const score = sub ? scores[sub.key] ?? 0 : scores[parent.key] ?? 0;
    if (bestScore < 0 || score < bestScore) {
      bestScore = score;
      bestParent = parent;
      bestSubId = subId;
    }
  }

  const sub = bestSubId
    ? childrenByParentId.get(bestParent.id)?.find((s) => s.id === bestSubId)
    : null;

  return {
    parentId: bestParent.id,
    parentLabel: bestParent.label,
    subskillId: sub?.id ?? null,
    subskillLabel: sub?.label ?? null,
    score: bestScore >= 0 ? bestScore : scores[bestParent.key] ?? 0,
    source: 'computed',
  };
}



export type SkillInventoryRow = {
  parent: LearningSkill;
  parentScore: number;
  subskills: { skill: LearningSkill; score: number }[];
  isFocus: boolean;
};

export type LearningNeedItem = {
  label: string;
  score: number;
  target: number | null;
  kind: 'focus' | 'weak';
};

export type WeekLearningItem = {
  id: string;
  kind: 'pin' | 'note' | 'link' | 'score';
  label: string;
  detail?: string;
};

export function buildSkillInventory(
  parents: LearningSkill[],
  childrenByParentId: Map<string, LearningSkill[]>,
  scores: Record<string, number>,
  focusParentId: string | null,
): SkillInventoryRow[] {
  return parents
    .map((parent) => ({
      parent,
      parentScore: scores[parent.key] ?? 0,
      subskills: (childrenByParentId.get(parent.id) ?? []).map((s) => ({
        skill: s,
        score: scores[s.key] ?? 0,
      })),
      isFocus: parent.id === focusParentId,
    }))
    .sort((a, b) => a.parentScore - b.parentScore);
}

export function buildLearningNeed(
  focusProposal: FocusProposal | null,
  focus: LearningWeekFocus | null,
  parents: LearningSkill[],
  childrenByParentId: Map<string, LearningSkill[]>,
  scores: Record<string, number>,
): { primary: LearningNeedItem | null; alsoWeak: LearningNeedItem[]; drill: string | null } {
  const target = focus?.target_level ?? 3;
  const drill = focus?.drill_text?.trim() || null;

  let primary: LearningNeedItem | null = null;
  if (focusProposal) {
    primary = {
      label: focusProposal.subskillLabel
        ? `${focusProposal.parentLabel} → ${focusProposal.subskillLabel}`
        : focusProposal.parentLabel,
      score: focusProposal.score,
      target,
      kind: 'focus',
    };
  }

  const alsoWeak: LearningNeedItem[] = [];
  for (const parent of parents) {
    for (const sub of childrenByParentId.get(parent.id) ?? []) {
      const score = scores[sub.key] ?? 0;
      if (score >= 3) continue;
      if (focusProposal?.subskillId === sub.id) continue;
      alsoWeak.push({
        label: `${parent.label} → ${sub.label}`,
        score,
        target: 3,
        kind: 'weak',
      });
    }
  }
  alsoWeak.sort((a, b) => a.score - b.score);

  return { primary, alsoWeak: alsoWeak.slice(0, 4), drill };
}

export function buildWeekLearningLog(input: {
  pins: LearningWeekPin[];
  resolvePinTitle: (pin: LearningWeekPin) => string;
  weekNotes: GrowthWeekNote[];
  readLinksThisWeek: GrowthLinkRow[];
  snapshots: { snapshot_date: string; scores: Record<string, number> }[];
  skills: LearningSkill[];
  weekStart: string;
  weekEnd: string;
}): WeekLearningItem[] {
  const items: WeekLearningItem[] = [];

  for (const pin of input.pins.filter((p) => p.done)) {
    items.push({
      id: `pin-${pin.id}`,
      kind: 'pin',
      label: input.resolvePinTitle(pin),
      detail: pin.slot === 'must' ? 'MUST' : 'W toku',
    });
  }

  for (const note of input.weekNotes) {
    items.push({
      id: `note-${note.id}`,
      kind: 'note',
      label: note.title,
      detail: 'Notatka rozwoj',
    });
  }

  for (const link of input.readLinksThisWeek) {
    const rt = (link.resource_type as GrowthResourceType | null) ?? inferResourceType(link.url, link.domain);
    items.push({
      id: `link-${link.id}`,
      kind: 'link',
      label: link.title || link.domain,
      detail: RESOURCE_TYPE_META[rt]?.label ?? 'Materiał',
    });
  }

  const inWeek = input.snapshots.filter(
    (s) => s.snapshot_date >= input.weekStart && s.snapshot_date < input.weekEnd,
  );
  if (inWeek.length >= 2) {
    const oldest = inWeek[inWeek.length - 1];
    const newest = inWeek[0];
    const gains = computeScoreDeltas(input.skills, oldest.scores, newest.scores).filter((g) => g.delta > 0);
    for (const g of gains.slice(0, 5)) {
      items.push({
        id: `score-${g.key}`,
        kind: 'score',
        label: g.label,
        detail: `${g.from}→${g.to} w deklaracji`,
      });
    }
  }

  return items;
}

export function filterReadLinksInWeek(links: GrowthLinkRow[], weekFromISO: string): GrowthLinkRow[] {
  return links.filter((l) => l.updated_at && l.updated_at >= weekFromISO);
}

export function buildMediaQueue(links: GrowthLinkRow[], limit = 12): GrowthLinkRow[] {
  return links
    .filter((l) => l.status === 'unread')
    .sort((a, b) => {
      const aVideo = inferResourceType(a.url, a.domain) === 'video' ? 0 : 1;
      const bVideo = inferResourceType(b.url, b.domain) === 'video' ? 0 : 1;
      return aVideo - bVideo;
    })
    .slice(0, limit);
}