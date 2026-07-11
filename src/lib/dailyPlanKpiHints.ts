export type KpiHint = { id: string; name: string; current: number | null; target: number | null };

export type PillarProjectBinding = {
  pillar: 'cialo' | 'duch' | 'konto';
  projectId: string;
  name?: string;
  kpis: KpiHint[];
};

/** Prefer sprint-focus project for a pillar when set at sprint close. */
export function defaultPillarProject(
  pillar: 'cialo' | 'duch' | 'konto',
  bindings: PillarProjectBinding[],
  focusProjectIds: string[] = [],
): PillarProjectBinding | null {
  if (focusProjectIds.length) {
    const focused = bindings.find(
      (b) => b.pillar === pillar && focusProjectIds.includes(b.projectId),
    );
    if (focused) return focused;
  }
  return bindings.find((b) => b.pillar === pillar) ?? null;
}

/** Daily increment when project has exactly one KPI with a numeric weekly target. */
export function suggestDailyKpiTarget(kpis: KpiHint[]): string | null {
  if (kpis.length !== 1 || kpis[0].target == null || !Number.isFinite(kpis[0].target)) return null;
  const weekly = kpis[0].target;
  if (weekly <= 0) return null;
  return String(Math.max(1, Math.ceil(weekly / 5)));
}

export type KpiSlotHint = {
  autoTarget: string | null;
  message: string | null;
  rollupReady: boolean;
};

/** KPI with largest gap vs weekly target (or explicit pick). */
export function pickRollupKpi(
  kpis: Array<{ id: string; name: string; target?: number | null; current?: number | null }>,
  preferredKpiId?: string | null,
): { id: string; name: string } | null {
  if (!kpis.length) return null;
  if (preferredKpiId) {
    const hit = kpis.find((k) => k.id === preferredKpiId);
    if (hit) return hit;
  }
  if (kpis.length === 1) return kpis[0];
  const scored = kpis
    .filter((k) => k.target != null && Number.isFinite(k.target) && k.target > 0)
    .map((k) => {
      const current = k.current ?? 0;
      const gap = (k.target ?? 0) - current;
      return { kpi: k, gap };
    })
    .sort((a, b) => b.gap - a.gap);
  return scored[0]?.kpi ?? kpis[0];
}

export function kpiSlotHint(
  kpis: KpiHint[],
  preferredKpiId?: string | null,
): KpiSlotHint {
  if (kpis.length === 0) {
    return { autoTarget: null, message: null, rollupReady: false };
  }
  const picked = pickRollupKpi(kpis, preferredKpiId);
  if (kpis.length === 1 && picked) {
    const autoTarget = suggestDailyKpiTarget(kpis);
    const name = kpis[0].name;
    return {
      autoTarget,
      message: autoTarget
        ? `${name}: +${autoTarget} przy odhaczeniu → KPI tygodnia`
        : `Ustaw cel tygodniowy dla „${name}" w Projekty`,
      rollupReady: Boolean(autoTarget),
    };
  }
  if (picked) {
    const kpiRow = kpis.find((k) => k.id === picked.id);
    if (!kpiRow) {
      return { autoTarget: null, message: `${kpis.length} KPI — wybierz które liczyć`, rollupReady: false };
    }
    const autoTarget = suggestDailyKpiTarget([kpiRow]);
    return {
      autoTarget,
      message: autoTarget
        ? `Rollup → „${picked.name}” (+${autoTarget} przy liczbie)`
        : `Wybierz KPI i wpisz liczbę — rollup do „${picked.name}"`,
      rollupReady: Boolean(autoTarget),
    };
  }
  return {
    autoTarget: null,
    message: `${kpis.length} KPI — wybierz które liczyć`,
    rollupReady: false,
  };
}
