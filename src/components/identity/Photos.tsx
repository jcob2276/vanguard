import { getTodayWarsaw } from '../../lib/date';
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Camera } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import exifr from 'exifr';
import { notify, confirmDialog } from '../../lib/notify';

export default function Photos({ session }: { session: any }) {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoDate, setPhotoDate] = useState(getTodayWarsaw());
  
  // Selection logic for comparison
  const [baseId, setBaseId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: true });

    if (data && data.length > 0) {
      setPhotos(data);
      // Domyślnie ustawiamy pierwsze i ostatnie
      setBaseId(data[0].id);
      setTargetId(data[data.length - 1].id);
    }
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const basePhoto = photos.find(p => p.id === baseId);
  const targetPhoto = photos.find(p => p.id === targetId);
  
  const daysDiff = (basePhoto && targetPhoto) 
    ? Math.abs(differenceInDays(parseISO(targetPhoto.date), parseISO(basePhoto.date))) 
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
          console.log('[EXIF] extracted date taken:', occurredDate);
        }
      } catch (exifErr) {
        console.warn('[EXIF] failed to extract date taken, using fallback:', exifErr);
      }

      const fileName = `${session.user.id}/${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('progress-photos').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
      const { error: insertErr } = await supabase.from('progress_photos').insert({
         user_id: session.user.id,
         image_url: publicUrl,
         date: occurredDate
      });
      if (insertErr) throw insertErr;
      fetchPhotos();
    } catch (error) {
      notify('Błąd: ' + (error instanceof Error ? error.message : String(error)), 'error');
    } finally { setUploading(false); }
  }

  async function deletePhoto(id: string, url: string) {
    if (!(await confirmDialog('Usunąć?'))) return;
    const fileName = `${session.user.id}/${url.split('/').pop()}`;
    await supabase.storage.from('progress-photos').remove([fileName]);
    const { error: delErr } = await supabase.from('progress_photos').delete().eq('id', id).eq('user_id', session.user.id);
    if (delErr) { notify(delErr.message, 'error'); return; }
    fetchPhotos();
  }

  if (loading) return <div className="p-8 text-center text-text-muted uppercase font-black animate-pulse">Wczytywanie Analizy Wizualnej...</div>;

  if (photos.length === 0) {
    return (
      <div className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-6 text-center space-y-4 shadow-sm my-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Camera size={22} />
        </div>
        <div className="space-y-1">
          <h3 className="text-[14px] font-black uppercase tracking-tight text-text-primary font-display">
            Wizualny Protokół
          </h3>
          <p className="text-[11px] font-medium leading-relaxed text-text-secondary max-w-[280px] mx-auto">
            Brak zdjęć postępu w bazie. Zrób i dodaj pierwsze zdjęcie, aby zacząć śledzić transformację sylwetki.
          </p>
        </div>
        <div className="pt-2">
          <label className="inline-flex items-center gap-2 cursor-pointer bg-primary text-white font-display font-bold text-[11px] uppercase tracking-wider px-5 py-3 rounded-xl hover:bg-primary-hover transition-all active:scale-95 shadow-md shadow-primary/20 cursor-pointer">
            {uploading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                <Camera size={14} className="shrink-0" />
                <span>Dodaj pierwsze zdjęcie</span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
          </label>
        </div>
        <div className="hidden">
          <input 
            type="date" 
            value={photoDate} 
            onChange={(e) => setPhotoDate(e.target.value)} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-text-primary">

      {/* Card: Header + Comparison */}
      <div className="overflow-hidden rounded-[24px] border border-border-custom bg-surface backdrop-blur-md shadow-sm">
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">Postęp sylwetki</p>
            <h2 className="mt-1 font-display text-[18px] font-black tracking-tight text-text-primary">Transformacja</h2>
          </div>
          <label className="cursor-pointer flex h-11 w-11 items-center justify-center rounded-2xl border border-border-custom bg-surface text-text-secondary transition-all hover:bg-primary hover:border-primary hover:text-white shadow-sm">
            {uploading ? <div className="animate-spin h-4 w-4 border-2 border-text-muted/30 border-t-primary rounded-full" /> : <Camera size={17} />}
            <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
          </label>
        </div>

        {/* Comparison */}
        <div className="relative aspect-[4/5] bg-surface-solid border-t border-border-custom overflow-hidden">
          <div className="absolute inset-0 flex">
            {/* Baza (Left) */}
            <div className="relative flex-1 border-r border-border-custom overflow-hidden">
              {basePhoto ? (
                <>
                  <img src={basePhoto.image_url} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute top-4 left-4 bg-surface/80 backdrop-blur-md px-3 py-1 rounded-full border border-border-custom shadow-sm">
                    <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Baza: {format(parseISO(basePhoto.date), 'dd.MM.yy')}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[10px] font-black text-text-muted uppercase">Wybierz bazę</div>
              )}
            </div>

            {/* Cel (Right) */}
            <div className="relative flex-1 overflow-hidden">
              {targetPhoto ? (
                <>
                  <img src={targetPhoto.image_url} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 bg-primary/10 backdrop-blur-md px-3 py-1 rounded-full border border-primary/25">
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest">Cel: {format(parseISO(targetPhoto.date), 'dd.MM.yy')}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[10px] font-black text-text-muted uppercase">Wybierz cel</div>
              )}
            </div>
          </div>

          {/* VS Badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="bg-surface/90 backdrop-blur-xl border border-border-custom w-11 h-11 rounded-full flex items-center justify-center shadow-md">
              <span className="text-[10px] font-black text-text-primary">VS</span>
            </div>
          </div>

          {/* Dni Progresu Badge */}
          {daysDiff > 0 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-primary text-white px-5 py-1.5 rounded-full shadow-lg shadow-primary/25">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap">+{daysDiff} dni postępu</p>
            </div>
          )}
        </div>
      </div>

      {/* Oś czasu */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">Oś czasu</p>
          <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider">Dotknij by zestawić</p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((photo) => {
            const isBase = photo.id === baseId;
            const isTarget = photo.id === targetId;

            return (
              <div key={photo.id} className="snap-start shrink-0 space-y-2">
                <button
                  onClick={() => handleSelect(photo.id)}
                  className={`relative w-[88px] aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all duration-300 cursor-pointer ${isBase ? 'border-primary scale-[1.04] shadow-md shadow-primary/20' : isTarget ? 'border-primary/50 scale-[1.04] shadow-sm' : 'border-border-custom opacity-50 hover:opacity-80'}`}
                >
                  <img src={photo.image_url} className={`w-full h-full object-cover ${!isBase && !isTarget ? 'grayscale' : ''}`} />
                  {(isBase || isTarget) && (
                    <div className="absolute inset-0 flex items-end justify-center pb-2">
                      <span className="text-[8px] font-black text-white uppercase bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                        {isBase ? 'Baza' : 'Cel'}
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex justify-between items-center px-0.5">
                  <span className={`text-[9px] font-bold ${isBase || isTarget ? 'text-primary' : 'text-text-secondary'}`}>
                    {format(parseISO(photo.date), 'dd.MM')}
                  </span>
                  <button onClick={() => deletePhoto(photo.id, photo.image_url)} className="text-text-muted hover:text-rose-500 transition-colors p-1 rounded-lg hover:bg-rose-500/5 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
