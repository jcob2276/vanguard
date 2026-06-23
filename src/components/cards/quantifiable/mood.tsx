const MOODS = ['😞','😕','😐','🙂','😄'];
interface MoodData { label?: string; value: number; note?: string; }
export function MoodCard({ data }: { data: MoodData }) {
  const idx = Math.min(Math.max(Math.round(data.value) - 1, 0), 4);
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl">{MOODS[idx]}</span>
      <div>
        {data.label && <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>{data.label}</p>}
        <p className="text-[20px] font-[800]" style={{ color: 'var(--text-primary)' }}>{data.value}/5</p>
        {data.note && <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{data.note}</p>}
      </div>
    </div>
  );
}
