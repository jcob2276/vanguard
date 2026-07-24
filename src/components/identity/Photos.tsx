import { ControlInput } from '../ui/ControlPrimitives';
import { getTodayWarsaw } from '../../lib/date';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, Sparkles } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import exifr from 'exifr';
import { notify, confirmDialog } from '../../lib/notify';
import { generateThumbnail } from '../../lib/imageThumbnail';
import { useUserId } from '../../store/useStore';
import Spinner from '../ui/Spinner';
import { Card } from '../ui/Card';
import {
  deleteProgressPhoto,
  insertProgressPhoto,
  listProgressPhotos,
  removeProgressPhotoFiles,
  uploadProgressPhotoFile,
  type ProgressPhoto,
} from '../../lib/photosApi';
import { requestPhysiqueAnalysis, type PhysiqueAnalysisResult } from '../../lib/physiqueApi';
import PhysiqueAnalysisModal from './PhysiqueAnalysisModal';
import PhotosTimelineList from './PhotosTimelineList';

export default function Photos() {
  const userId = useUserId();
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [photoDate, setPhotoDate] = useState(getTodayWarsaw());

  // Modal state
  const [activeAnalysis, setActiveAnalysis] = useState<PhysiqueAnalysisResult | null>(null);
  const [activeAnalysisDate, setActiveAnalysisDate] = useState<string | undefined>(undefined);

  // Selection logic for comparison
  const [baseId, setBaseId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const photosQuery = useQuery({
    queryKey: ['progress-photos', userId],
    queryFn: () => listProgressPhotos(userId!),
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

  async function handleAnalyze(photo: ProgressPhoto) {
    try {
      setAnalyzingId(photo.id);
      if (photo.ai_analysis) {
        setActiveAnalysis(photo.ai_analysis as unknown as PhysiqueAnalysisResult);
        setActiveAnalysisDate(photo.date ? format(parseISO(photo.date), 'dd.MM.yyyy') : undefined);
        return;
      }
      const result = await requestPhysiqueAnalysis(photo.id, photo.image_url, userId!);
      setActiveAnalysis(result);
      setActiveAnalysisDate(photo.date ? format(parseISO(photo.date), 'dd.MM.yyyy') : undefined);
      void photosQuery.refetch();
      notify('Przeanalizowano sylwetkę przez AI!', 'success');
    } catch (err: unknown) {
      console.error('[Photos] Physique analysis failed:', err);
      notify(err instanceof Error ? err.message : 'Nie udało się przeprowadzić analizy AI', 'error');
    } finally {
      setAnalyzingId(null);
    }
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
      const publicUrl = await uploadProgressPhotoFile(userId!, fileName, file);

      let thumbnailUrl: string | null = null;
      try {
        const thumbBlob = await generateThumbnail(file);
        const thumbName = `${userId}/${stamp}_thumb.jpg`;
        thumbnailUrl = await uploadProgressPhotoFile(userId!, thumbName, thumbBlob);
      } catch (thumbErr: unknown) {
        console.warn('[Photos] thumbnail generation failed, gallery will use the original', thumbErr);
      }

      await insertProgressPhoto({
        userId: userId!,
        imageUrl: publicUrl,
        thumbnailUrl,
        date: occurredDate,
      });
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
    try {
      await removeProgressPhotoFiles(paths);
      await deleteProgressPhoto(userId!, id);
      void photosQuery.refetch();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Nie udało się usunąć zdjęcia', 'error');
    }
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
          <p className="text-xs font-medium leading-relaxed text-text-secondary max-w-[var(--ds-maxw-280px)] mx-auto">
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
            <p className="text-2xs font-bold uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted font-display">Postęp sylwetki</p>
            <h2 className="mt-1 font-display text-lg font-black tracking-tight text-text-primary">Transformacja</h2>
          </div>
          <div className="flex items-center gap-2">
            {targetPhoto && (
              <button
                onClick={() => handleAnalyze(targetPhoto)}
                disabled={analyzingId === targetPhoto.id}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-on-accent font-display text-xs font-bold uppercase tracking-wider transition-all"
              >
                {analyzingId === targetPhoto.id ? <Spinner size="sm" /> : <Sparkles size={15} />}
                <span>{targetPhoto.ai_analysis ? 'Wynik AI' : 'Analizuj AI'}</span>
              </button>
            )}
            <label className="cursor-pointer flex h-11 w-11 items-center justify-center rounded-2xl border border-border-custom bg-surface text-text-secondary transition-all hover:bg-primary hover:border-primary hover:text-on-accent shadow-sm">
              {uploading ? <Spinner size="sm" /> : <Camera size={17} />}
              <ControlInput type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Comparison */}
        <div className="relative aspect-[var(--ds-arbitrary-4-5)] bg-surface-solid border-t border-border-custom overflow-hidden">
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
              <p className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] whitespace-nowrap">+{daysDiff} dni postępu</p>
            </div>
          )}
        </div>
      </Card>

      {/* Oś czasu List */}
      <PhotosTimelineList
        photos={photos}
        baseId={baseId}
        targetId={targetId}
        onSelect={handleSelect}
        onDelete={deletePhoto}
      />

      {/* Analysis Modal */}
      {activeAnalysis && (
        <PhysiqueAnalysisModal
          analysis={activeAnalysis}
          photoDate={activeAnalysisDate}
          onClose={() => setActiveAnalysis(null)}
        />
      )}

    </div>
  );
}
