interface Step { step: number; text: string; done?: boolean; }
interface ProcedureData { title: string; steps: Step[]; }
export function ProcedureCard({ data }: { data: ProcedureData }) {
  return (
    <div>
      <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
      <ol className="space-y-2">
        {data.steps.map(s => (
          <li key={s.step} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: s.done ? 'var(--legacy-color-096)' : 'var(--legacy-color-150)', color: s.done ? 'var(--color-success)' : 'var(--color-primary)' }}>{s.step}</span>
            <p className="text-sm leading-snug" style={{ color: s.done ? 'var(--color-text-tertiary)' : 'var(--text-secondary)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
