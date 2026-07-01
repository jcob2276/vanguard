import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, Sun, Clock, Eye, AlertCircle } from 'lucide-react';

type DailyLog = {
  id?: string;
  date: string;
  active_focus_minutes: number;
  screen_time_hours: number;
  outdoor_minutes: number;
  breaks_taken: number;
  snellen_left: string;
  snellen_right: string;
  snellen_both: string;
  distance_object_notes: string;
};

export default function EndMyopiaDailyLog({ onLogSaved }: { onLogSaved: () => void }) {
  const [log, setLog] = useState<DailyLog>({
    date: new Date().toISOString().split('T')[0],
    active_focus_minutes: 0,
    screen_time_hours: 0,
    outdoor_minutes: 0,
    breaks_taken: 0,
    snellen_left: '',
    snellen_right: '',
    snellen_both: '',
    distance_object_notes: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadTodayLog() {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('endmyopia_daily_logs')
        .select('*')
        .eq('date', today)
        .single();
        
      if (data) {
        setLog(data);
      }
      setLoading(false);
    }
    loadTodayLog();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setLog(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const logToSave = { ...log };
    if (!logToSave.id) {
      delete logToSave.id;
    }
    const { error } = await supabase
      .from('endmyopia_daily_logs')
      .upsert(logToSave, { onConflict: 'date' });
      
    setSaving(false);
    if (!error) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onLogSaved();
    } else {
      console.error(error);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-surface/80 border border-border-custom rounded-3xl p-6 shadow-xl w-full">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Sun className="text-emerald-500" /> Dziennik Postępów (BackTo20/20)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h4 className="font-bold text-sm uppercase text-text-muted flex items-center gap-2">
            <Clock size={16} /> Obciążenie & Nawyki
          </h4>
          
          <div>
            <label className="block text-xs text-text-muted mb-1">Całkowity Dystans (Outdoor) - Minuty</label>
            <input type="number" name="outdoor_minutes" value={log.outdoor_minutes || ''} onChange={handleChange} className="w-full bg-background border border-border-custom rounded-xl p-3 focus:ring-1 focus:ring-emerald-500" placeholder="np. 60" />
            <p className="text-[10px] text-text-muted mt-1">Czas patrzenia w dal (min. 30m interwały)</p>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Przerwy od ekranu (20-minutowe)</label>
            <input type="number" name="breaks_taken" value={log.breaks_taken || ''} onChange={handleChange} className="w-full bg-background border border-border-custom rounded-xl p-3 focus:ring-1 focus:ring-emerald-500" placeholder="Ilość przerw" />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Aktywne Skupienie (Active Focus) - Minuty</label>
            <input type="number" name="active_focus_minutes" value={log.active_focus_minutes || ''} onChange={handleChange} className="w-full bg-background border border-border-custom rounded-xl p-3 focus:ring-1 focus:ring-emerald-500" />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-sm uppercase text-text-muted flex items-center gap-2">
            <Eye size={16} /> Ostrość Wzroku (Snellen)
          </h4>
          
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Lewe</label>
              <input type="text" name="snellen_left" value={log.snellen_left || ''} onChange={handleChange} className="w-full bg-background border border-border-custom rounded-xl p-3" placeholder="20/40" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Prawe</label>
              <input type="text" name="snellen_right" value={log.snellen_right || ''} onChange={handleChange} className="w-full bg-background border border-border-custom rounded-xl p-3" placeholder="20/30" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Oboje</label>
              <input type="text" name="snellen_both" value={log.snellen_both || ''} onChange={handleChange} className="w-full bg-background border border-border-custom rounded-xl p-3" placeholder="20/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Test Obiektu w Dali (Znak drogowy, rejestracja)</label>
            <textarea name="distance_object_notes" value={log.distance_object_notes || ''} onChange={handleChange} className="w-full bg-background border border-border-custom rounded-xl p-3 h-24 resize-none" placeholder="np. Zobaczyłem rejestrację z 10 kroków ostrzej niż wczoraj..." />
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave} 
        disabled={saving || success}
        className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${success ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-primary text-background'} disabled:opacity-50`}
      >
        {success ? <><Check size={18} /> Zapisano Dziennik</> : saving ? 'Zapisywanie...' : 'Zapisz Dziennik'}
      </button>
    </div>
  );
}
