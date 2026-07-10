import { useEffect, useState } from 'react';
import { fetchProjectEvidence, type ProjectEvidenceItem } from '../../lib/projects/projectEvidence';

const KIND_LABEL = {
  win: 'Zwycięstwo',
  checkpoint: 'Checkpoint',
  kpi: 'KPI',
};

export default function ProjectEvidenceStrip({ userId, projectId }: { userId: string; projectId: string }) {
  const [items, setItems] = useState<ProjectEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      fetchProjectEvidence(userId, projectId, 7)
        .then(setItems)
        .finally(() => setLoading(false));
    })();
  }, [userId, projectId]);

  if (loading) return null;
  if (items.length === 0) {
    return (
      <p className="text-[10px] text-text-muted/60 mt-3 border-t border-border-custom/50 pt-3">
        Ostatnie 7 dni — brak powiązanych zwycięstw, checkpointów i logów KPI.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-border-custom/50 pt-3 space-y-1.5">
      <p className="text-[8px] font-black uppercase tracking-wider text-text-muted">Dowód · 7 dni</p>
      {items.map((item, i) => (
        <div key={`${item.kind}-${item.date}-${i}`} className="flex items-start gap-2 text-[10px]">
          <span className="shrink-0 font-black text-text-muted tabular-nums">{item.date.slice(5)}</span>
          <span className="shrink-0 rounded px-1 py-0.5 text-[7px] font-black uppercase bg-primary/10 text-primary">
            {KIND_LABEL[item.kind]}
          </span>
          <span className="min-w-0 text-text-secondary truncate" title={item.label}>
            {item.label}
            {item.detail && item.kind === 'kpi' ? ` → ${item.detail}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
