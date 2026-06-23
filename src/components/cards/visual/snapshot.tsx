interface SnapshotData { imageUrl: string; caption?: string; timestamp?: string; }
export function SnapshotCard({ data }: { data: SnapshotData }) {
  return (
    <div>
      <img src={data.imageUrl} alt={data.caption} className="w-full rounded-xl object-cover" style={{ maxHeight: 280 }} />
      {(data.caption || data.timestamp) && (
        <div className="flex justify-between items-center mt-1.5">
          {data.caption && <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{data.caption}</p>}
          {data.timestamp && <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.timestamp}</p>}
        </div>
      )}
    </div>
  );
}
