export function getTodayStateCopy(readiness: number): string {
  if (readiness >= 75) return 'Organizm daje dziś przestrzeń na wymagające działania.';
  if (readiness >= 55) return 'Działaj normalnie, ale zostaw margines na regenerację.';
  if (readiness > 0) return 'Energia jest ograniczona — chroń najważniejszy ruch dnia.';
  return 'Stan organizmu jeszcze się synchronizuje. Plan pozostaje pod Twoją kontrolą.';
}

export function needsNutritionCorrection(input: {
  loggedDays: number;
  averageProtein: number | null;
  proteinGoal: number;
  caloriesDeltaPct: number;
}): boolean {
  const proteinOnTrack = input.averageProtein !== null && input.averageProtein >= input.proteinGoal * 0.9;
  return input.loggedDays < 5 || !proteinOnTrack || input.caloriesDeltaPct > 8;
}

export function needsRecoveryCorrection(input: {
  warningDays: number;
  averageRecovery: number | null;
}): boolean {
  return input.warningDays >= 3 || (input.averageRecovery !== null && input.averageRecovery < 55);
}
