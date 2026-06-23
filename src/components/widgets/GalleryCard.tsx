interface GalleryWidgetData { images: { url: string; caption?: string }[]; title?: string; layout?: 'grid' | 'strip'; }
export function GalleryWidget({ data }: { data: GalleryWidgetData }) {
  const cols = data.layout === 'strip' ? data.images.length : Math.min(3, data.images.length);
  return (
    <div>
      {data.title && <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{data.title}</p>}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {data.images.map((img, i) => <img key={i} src={img.url} alt={img.caption} className="w-full rounded-lg object-cover" style={{ aspectRatio: data.layout === 'strip' ? '1' : '4/3' }} />)}
      </div>
    </div>
  );
}
