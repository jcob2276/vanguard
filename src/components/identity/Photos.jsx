import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Camera } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function Photos({ session }) {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [photoDate, setPhotoDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }));
  
  // Selection logic for comparison
  const [baseId, setBaseId] = useState(null);
  const [targetId, setTargetId] = useState(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

  async function fetchPhotos() {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .order('date', { ascending: true });
    
    if (data && data.length > 0) {
      setPhotos(data);
      // Domyślnie ustawiamy pierwsze i ostatnie
      setBaseId(data[0].id);
      setTargetId(data[data.length - 1].id);
    }
    setLoading(false);
  }

  const basePhoto = photos.find(p => p.id === baseId);
  const targetPhoto = photos.find(p => p.id === targetId);
  
  const daysDiff = (basePhoto && targetPhoto) 
    ? Math.abs(differenceInDays(parseISO(targetPhoto.date), parseISO(basePhoto.date))) 
    : 0;

  function handleSelect(id) {
    if (id === baseId) return; 
    if (id === targetId) {
      setTargetId(null);
      return;
    }
    setTargetId(id);
  }

  async function uploadPhoto(e) {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileName = `${session.user.id}/${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('progress-photos').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
      await supabase.from('progress_photos').insert({ 
        user_id: session.user.id, 
        image_url: publicUrl, 
        date: photoDate 
      });
      fetchPhotos();
    } catch (error) {
      alert('Błąd: ' + error.message);
    } finally { setUploading(false); }
  }

  async function deletePhoto(id, url) {
    if (!confirm('Usunąć?')) return;
    const fileName = `${session.user.id}/${url.split('/').pop()}`;
    await supabase.storage.from('progress-photos').remove([fileName]);
    await supabase.from('progress_photos').delete().eq('id', id);
    fetchPhotos();
  }

  if (loading) return <div className="p-8 text-center text-neutral-500 uppercase font-black animate-pulse">Wczytywanie Analizy Wizualnej...</div>;

  return (
    <div className="flex-1 p-6 space-y-8 pb-24">
      
      {/* HEADER */}
      <header className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter leading-none">Visual Protocol</h2>
          <p className="text-[9px] text-primary font-black uppercase tracking-[0.3em]">Transformacja Fizyczna</p>
        </div>
        <label className="cursor-pointer bg-neutral-900 border border-white/10 text-white p-3 rounded-2xl hover:bg-primary hover:border-primary transition-all shadow-xl">
          {uploading ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" /> : <Camera size={20} />}
          <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
        </label>
      </header>

      {/* COMPARISON ENGINE */}
      <section className="space-y-6">
        <div className="relative aspect-[4/5] bg-neutral-950 rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
          {/* Comparison Layer */}
          <div className="absolute inset-0 flex">
            {/* Base (Left) */}
            <div className="relative flex-1 border-r border-white/10 group overflow-hidden">
              {basePhoto ? (
                <>
                  <img src={basePhoto.image_url} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <p className="text-[8px] font-black text-white/60 uppercase tracking-widest">Base: {format(parseISO(basePhoto.date), 'dd.MM.yy')}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[10px] font-black text-white/10 uppercase italic">Wybierz bazę</div>
              )}
            </div>

            {/* Target (Right) */}
            <div className="relative flex-1 group overflow-hidden">
              {targetPhoto ? (
                <>
                  <img src={targetPhoto.image_url} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 bg-primary/20 backdrop-blur-md px-3 py-1 rounded-full border border-primary/30">
                    <p className="text-[8px] font-black text-primary uppercase tracking-widest">Target: {format(parseISO(targetPhoto.date), 'dd.MM.yy')}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[10px] font-black text-white/10 uppercase italic">Wybierz cel</div>
              )}
            </div>
          </div>

          {/* Center Badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-[10px] font-black text-white italic">VS</span>
            </div>
          </div>

          {/* Bottom Metric */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-2 rounded-full shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">+{daysDiff} Dni Progresu</p>
          </div>
        </div>
      </section>

      {/* TIMELINE (Interactive Selection) */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Timeline Transformacji</h3>
          <p className="text-[8px] font-bold text-neutral-600 uppercase">Kliknij aby zestawić</p>
        </div>
        
        <div className="flex gap-4 overflow-x-auto pb-6 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((photo) => {
            const isBase = photo.id === baseId;
            const isTarget = photo.id === targetId;

            return (
              <div key={photo.id} className="snap-start shrink-0 space-y-2">
                <button 
                  onClick={() => handleSelect(photo.id)}
                  className={`relative w-24 aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all duration-500 ${isBase ? 'border-white scale-105 z-10' : isTarget ? 'border-primary scale-105 z-10 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-white/5 opacity-40 hover:opacity-100'}`}
                >
                  <img src={photo.image_url} className={`w-full h-full object-cover ${!isBase && !isTarget && 'grayscale hover:grayscale-0'}`} />
                  {(isBase || isTarget) && (
                    <div className={`absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]`}>
                      <span className="text-[9px] font-black text-white uppercase bg-black/40 px-2 py-1 rounded border border-white/20">
                        {isBase ? 'BASE' : 'TARGET'}
                      </span>
                    </div>
                  )}
                </button>
                <div className="flex justify-between items-center px-1">
                  <span className={`text-[8px] font-black ${isBase || isTarget ? 'text-white' : 'text-neutral-700'}`}>
                    {format(parseISO(photo.date), 'dd.MM')}
                  </span>
                  <button onClick={() => deletePhoto(photo.id, photo.image_url)} className="text-neutral-800 hover:text-red-500 transition-colors">
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* DATE PICKER FOR UPLOAD */}
      <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Data nowego wpisu</p>
        <input 
          type="date" 
          value={photoDate} 
          onChange={(e) => setPhotoDate(e.target.value)} 
          className="bg-transparent text-[11px] font-black text-primary uppercase outline-none" 
        />
      </div>

    </div>
  );
}
