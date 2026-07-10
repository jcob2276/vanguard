import type { LongTermGoals } from './goalSpine.types';

export function primaryBhagLine(longTerm: LongTermGoals): string | null {
  const d = longTerm.declarations;
  if (!d) return null;
  const lines = [
    d.goal_cialo?.trim() && `Ciało: ${d.goal_cialo.trim()}`,
    d.goal_duch?.trim() && `Duch: ${d.goal_duch.trim()}`,
    d.goal_konto?.trim() && `Konto: ${d.goal_konto.trim()}`,
  ].filter(Boolean) as string[];
  if (lines.length === 0) return null;
  if (d.bhag_pillar === 'cialo' && d.goal_cialo?.trim()) return d.goal_cialo.trim();
  if (d.bhag_pillar === 'duch' && d.goal_duch?.trim()) return d.goal_duch.trim();
  if (d.bhag_pillar === 'konto' && d.goal_konto?.trim()) return d.goal_konto.trim();
  return lines[0].replace(/^(Ciało|Duch|Konto): /, '');
}

export function longTermDeclarationsOk(longTerm: LongTermGoals): boolean {
  const d = longTerm.declarations;
  if (!d) return false;
  return Boolean(d.goal_cialo?.trim() || d.goal_duch?.trim() || d.goal_konto?.trim());
}

export function formatSprintFromLongTerm(
  bhagLine: string | null,
  sprintGoal: string | null | undefined,
): string | null {
  if (!bhagLine?.trim()) return null;
  const sprint = sprintGoal?.trim();
  if (!sprint) return `Rok / BHAG: ${bhagLine.trim()} — ustaw cel sprintu`;
  return `Rok / BHAG: ${bhagLine.trim()} — sprint: ${sprint}`;
}
