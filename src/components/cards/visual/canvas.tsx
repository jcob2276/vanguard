interface CanvasCardData { title?: string; description?: string; imageUrl?: string; }
export function CanvasCard({ data }: { data: CanvasCardData }) {
  return (
    <div>
      {data.imageUrl && <img src={data.imageUrl} alt={data.title} className="w-full rounded-xl object-cover" style={{ maxHeight: 'var(--legacy-inline-style-054)' }} />}
      {data.title && <p className="text-sm font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>{data.title}</p>}
      {data.description && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{data.description}</p>}
    </div>
  );
}
