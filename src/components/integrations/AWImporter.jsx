import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';

const AWImporter = () => {
  const [isImporting, setIsImporting] = useState(false);
  const { session } = useStore();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !session) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // ActivityWatch export zawiera 'buckets'
        const buckets = data.buckets || {};
        const allEvents = [];

        for (const bucketId in buckets) {
          const events = buckets[bucketId].events || [];
          events.forEach(ev => {
            // Próbujemy wyciągnąć czytelną nazwę aplikacji/strony
            const appName = ev.data.app || ev.data.title || 'Inna aktywność';
            
            allEvents.push({
              user_id: session.user.id,
              category: 'activitywatch_mobile',
              payload: {
                bucket: bucketId,
                app: appName,
                title: ev.data.title || null,
                url: ev.data.url || null,
                duration: ev.duration,
                timestamp: ev.timestamp
              },
              timestamp: ev.timestamp
            });
          });
        }

        // Batch insert do Supabase (limitujemy do ostatnich 500 zdarzeń dla wydajności)
        const latestEvents = allEvents
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 500);

        const { error } = await supabase.from('vanguard_footprint').insert(latestEvents);

        if (error) throw error;
        alert(`Zaimportowano ${latestEvents.length} zdarzeń z telefonu!`);
      } catch (err) {
        console.error('Import Error:', err);
        alert('Błąd formatu pliku ActivityWatch.');
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        📱 Import z Telefonu (AW)
      </h3>
      <p className="text-slate-400 text-sm mb-4">
        Wyeksportuj dane z aplikacji ActivityWatch na Androidzie i wrzuć tutaj plik JSON.
      </p>
      
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <span className="text-2xl mb-2">📥</span>
          <p className="text-sm text-slate-300">
            {isImporting ? 'Przetwarzanie...' : 'Kliknij, aby wybrać plik .json'}
          </p>
        </div>
        <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} disabled={isImporting} />
      </label>
    </div>
  );
};

export default AWImporter;
