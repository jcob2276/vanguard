interface GalleryData { images: { url: string; caption?: string }[]; }
export function GalleryCard({ data }: { data: GalleryData }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.images.length, 3)}, 1fr)` }}>
      {data.images.slice(0, 9).map((img, i) => (
        <img key={i} src={img.url} alt={img.caption} className="w-full aspect-square object-cover rounded-xl" />
      ))}
    </div>
  );
}
