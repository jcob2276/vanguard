import { Play } from 'lucide-react';
interface VideoData { url?: string; thumbnailUrl?: string; title?: string; duration?: string; }
export function VideoCard({ data }: { data: VideoData }) {
  return (
    <div>
      <div className="relative rounded-xl overflow-hidden aspect-video bg-scrim flex items-center justify-center cursor-pointer" onClick={() => data.url && window.open(data.url, '_blank')}>
        {data.thumbnailUrl ? <img src={data.thumbnailUrl} alt={data.title} className="absolute inset-0 w-full h-full object-cover" /> : null}
        <div className="relative z-[var(--z-raised)] w-12 h-12 rounded-full bg-on-accent/90 flex items-center justify-center shadow-lg">
          <Play size={18} className="text-scrim" />
        </div>
        {data.duration && <span className="absolute bottom-2 right-2 text-xs font-bold text-on-accent bg-scrim/60 px-1.5 py-0.5 rounded">{data.duration}</span>}
      </div>
      {data.title && <p className="text-sm font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>{data.title}</p>}
    </div>
  );
}
