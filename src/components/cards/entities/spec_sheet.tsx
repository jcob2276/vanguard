interface SpecSheetData { title: string; specs: { label: string; value: string }[]; }
export function SpecSheetCard({ data }: { data: SpecSheetData }) {
  return (
    <div>
      <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
      <div className="divide-y" style={{ borderColor: 'rgba(153,161,175,0.12)' }}>
        {data.specs.map(s => (
          <div key={s.label} className="flex justify-between items-center py-1.5">
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{s.label}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
