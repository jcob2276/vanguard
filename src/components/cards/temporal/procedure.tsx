interface Step { step: number; text: string; done?: boolean; }
interface ProcedureData { title: string; steps: Step[]; }
export function ProcedureCard({ data }: { data: ProcedureData }) {
  return (
    <div>
      <p className="text-[13px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
      <ol className="space-y-2">
        {data.steps.map(s => (
          <li key={s.step} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ background: s.done ? 'rgba(16,185,129,0.15)' : 'rgba(91,108,255,0.1)', color: s.done ? 'var(--color-success)' : 'var(--color-primary)' }}>{s.step}</span>
            <p className="text-[12px] leading-snug" style={{ color: s.done ? 'var(--color-text-tertiary)' : 'var(--text-secondary)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
