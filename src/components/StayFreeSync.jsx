import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Activity, Check, AlertCircle, Upload, RefreshCw } from 'lucide-react';

const MONTHS_MAP = {
  'stycznia': '01', 'lutego': '02', 'marca': '03', 'kwietnia': '04',
  'maja': '05', 'czerwca': '06', 'lipca': '07', 'sierpnia': '08',
  'września': '09', 'października': '10', 'listopada': '11', 'grudnia': '12'
};

export default function StayFreeSync({ session }) {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const parseStayFreeTime = (timeStr) => {
    if (!timeStr || timeStr === '0s' || timeStr === 'NaN') return 0;
    const hoursMatch = timeStr.match(/(\d+)g/);
    const minutesMatch = timeStr.match(/(\d+)m/);
    const secondsMatch = timeStr.match(/(\d+)s/);
    let totalSeconds = 0;
    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
    if (minutesMatch) totalSeconds += parseInt(minutesMatch[1]) * 60;
    if (secondsMatch) totalSeconds += parseInt(secondsMatch[1]);
    return totalSeconds;
  };

  const cleanDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.trim().split(' ');
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const month = MONTHS_MAP[parts[1]] || '01';
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleSync = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setStatus(null);

    try {
      let records = [];
      let sanitizedText = csvText.trim();

      // Check if it's JSON
      if (sanitizedText.startsWith('[') || sanitizedText.startsWith('{')) {
        // Fix for common Python/Pandas NaN issue in JSON - more aggressive regex
        sanitizedText = sanitizedText.replace(/:\s?(NaN|undefined|null)/g, ': null');
        sanitizedText = sanitizedText.replace(/,\s?(NaN|undefined|null)/g, ', null');
        
        const jsonData = JSON.parse(sanitizedText);
        records = Array.isArray(jsonData) ? jsonData : [jsonData];
        // Ensure user_id is set and handle nulls for required fields
        records = records.map(r => ({ 
          ...r, 
          user_id: session.user.id,
          app_name: r.app_name || 'Nieznana aplikacja',
          device_name: r.device_name || 'Nieznane urządzenie'
        }));
      } else {
        // More robust CSV Parsing logic for basic quoted strings
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else current += char;
          }
          result.push(current.trim());
          return result;
        };

        const rawLines = csvText.trim().split('\n');
        if (rawLines.length < 2) throw new Error('Nieprawidłowy format pliku CSV.');
        
        const headers = parseCSVLine(rawLines[0]);
        const dateColumns = headers.slice(2).filter(h => h && h !== 'Zużycie łącznie');

        for (let i = 1; i < rawLines.length; i++) {
          const row = parseCSVLine(rawLines[i]);
          if (row.length < 3) continue;
          const appName = row[0]?.replace(/^"|"$/g, '');
          const deviceName = row[1]?.replace(/^"|"$/g, '');
          if (!appName || !deviceName) continue;

          dateColumns.forEach((dateLabel, colIdx) => {
            const timeRaw = row[colIdx + 2];
            const seconds = parseStayFreeTime(timeRaw);
            const isoDate = cleanDate(dateLabel);
            if (seconds > 0 && isoDate) {
              records.push({
                user_id: session.user.id,
                date: isoDate,
                app_name: appName,
                device_name: deviceName,
                duration_seconds: seconds,
                category: 'uncategorized'
              });
            }
          });
        }
      }

      if (records.length === 0) throw new Error('Nie znaleziono danych.');

      const CHUNK_SIZE = 500;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
          .from('screen_time_details')
          .upsert(chunk, { 
            onConflict: 'user_id,date,app_name,device_name',
            ignoreDuplicates: false 
          });
        if (error) throw error;
      }

      setStatus({ type: 'success', message: `Zsynchronizowano ${records.length} wpisów!` });
      setCsvText('');
    } catch (err) {
      console.error('Sync Error:', err);
      setStatus({ type: 'error', message: err.message || 'Wystąpił nieoczekiwany błąd.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Activity size={20} className="text-primary" />
        <h2 className="text-xs font-black text-white uppercase tracking-widest italic">StayFree Digital Sync</h2>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed">
          Wybierz plik .json (wygenerowany Pythonem) lub wklej surowy CSV ze StayFree.
        </p>
        
        <input 
          type="file" 
          accept=".json,.csv,.txt"
          onChange={handleFileUpload}
          className="block w-full text-[10px] text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
        />
      </div>

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder="Lub wklej treść tutaj..."
        className="w-full h-32 bg-black border border-neutral-800 rounded-xl p-4 text-[11px] text-neutral-400 font-mono focus:border-primary/50 transition-colors outline-none"
      />

      <button
        onClick={handleSync}
        disabled={loading || !csvText.trim()}
        className="w-full btn-primary py-3 flex items-center justify-center gap-2 group disabled:opacity-50"
      >
        {loading ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Upload size={14} className="group-hover:-translate-y-0.5 transition-transform" />
        )}
        <span className="text-[10px] font-black uppercase tracking-widest">
          {loading ? 'Przetwarzanie...' : 'Rozpocznij Synchronizację'}
        </span>
      </button>

      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border ${status.type === 'success' ? 'bg-dayC/10 border-dayC/30 text-dayC' : 'bg-dayB/10 border-dayB/30 text-dayB'}`}>
          {status.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          <p className="text-[10px] font-bold uppercase">{status.message}</p>
        </div>
      )}
    </div>
  );
}
