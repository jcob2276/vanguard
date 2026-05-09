import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Camera } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function Photos({ session }) {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchPhotos();
  }, []);

  async function fetchPhotos() {
    const { data } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: true }); // Ascending to get oldest first
    if (data) setPhotos(data);
    setLoading(false);
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

  if (loading) return <div className="p-8 text-center text-neutral-500 uppercase font-black">Wczytywanie...</div>;

  const oldest = photos.length > 0 ? photos[0] : null;
  const newest = photos.length > 1 ? photos[photos.length - 1] : null;

  return (
    <div className="flex-1 p-6 space-y-10 pb-24">
      
      {/* Header & Upload */}
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Transformacja</h2>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Dzień 1 vs Dzisiaj</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={photoDate} 
            onChange={(e) => setPhotoDate(e.target.value)} 
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-[10px] font-black text-white outline-none" 
          />
          <label className="cursor-pointer bg-primary text-white p-3 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
            {uploading ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" /> : <Camera size={24} />}
            <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={uploading} />
          </label>
        </div>
      </header>

      {/* Main Comparison */}
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {/* Oldest Photo */}
          <div className="space-y-2">
            <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest ml-1">Tydzień 1</span>
            <div className="aspect-[3/4] bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 relative">
              {oldest ? (
                <>
                  <img src={oldest.image_url} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] font-black text-white uppercase">{format(parseISO(oldest.date), 'dd.MM.yyyy')}</p>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-700 font-black uppercase">Brak zdjęcia</div>
              )}
            </div>
          </div>

          {/* Newest Photo */}
          <div className="space-y-2">
            <span className="text-[8px] font-black text-primary uppercase tracking-widest ml-1">Aktualne</span>
            <div className="aspect-[3/4] bg-neutral-900 rounded-2xl overflow-hidden border border-primary relative shadow-[0_0_30px_rgba(59,130,246,0.1)]">
              {newest ? (
                <>
                  <img src={newest.image_url} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] font-black text-white uppercase">{format(parseISO(newest.date), 'dd.MM.yyyy')}</p>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-700 font-black uppercase italic">Dodaj nowe...</div>
              )}
            </div>
          </div>
        </div>
        
        {(!oldest || !newest) && (
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl text-center">
            <p className="text-[10px] font-bold text-neutral-500 uppercase">Potrzebujesz min. 2 zdjęć, aby zobaczyć porównanie.</p>
          </div>
        )}
      </section>

      {/* History List (Small & Tidy) */}
      <section className="space-y-4 pt-4 border-t border-neutral-900">
        <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Wszystkie zdjęcia</h3>
        <div className="flex gap-4 overflow-x-auto pb-8 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.map((photo) => (
            <div key={photo.id} className="snap-center shrink-0 w-32 space-y-2 relative group">
              <div className="aspect-[3/4] rounded-lg overflow-hidden border border-neutral-800">
                <img src={photo.image_url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-bold text-neutral-600">{format(parseISO(photo.date), 'dd.MM')}</span>
                <button onClick={() => deletePhoto(photo.id, photo.image_url)} className="text-neutral-700 hover:text-red-500 transition-colors">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
