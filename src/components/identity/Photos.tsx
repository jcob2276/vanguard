import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { getTodayWarsaw } from '../../lib/date';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Trash2, Camera } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import exifr from 'exifr';
import { notify, confirmDialog } from '../../lib/notify';
import { generateThumbnail } from '../../lib/imageThumbnail';
import { useUserId } from '../../store/useStore';
import Spinner from '../ui/Spinner';
import { Card } from '../ui/Card';

export default function Photos() {
  const userId = useUserId();
  const [uploading, setUploading] = useState(false);
  const [photoDate, setPhotoDate] = useState(getTodayWarsaw());

  // Selection logic for comparison
  const [baseId, setBaseId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const photosQuery = useQuery({
    queryKey: ['progress-photos', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId!)
        .order('date', { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const loading = photosQuery.isLoading;

  // Set default selection when photos load
  useEffect(() => {
    if (photos.length > 0 && baseId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate sync of react-query data to local state
      setBaseId(photos[0].id);
      setTargetId(photos[photos.length - 1].id);
    }
  }, [photos, baseId]);

  if (!userId) return null;

  const basePhoto = photos.find(p => p.id === baseId);
  const targetPhoto = photos.find(p => p.id === targetId);

  const daysDiff = (basePhoto && targetPhoto)
    ? Math.abs(differenceInDays(parseISO(targetPhoto.date!), parseISO(basePhoto.date!)))
    : 0;

  function handleSelect(id: string) {
    if (id === baseId) return;
    if (id === targetId) {
      setTargetId(null);
      return;
    }
    setTargetId(id);
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];

      let occurredDate = photoDate;
      try {
        const tags = await exifr.parse(file);
        const dateObj = tags?.DateTimeOriginal || tags?.CreateDate || tags?.ModifyDate;
        if (dateObj) {
          occurredDate = format(new Date(dateObj), 'yyyy-MM-dd');
        }
      } catch (exifErr: unknown) {
      console.error('[Action Error]', exifErr);
      notify(exifErr instanceof Error ? exifErr.message : 'Wystąpił błąd', 'error');
    }

      const stamp = Date.now();
      const fileName = `${userId}/${stamp}.${file.name.split('.').pop()}`;
      await supabase.storage.from('progress-photos').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(fileName);

      let thumbnailUrl: string | null = null;
      try {
        const thumbBlob = await generateThumbnail(file);
        const thumbName = `${userId}/${stamp}_thumb.jpg`;
        await supabase.storage.from('progress-photos').upload(thumbName, thumbBlob);
        thumbnailUrl = supabase.storage.from('progress-photos').getPublicUrl(thumbName).data.publicUrl;
      } catch (thumbErr: unknown) {
        console.warn('[Photos] thumbnail generation failed, gallery will use the original', thumbErr);
      }

      const { error: insertErr } = await supabase.from('progress_photos').insert({
         user_id: userId,
         image_url: publicUrl,
         thumbnail_url: thumbnailUrl,
         date: occurredDate
      });
      if (insertErr) throw insertErr;
      void photosQuery.refetch();
    } catch (error: unknown) {
      notify('Błąd: ' + (error instanceof Error ? (error as Error).message : String(error)), 'error');
    } finally { setUploading(false); }
  }

  async function deletePhoto(id: string, url: string, thumbnailUrl: string | null) {
    if (!(await confirmDialog('Usunąć?'))) return;
    const fileName = `${userId}/${url.split('/').pop()}`;
    const paths = [fileName];
    if (thumbnailUrl) paths.push(`${userId}/${thumbnailUrl.split('/').pop()}`);
    await supabase.storage.from('progress-photos').remove(paths);
    const { error: delErr } = await supabase.from('progress_photos').delete().eq('id', id).eq('user_id', userId!);
    if (delErr) { notify(delErr.message, 'error'); return; }
    void photosQuery.refetch();
  }

  if (loading) return <div className="p-8 text-center text-text-muted uppercase font-black animate-pulse">Wczytywanie Analizy Wizualnej...</div>;

  if (photos.length === 0) {
    return (
      <Card className="text-center space-y-4 my-2" padding="1.5rem">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Camera size={22} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black uppercase tracking-tight text-text-primary font-display">
            Wizualny Protokół
          </h3>
          <p className="text-xs font-medium leading-relaxed text-text-secondary max-w-[var(--legacy-maxw-056)] mx-auto">
            Brak zdjęć postępu w bazie. Zrób i dodaj pierwsze zdjęcie, aby zacząć śledzić transformację sylwetki.
          </p>
        </div>
        <div className="pt-2">
          <label className="inline-flex items-center gap-2 cursor-pointer bg-primary text-on-accent font-display font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl hover:bg-primary-hover transition-all active:scale-95 shadow-md shadow-primary/20 cursor-pointer">
            {uploading ? (
              <Spinner size="sm" className="!border-on-accent/30 !border-t-on-accent" />
            ) : (
              <>
                <Camera size={14} className="shrink-0" />
                <span>Dodaj pierwsze zdjęcie</span>
              </>
            )}
            <ControlInput type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
          </label>
        </div>
        <div className="hidden">
          <ControlInput
            type="date"
            value={photoDate}
            onChange={(e) => setPhotoDate(e.target.value)}
          />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 text-text-primary">

      {/* Card: Header + Comparison */}
      <Card padding="0">
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[var(--legacy-arbitrary-004)] text-text-muted font-display">Postęp sylwetki</p>
            <h2 className="mt-1 font-display text-lg font-black tracking-tight text-text-primary">Transformacja</h2>
          </div>
          <label className="cursor-pointer flex h-11 w-11 items-center justify-center rounded-2xl border border-border-custom bg-surface text-text-secondary transition-all hover:bg-primary hover:border-primary hover:text-on-accent shadow-sm">
            {uploading ? <Spinner size="sm" /> : <Camera size={17} />}
            <ControlInput type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
          </label>
        </div>

        {/* Comparison */}
        <div className="relative aspect-[var(--legacy-arbitrary-046)] bg-surface-solid border-t border-border-custom overflow-hidden">
          <div className="absolute inset-0 flex">
            {/* Baza (Left) */}
            <div className="relative flex-1 border-r border-border-custom overflow-hidden">
              {basePhoto ? (
                <>
                  <img src={basePhoto.image_url} alt="Zdjęcie bazowe sylwetki" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute top-4 left-4 bg-surface/80 backdrop-blur-[var(--blur-md)] px-3 py-1 rounded-full border border-border-custom shadow-sm">
                    <p className="text-2xs font-black text-text-secondary uppercase tracking-widest">Baza: {format(parseISO(basePhoto.date!), 'dd.MM.yy')}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-black text-text-muted uppercase">Wybierz bazę</div>
              )}
            </div>

            {/* Cel (Right) */}
            <div className="relative flex-1 overflow-hidden">
              {targetPhoto ? (
                <>
                  <img src={targetPhoto.image_url} alt="Zdjęcie docelowe sylwetki" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 bg-primary/10 backdrop-blur-[var(--blur-md)] px-3 py-1 rounded-full border border-primary/25">
                    <p className="text-2xs font-black text-primary uppercase tracking-widest">Cel: {format(parseISO(targetPhoto.date!), 'dd.MM.yy')}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-black text-text-muted uppercase">Wybierz cel</div>
              )}
            </div>
          </div>

          {/* VS Badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="bg-surface/90 backdrop-blur-[var(--blur-xl)] border border-border-custom w-11 h-11 rounded-full flex items-center justify-center shadow-md">
              <span className="text-xs font-black text-text-primary">VS</span>
            </div>
          </div>

          {/* Dni Progresu Badge */}
          {daysDiff > 0 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-primary text-on-accent px-5 py-1.5 rounded-full shadow-lg shadow-primary/25">
              <p className="text-xs font-black uppercase tracking-[var(--legacy-arbitrary-004)] whitespace-nowrap">+{daysDiff} dni postępu</p>
            </div>
          )}
        </div>
      </Card>

      {/* Oś czasu */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-2xs font-bold uppercase tracking-[var(--legacy-arbitrary-004)] text-text-muted font-display">Oś czasu</p>
          <p className="text-2xs font-bold text-text-muted uppercase tracking-wider">Dotknij by zestawić</p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((photo) => {
            const isBase = photo.id === baseId;
            const isTarget = photo.id === targetId;

            return (
              <div key={photo.id} className="snap-start shrink-0 space-y-2">
                <Pressable
                  onClick={() => handleSelect(photo.id)}
                  className={`relative w-[var(--legacy-w-095)] aspect-[var(--legacy-arbitrary-047)] rounded-2xl overflow-hidden border-2 transition-all duration-[var(--motion-slow)] cursor-pointer ${isBase ? 'border-primary scale-[var(--legacy-arbitrary-048)] shadow-md shadow-primary/20' : isTarget ? 'border-primary/50 scale-[var(--legacy-arbitrary-048)] shadow-sm' : 'border-border-custom opacity-[var(--opacity-50)] hover:opacity-[var(--opacity-80)]'}`}
                >
                  <img src={photo.thumbnail_url || photo.image_url} alt={`Zdjęcie sylwetki z ${format(parseISO(photo.date!), 'dd.MM.yyyy')}`} className={`w-full h-full object-cover ${!isBase && !isTarget ? 'grayscale' : ''}`} />
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
                  <Pressable onClick={() => deletePhoto(photo.id, photo.image_url, photo.thumbnail_url)} variant="ghost" icon={<Trash2 size={11} />} className="text-text-muted hover:text-danger p-1 rounded-lg hover:bg-danger/5 min-w-[var(--legacy-w-086)] min-h-[var(--legacy-h-024)]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
