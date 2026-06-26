import { Link } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import type { GrowthProjectSummary } from '../../hooks/useGrowthData';
import { KpiTrendSparkline } from '../projects/KpiTrendSparkline';

export default function GrowthProjectsPanel({
  projects,
  userId,
  sprintGoal,
  sprintLabel,
}: {
  projects: GrowthProjectSummary[];
  userId: string;
  sprintGoal: string | null;
  sprintLabel: string | null;
}) {
  if (projects.length === 0 && !sprintGoal) {
    return (
      <section className="rounded-2xl border border-dashed border-border-custom p-4 space-y-2">
        <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Projekty</p>
        <p className="text-[12px] text-text-muted leading-relaxed">
          Brak aktywnego projektu. Skilli bez projektu = deklaracja bez dowodu.
        </p>
        <Link
          to="/?view=projekty"
          onClick={() => {
            try {
              localStorage.setItem('vanguard_view', 'projekty');
            } catch {
              /* ignore */
            }
          }}
          className="inline-block text-[11px] font-black uppercase text-primary hover:underline"
        >
          Otwórz Projekty →
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border-custom bg-surface/30 p-4 space-y-3 h-full">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-text-muted">
          <FolderKanban size={12} /> Projekty · dowód
        </p>
        <Link
          to="/?view=projekty"
          onClick={() => {
            try {
              localStorage.setItem('vanguard_view', 'projekty');
            } catch {
              /* ignore */
            }
          }}
          className="text-[9px] font-black uppercase text-primary hover:underline shrink-0"
        >
          Wszystkie →
        </Link>
      </div>

      {sprintGoal && (
        <div className="rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2">
          <p className="text-[8px] font-black uppercase text-primary">{sprintLabel ?? 'Sprint'}</p>
          <p className="text-[11px] font-semibold text-text-primary mt-0.5 line-clamp-2">{sprintGoal}</p>
        </div>
      )}

      <div className="space-y-2">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl border border-border-custom bg-background/40 px-3 py-2.5">
            <p className="text-[12px] font-bold text-text-primary truncate">{p.name}</p>
            {p.goal && (
              <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{p.goal}</p>
            )}
            {p.kpis.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {p.kpis.map((k) => (
                  <li key={k.id} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-text-secondary truncate">
                      {k.name}
                      {k.current != null && (
                        <span className="text-primary ml-1 tabular-nums">
                          {k.current}
                          {k.target != null ? `/${k.target}` : ''}
                        </span>
                      )}
                    </span>
                    <KpiTrendSparkline kpiId={k.id} userId={userId} target={k.target} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">Brak KPI</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
