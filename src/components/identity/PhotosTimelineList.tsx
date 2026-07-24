import { format, parseISO } from 'date-fns';
import { Trash2, Sparkles } from 'lucide-react';
import type { ProgressPhoto } from '../../lib/photosApi';
import { Pressable } from '../ui/ControlPrimitives';

interface Props {
  photos: ProgressPhoto[];
  baseId: string | null;
  targetId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, url: string, thumbnailUrl: string | null) => void;
}

export default function PhotosTimelineList({
  photos,
  baseId,
  targetId,
  onSelect,
  onDelete,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-2xs font-bold uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted font-display">
          Oś czasu
        </p>
        <p className="text-2xs font-bold text-text-muted uppercase tracking-wider">
          Dotknij by zestawić
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((photo) => {
          const isBase = photo.id === baseId;
          const isTarget = photo.id === targetId;
          const hasAnalysis = !!photo.ai_analysis;

          return (
            <div key={photo.id} className="snap-start shrink-0 space-y-2">
              <Pressable
                onClick={() => onSelect(photo.id)}
                className={`relative w-[var(--ds-w-88px)] aspect-[var(--ds-arbitrary-3-4)] rounded-2xl overflow-hidden border-2 transition-all duration-[var(--motion-slow)] cursor-pointer ${
                  isBase
                    ? 'border-primary scale-[var(--ds-arbitrary-1-04)] shadow-md shadow-primary/20'
                    : isTarget
                    ? 'border-primary/50 scale-[var(--ds-arbitrary-1-04)] shadow-sm'
                    : 'border-border-custom opacity-[var(--opacity-50)] hover:opacity-[var(--opacity-80)]'
                }`}
              >
                <img
                  src={photo.thumbnail_url || photo.image_url}
                  alt={`Zdjęcie sylwetki z ${format(parseISO(photo.date!), 'dd.MM.yyyy')}`}
                  className={`w-full h-full object-cover ${!isBase && !isTarget ? 'grayscale' : ''}`}
                />

                {hasAnalysis && (
                  <div className="absolute top-1.5 right-1.5 bg-primary/90 text-on-accent p-1 rounded-full shadow-sm">
                    <Sparkles size={10} />
                  </div>
                )}

                {(isBase || isTarget) && (
                  <div className="absolute inset-0 flex items-end justify-center pb-2">
                    <span className="text-2xs font-black text-on-accent uppercase bg-scrim/50 backdrop-blur-[var(--blur-sm)] px-2 py-0.5 rounded-full border border-on-accent/10">
                      {isBase ? 'Baza' : 'Cel'}
                    </span>
                  </div>
                )}
              </Pressable>

              <div className="flex justify-between items-center px-0.5">
                <span className={`text-2xs font-bold ${isBase || isTarget ? 'text-primary' : 'text-text-secondary'}`}>
                  {format(parseISO(photo.date!), 'dd.MM')}
                </span>
                <Pressable
                  onClick={() => onDelete(photo.id, photo.image_url, photo.thumbnail_url)}
                  variant="ghost"
                  icon={<Trash2 size={11} />}
                  className="text-text-muted hover:text-danger p-1 rounded-lg hover:bg-danger/5 min-w-[var(--ds-w-32px)] min-h-[var(--ds-h-32px)]"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
