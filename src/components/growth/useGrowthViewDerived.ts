import { useMemo } from 'react';
import { warsawDayBoundsISO } from '../../lib/date';
import {
  isCurrentWeek,
  partitionSkillTree,
  scoresFromSnapshot,
  matchLinkToSkill,
} from '../../lib/growth/growth';
import { getWeekEndExclusive } from '../../lib/growth/growthWeek';
import { DEFAULT_SKILL_TREE } from '../../lib/growth/growthSkills';
import {
  buildLearningNeed,
  buildMediaQueue,
  buildSkillInventory,
  buildWeekLearningLog,
  deriveFocusProposal,
  filterReadLinksInWeek,
} from '../../lib/growth/growthOverview';
import { computeTheoryPracticeBalance } from '../../lib/growth/growthMastery';
import { pinTitle } from './PinPickerModal';
import type { useGrowthData } from './hooks/useGrowthData';

type GrowthData = ReturnType<typeof useGrowthData>;

interface UseGrowthViewDerivedParams {
  weekStart: string;
  skills: GrowthData['skills'];
  snapshots: GrowthData['snapshots'];
  focus: GrowthData['focus'];
  pins: GrowthData['pins'];
  unreadLinks: GrowthData['unreadLinks'];
  readLinks: GrowthData['readLinks'];
  openTodos: GrowthData['openTodos'];
  activeProjects: GrowthData['activeProjects'];
  weekNotes: GrowthData['weekNotes'];
}

const SKILL_KEYWORDS: Record<string, string[]> = {
  storytelling: ['pewnosc', 'charyzma', 'komunikacja', 'sprzedaz', 'perswazja', 'storytelling'],
  voice_presence: ['pewnosc', 'charyzma', 'dykcja', 'glos'],
  closing: ['sprzedaz', 'dochod', 'klient', 'business'],
  social_exposure: ['poznawanie', 'zwiazek', 'relacj', 'ludzi'],
  body_base: ['cialo', 'tluszcz', 'trening', 'redukcja'],
  deep_work: ['praca', 'egzekucja', 'dyscyplina'],
  negotiation: ['sprzedaz', 'negocjacja'],
  setting: ['komunikacja', 'sprzedaz', 'rozmowa'],
};

export function useGrowthViewDerived({
  weekStart,
  skills,
  snapshots,
  focus,
  pins,
  unreadLinks,
  readLinks,
  openTodos,
  activeProjects,
  weekNotes,
}: UseGrowthViewDerivedParams) {
  const { parents, childrenByParentId } = useMemo(() => partitionSkillTree(skills), [skills]);
  const skillsById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const hasLegacySkillTree = useMemo(() => {
    const expected = new Set(DEFAULT_SKILL_TREE.map((n) => n.key));
    return parents.length === 0 || parents.some((p) => !expected.has(p.key));
  }, [parents]);

  const readOnly = !isCurrentWeek(weekStart);
  const latestSnapshot = snapshots[0] ?? null;
  const currentScores = useMemo(
    () => scoresFromSnapshot(skills, latestSnapshot),
    [skills, latestSnapshot],
  );

  const allLinks = useMemo(() => {
    const m = new Map<string, (typeof unreadLinks)[0]>();
    [...unreadLinks, ...readLinks].forEach((l) => m.set(l.id, l));
    return [...m.values()];
  }, [unreadLinks, readLinks]);
  const linksById = useMemo(() => new Map(allLinks.map((l) => [l.id, l])), [allLinks]);
  const todosById = useMemo(() => new Map(openTodos.map((t) => [t.id, t])), [openTodos]);

  const focusProposal = useMemo(
    () => deriveFocusProposal(parents, childrenByParentId, currentScores, focus, skillsById),
    [parents, childrenByParentId, currentScores, focus, skillsById],
  );

  const focusParentId = focusProposal?.parentId ?? focus?.skill_id ?? null;
  const skillInventory = useMemo(
    () => buildSkillInventory(parents, childrenByParentId, currentScores, focusParentId),
    [parents, childrenByParentId, currentScores, focusParentId],
  );

  const learningNeed = useMemo(
    () => buildLearningNeed(focusProposal, focus, parents, childrenByParentId, currentScores),
    [focusProposal, focus, parents, childrenByParentId, currentScores],
  );

  const { fromISO: weekFromISO } = useMemo(() => warsawDayBoundsISO(weekStart), [weekStart]);
  const weekEnd = useMemo(() => getWeekEndExclusive(weekStart), [weekStart]);

  const focusSkillKey = focusParentId ? skillsById.get(focusParentId)?.key : null;

  // Derive which project best matches the focus skill (heuristic by name/goal keywords)
  const focusProjectId = useMemo(() => {
    if (activeProjects.length === 0) return null;
    const focusSkillId = focusParentId;
    if (focusSkillId) {
      const bySkill = activeProjects.find((p) => p.primarySkillId === focusSkillId);
      if (bySkill) return bySkill.id;
    }
    if (!focusSkillKey) return activeProjects[0]?.id ?? null;
    const kws = SKILL_KEYWORDS[focusSkillKey] ?? [];
    const match = activeProjects.find((p) => {
      const text = (p.name + ' ' + (p.goal ?? '')).toLowerCase();
      return kws.some((kw) => text.includes(kw));
    });
    return match?.id ?? activeProjects[0]?.id ?? null;
  }, [focusSkillKey, focusParentId, activeProjects]);

  const focusLinks = useMemo(() => {
    if (!focusSkillKey) return [];
    return unreadLinks.filter((l) => matchLinkToSkill(l, focusSkillKey));
  }, [unreadLinks, focusSkillKey]);

  const readLinksThisWeek = useMemo(
    () => filterReadLinksInWeek(readLinks, weekFromISO),
    [readLinks, weekFromISO],
  );

  const weekLearningLog = useMemo(
    () =>
      buildWeekLearningLog({
        pins,
        resolvePinTitle: (pin) => pinTitle(pin, linksById, todosById),
        weekNotes,
        readLinksThisWeek,
        snapshots: snapshots.map((s) => ({ snapshot_date: s.snapshot_date, scores: s.scores })),
        skills,
        weekStart,
        weekEnd,
      }),
    [pins, linksById, todosById, weekNotes, readLinksThisWeek, snapshots, skills, weekStart, weekEnd],
  );

  const mediaQueue = useMemo(() => buildMediaQueue(unreadLinks, 16), [unreadLinks]);

  const mustDone = pins.filter((p) => p.slot === 'must' && p.done).length;
  const mustTotal = pins.filter((p) => p.slot === 'must').length;

  const balance = useMemo(() => computeTheoryPracticeBalance(pins, linksById), [pins, linksById]);

  const theme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return {
    parents,
    childrenByParentId,
    skillsById,
    hasLegacySkillTree,
    readOnly,
    currentScores,
    allLinks,
    linksById,
    focusProposal,
    focusParentId,
    skillInventory,
    learningNeed,
    focusProjectId,
    focusLinks,
    weekLearningLog,
    mediaQueue,
    mustDone,
    mustTotal,
    balance,
    grid,
  };
}
