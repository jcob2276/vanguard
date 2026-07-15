interface SnapshotData { imageUrl: string; caption?: string; timestamp?: string; }
export function SnapshotCard({ data }: { data: SnapshotData }) {
  return (
    <div>
      <img src={data.imageUrl} alt={data.caption} className="w-full rounded-xl object-cover" style={{ maxHeight: 'var(--ds-inline-style-280)' }} />
      {(data.caption || data.timestamp) && (
        <div className="flex justify-between items-center mt-1.5">
          {data.caption && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.caption}</p>}
          {data.timestamp && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{data.timestamp}</p>}
        </div>
      )}
    </div>
  );
}
