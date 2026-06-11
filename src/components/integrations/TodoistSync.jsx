import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, AlertCircle, RefreshCw, Key, CloudSync } from 'lucide-react';

export default function TodoistSync({ session }) {
  const userId = session?.user?.id;
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);

  const fetchToken = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_settings')
      .select('todoist_token')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.todoist_token) {
      setToken(data.todoist_token);
    }
  }, [userId]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const handleSaveToken = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: session.user.id, 
          todoist_token: token,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      setStatus({ type: 'success', message: 'Token zapisany poprawnie.' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-todoist', {
        body: { userId: session.user.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setStatus({ 
        type: 'success', 
        message: `Gotowe! Zsynchronizowano ${data.total} zadań (w tym ${data.synced} zmian).` 
      });
      setTimeout(() => setStatus(null), 5000);
    } catch (err) {
      console.error('Sync error:', err);
      setStatus({ type: 'error', message: err.message || 'Błąd połączenia z Edge Function.' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <CloudSync size={18} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-xs font-black text-white uppercase tracking-widest italic">Todoist Brainstorm Sync</h2>
          <p className="text-[10px] text-neutral-500 font-bold uppercase">Automatyczne wciąganie myśli do Wyroczni</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={14} />
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Todoist API Token"
            className="w-full bg-black border border-neutral-800 rounded-xl py-3 pl-10 pr-4 text-xs text-neutral-300 focus:border-red-500/50 outline-none transition-all font-mono"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSaveToken}
            disabled={loading}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw size={14} className="animate-spin mx-auto" /> : 'Zapisz Token'}
          </button>
          
          <button
            onClick={handleSync}
            disabled={syncing || !token}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {syncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Synchronizuj
          </button>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border animate-in slide-in-from-top-2 duration-300 ${status.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
          {status.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          <p className="text-[10px] font-bold uppercase">{status.message}</p>
        </div>
      )}
      
      <div className="pt-2 border-t border-white/5">
        <p className="text-[9px] text-neutral-600 font-medium leading-relaxed uppercase">
          Wszystkie aktywne zadania z Todoist trafią do Twojego "Strumienia Świadomości". 
          Wyrocznia przeanalizuje je podczas następnej rozmowy, łącząc je z Twoją biometrią i celami.
        </p>
      </div>
    </div>
  );
}
