import type { TaskSlot } from './usePowerListData';
import { TIME_SLOT_LABELS } from './usePowerListData';
import type { KpiSlotHint } from '../../lib/dailyPlanProposal';

export interface PowerListKpiProps {
  index: number;
  slot: TaskSlot;
  updateSlot: (index: number, patch: Partial<TaskSlot>) => void;
  pillarProjects: any[];
  projectOptions: Array<{ id: string; name: string; kpis: any[] }>;
  kpisForProject: (projectId: string | null) => any[];
  kpiHintForSlot: (slotIndex: number, projectId: string | null, kpiId?: string | null) => KpiSlotHint | null;
  sphereSlots: Array<{ category: string; label: string }>;
}

export default function PowerListKpi({
  index,
  slot,
  updateSlot,
  pillarProjects,
  projectOptions,
  kpisForProject,
  kpiHintForSlot,
  sphereSlots,
}: PowerListKpiProps) {
  if (!slot.task.trim()) return null;

  const hint = kpiHintForSlot(index, slot.projectId, slot.kpiId);

  return (
    <div className="mt-1 space-y-1 px-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={slot.projectId ?? ''}
          onChange={(e) => updateSlot(index, { projectId: e.target.value || null })}
          className="max-w-[48%] shrink-0 rounded-lg border border-border-custom bg-surface-solid px-2 py-1 text-[10px] font-semibold text-text-primary outline-none focus:border-primary/40"
        >
          <option value="">
            {index < 3 && pillarProjects.some((p) => p.pillar === sphereSlots[index].category)
              ? `Projekt (${sphereSlots[index].label})…`
              : 'Projekt (KPI)…'}
          </option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {kpisForProject(slot.projectId).length > 1 && (
          <select
            value={slot.kpiId ?? ''}
            onChange={(e) => updateSlot(index, { kpiId: e.target.value || null })}
            className="max-w-[40%] shrink-0 rounded-lg border border-border-custom bg-surface-solid px-2 py-1 text-[10px] font-semibold text-text-primary outline-none focus:border-primary/40"
          >
            <option value="">KPI…</option>
            {kpisForProject(slot.projectId).map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          inputMode="numeric"
          placeholder="ile?"
          title="Liczba dla KPI (rollup przy odhaczeniu)"
          value={slot.targetValue ?? ''}
          onChange={(e) => updateSlot(index, { targetValue: e.target.value })}
          className="w-14 shrink-0 rounded-lg border border-border-custom bg-surface-solid px-2 py-1 text-[10px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/40"
        />
        <select
          value={slot.timeSlot ?? 'morning'}
          onChange={(e) => updateSlot(index, { timeSlot: e.target.value as TaskSlot['timeSlot'] })}
          className="shrink-0 rounded-lg border border-border-custom bg-surface-solid px-2 py-1 text-[10px] font-semibold text-text-primary outline-none focus:border-primary/40"
        >
          {(Object.keys(TIME_SLOT_LABELS) as Array<keyof typeof TIME_SLOT_LABELS>).map((key) => (
            <option key={key} value={key}>{TIME_SLOT_LABELS[key]}</option>
          ))}
        </select>
      </div>
      {hint?.message && (
        <p className={`text-[10px] leading-snug ${hint.rollupReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {hint.message}
        </p>
      )}
    </div>
  );
}
