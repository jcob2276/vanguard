import type { GrowthLinkRow } from '../hooks/useGrowthData';
import type { LearningSkill, LearningWeekPin } from './growth';
import { inferResourceType } from './growth';

/** Collin / learning pyramid — practitioner rule. */
const PRACTITIONER_PRACTICE_TARGET = 80;

export type TheoryPracticeBalance = {
  theory: number;
  practice: number;
  theoryDone: number;
  practiceDone: number;
  practiceShare: number;
  overloaded: boolean;
  imbalanced: boolean;
  meetsPractitionerRule: boolean;
  total: number;
};

function pinResourceKind(
  pin: LearningWeekPin,
  linksById: Map<string, GrowthLinkRow>,
): 'theory' | 'practice' {
  if (pin.entity_type === 'todo') return 'practice';
  if (pin.entity_type === 'manual') {
    return pin.manual_resource_type === 'exercise' ? 'practice' : 'theory';
  }
  if (pin.entity_type === 'link' && pin.entity_id) {
    const link = linksById.get(pin.entity_id);
    if (link?.resource_type === 'exercise') return 'practice';
    if (link?.resource_type) return 'theory';
    const inferred = inferResourceType(link?.url ?? '', link?.domain ?? '');
    return inferred === 'exercise' ? 'practice' : 'theory';
  }
  return 'theory';
}

export function computeTheoryPracticeBalance(
  pins: LearningWeekPin[],
  linksById: Map<string, GrowthLinkRow>,
): TheoryPracticeBalance {
  let theory = 0;
  let practice = 0;
  let theoryDone = 0;
  let practiceDone = 0;

  for (const pin of pins) {
    const kind = pinResourceKind(pin, linksById);
    if (kind === 'theory') {
      theory++;
      if (pin.done) theoryDone++;
    } else {
      practice++;
      if (pin.done) practiceDone++;
    }
  }

  const total = theory + practice;
  const practiceShare = total === 0 ? 0 : Math.round((practice / total) * 100);
  const overloaded = theory > 0 && practice === 0;
  const imbalanced =
    total > 0 && practiceShare < PRACTITIONER_PRACTICE_TARGET && theoryDone > 0;
  const meetsPractitionerRule =
    total === 0 ? false : practiceShare >= PRACTITIONER_PRACTICE_TARGET;

  return {
    theory,
    practice,
    theoryDone,
    practiceDone,
    practiceShare,
    overloaded,
    imbalanced,
    meetsPractitionerRule,
    total,
  };
}

export function suggestWeakestSubskillId(
  parentId: string,
  childrenByParentId: Map<string, LearningSkill[]>,
  scores: Record<string, number>,
): string | null {
  const children = childrenByParentId.get(parentId) ?? [];
  if (children.length === 0) return null;

  let weakest = children[0];
  let minScore = scores[weakest.key] ?? 0;
  for (const child of children) {
    const score = scores[child.key] ?? 0;
    if (score < minScore) {
      minScore = score;
      weakest = child;
    }
  }
  return weakest.id;
}

