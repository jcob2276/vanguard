import SprintMetricsGrid from './SprintMetricsGrid';
import type { SprintPanelProps } from './SprintPanel';

export default function SprintScorecard(props: Pick<
  SprintPanelProps,
  'metrics' | 'prevMetrics' | 'projectMetrics' | 'goals' | 'currentWeight' | 'weight30ago' | 'sprint'
>) {
  const { sprint, ...gridProps } = props;

  return (
    <section id="sprint" className="scroll-mt-28">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
          Sprint scorecard · {sprint.sprintStart} → {sprint.sprintEnd}
        </span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>
      <div className="rounded-[24px] border border-primary/15 bg-primary/[0.03] px-8 py-6">
        <SprintMetricsGrid {...gridProps} />
      </div>
    </section>
  );
}
