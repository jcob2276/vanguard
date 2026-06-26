import type { LearningSkill } from '../../lib/growth';

export default function GrowthSkillStrip({
  parents,
  scores,
  focusSkillId,
}: {
  parents: LearningSkill[];
  scores: Record<string, number>;
  focusSkillId: string | null;
}) {
  if (parents.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border-custom bg-surface/20 p-4">
      <div className="mb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Mapa skilli</p>
        <p className="text-[10px] text-text-muted mt-0.5">
          Deklaracja 0–5 · podświetlony = focus tygodnia · edycja tylko z nagłówka
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-2">
        {parents.map((s) => {
          const val = scores[s.key] ?? 0;
          const isFocus = s.id === focusSkillId;
          return (
            <div
              key={s.id}
              className={`rounded-xl border px-3 py-2.5 ${
                isFocus
                  ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
                  : 'border-border-custom bg-surface-solid/40'
              }`}
            >
              <p className="text-[11px] font-bold text-text-primary truncate">{s.label}</p>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-border-custom overflow-hidden">
                  <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
                </div>
                <span className="text-[11px] font-black text-primary tabular-nums shrink-0">{val}/5</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
