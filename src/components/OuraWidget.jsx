import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { syncOuraData } from '../lib/oura';
import { Battery, Moon, Footprints, Star, RefreshCw, Key, Plus, Activity, Thermometer, Zap } from 'lucide-react';
import { VanguardCore } from '../lib/vanguardCore';

const TrendArrow = ({ current, previous, better = 'up' }) => {
  if (previous === undefined || previous === null || current === undefined || current === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="ml-1 text-neutral-500">→</span>;
  const isImproving = better === 'up' ? diff > 0 : diff < 0;
  return <span className={`ml-1 font-black ${isImproving ? 'text-dayC' : 'text-dayB'}`}>{diff > 0 ? '↑' : '↓'}</span>;
};

export default function OuraWidget({ session }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [baselineMeans, setBaselineMeans] = useState(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tempToken, setTempToken] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: userSettings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      if (!settingsError) {
        setSettings(userSettings);
      }

      const { data: summaries, error: summaryError } = await supabase
        .from('oura_daily_summary')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(2);
      
      if (!summaryError && summaries) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayRecord = summaries.find(s => s.date === todayStr);
        const yesterdayRecord = summaries.find(s => s.date !== todayStr);
        
        setData({
          today: todayRecord || null,
          yesterday: yesterdayRecord || null
        });
      }

      // Pobierz rolling baseline (90 dni) do relativnych thresholdów
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data: aggHistory } = await supabase
        .from('vanguard_daily_aggregates')
        .select('hrv_avg, sleep_hours')
        .eq('user_id', session.user.id)
        .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
        .not('hrv_avg', 'is', null);

      if (aggHistory && aggHistory.length >= 5) {
        const hrvVals = aggHistory.map(d => d.hrv_avg).filter(Boolean);
        const sleepVals = aggHistory.map(d => d.sleep_hours).filter(Boolean);
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        setBaselineMeans({ hrv: mean(hrvVals), sleep: mean(sleepVals) });
      }
    } catch (err) {
      console.error('Error fetching Oura data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!settings?.oura_token) {
      setShowTokenInput(true);
      return;
    }

    setSyncing(true);
    const res = await syncOuraData(session.user.id, settings.oura_token);
    if (res.success) {
      await fetchData();
    } else {
      alert('Błąd synchronizacji: ' + res.error);
    }
    setSyncing(false);
  }

  async function saveToken() {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: session.user.id, oura_token: tempToken });
    
    if (error) alert(error.message);
    else {
      setShowTokenInput(false);
      setSettings({ ...settings, oura_token: tempToken });
      alert('Token zapisany!');
    }
  }

  if (loading) return null;

  if (!settings?.oura_token && !showTokenInput) {
    return (
      <button 
        onClick={() => setShowTokenInput(true)}
        className="flex w-full items-center justify-between rounded-lg border border-dashed border-white/[0.1] bg-neutral-950/60 p-4 text-white/40 transition-colors hover:text-white"
      >
        <div className="flex items-center gap-3">
          <Key size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Połącz z Oura Ring</span>
        </div>
        <Plus size={16} />
      </button>
    );
  }

  if (showTokenInput) {
    return (
      <div className="space-y-4 rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/35">Konfiguracja Oura PAT</h3>
        <input 
          type="password" 
          value={tempToken}
          onChange={e => setTempToken(e.target.value)}
          placeholder="Wklej Personal Access Token..."
          className="input"
        />
        <div className="flex gap-2">
          <button onClick={saveToken} className="btn-primary flex-1 py-2 text-[10px]">Zapisz</button>
          <button onClick={() => setShowTokenInput(false)} className="btn-outline flex-1 py-2 text-[10px]">Anuluj</button>
        </div>
      </div>
    );
  }

  const activeOura = data?.today?.hrv_avg ? data.today : (data?.yesterday || {});
  const activeReadiness = data?.today?.readiness_score || data?.yesterday?.readiness_score;
  const activeSteps = data?.today?.steps !== null ? data.today : data?.yesterday;

  const sleepHours = Math.floor(activeOura?.total_sleep_hours || 0);
  const sleepMinutes = Math.round(((activeOura?.total_sleep_hours || 0) % 1) * 60);

  const insights = VanguardCore.translateBiometrics(activeOura, baselineMeans);

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700">
      
      {/* Readiness Widget */}
      <section className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(10,10,11,0.96))] p-5 shadow-2xl shadow-black/30">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Battery size={18} className={activeReadiness < 70 ? 'text-red-500' : 'text-primary'} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Oura baseline</h3>
          </div>
          <button onClick={handleSync} disabled={syncing} className={`rounded-md p-1 text-white/30 hover:bg-white/[0.06] hover:text-white ${syncing ? 'animate-spin' : ''}`}>
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="mb-5 flex items-end gap-4">
          <span className="text-[42px] font-black tracking-tighter text-white">
            {activeReadiness || '--'}
            <TrendArrow current={data?.today?.readiness_score} previous={data?.yesterday?.readiness_score} />
          </span>
          <div className="pb-1">
            {activeReadiness ? (
              (() => {
                const isDownTrend = data?.today?.readiness_score < data?.yesterday?.readiness_score;
                if (activeReadiness >= 85 && !isDownTrend) {
                  return <p className="text-[10px] font-black uppercase tracking-wider text-dayC">Peak Performance</p>;
                } else if (activeReadiness >= 75 && !isDownTrend) {
                  return <p className="text-[10px] font-black uppercase tracking-wider text-dayC">Gotowy na wysiłek</p>;
                } else if (activeReadiness >= 70) {
                  return <p className="text-[10px] font-black uppercase tracking-wider text-primary">Monitoruj trend</p>;
                } else {
                  return <p className="text-[10px] font-black uppercase tracking-wider text-dayB">Deload / recovery</p>;
                }
              })()
            ) : <p className="text-[10px] text-neutral-600 uppercase">Brak danych</p>}
          </div>
        </div>

        {/* Natural Language Insight */}
        {insights?.length > 0 && (
          <div className="mb-5 rounded-lg border border-dayB/15 bg-dayB/5 p-3">
             <p className="text-[10px] font-bold uppercase leading-relaxed text-dayB">
               {insights[0]}
             </p>
          </div>
        )}

        {/* High-Level Stats Grid */}
        <div className="mb-3 grid grid-cols-2 gap-3">
           <div className="rounded-lg border border-white/[0.07] bg-black/25 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-dayA" />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/32">HRV</span>
              </div>
              <p className="text-xl font-black text-white">
                {activeOura?.hrv_avg || '--'} <span className="text-[10px] text-neutral-500 not-italic ml-1">ms</span>
                <TrendArrow current={data?.today?.hrv_avg} previous={data?.yesterday?.hrv_avg} />
              </p>
           </div>
           <div className="rounded-lg border border-white/[0.07] bg-black/25 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-dayB" />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/32">RHR</span>
              </div>
              <p className="text-xl font-black text-white">
                {activeOura?.rhr_avg || '--'} <span className="text-[10px] text-neutral-500 not-italic ml-1">bpm</span>
                <TrendArrow current={data?.today?.rhr_avg} previous={data?.yesterday?.rhr_avg} better="down" />
              </p>
           </div>
        </div>

        {/* Small Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="group relative rounded-lg border border-white/[0.07] bg-black/25 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Moon size={10} className="text-dayB" />
                <span className="text-[7px] font-bold text-neutral-600 uppercase">Sen</span>
              </div>
            </div>
            <p className="text-xs font-black text-white">
              {sleepHours}h {sleepMinutes}m
            </p>
            {/* Deep/REM Overlay on hover */}
            <div className="absolute inset-0 bg-neutral-950 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center rounded-xl p-2">
               <p className="text-[8px] text-dayA font-black">DEEP: {activeOura?.deep_sleep_hours || '--'}h</p>
               <p className="text-[8px] text-primary font-black">REM: {activeOura?.rem_sleep_hours || '--'}h</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.07] bg-black/25 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Thermometer size={10} className="text-orange-500" />
                <span className="text-[7px] font-bold text-neutral-600 uppercase">Temp</span>
              </div>
            </div>
            <p className={`text-xs font-black ${Math.abs(activeOura?.temp_deviation || 0) > 0.5 ? 'text-dayB' : 'text-white'}`}>
              {activeOura?.temp_deviation > 0 ? '+' : ''}{activeOura?.temp_deviation || '0.0'}°C
            </p>
          </div>

          <div className="rounded-lg border border-white/[0.07] bg-black/25 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Footprints size={10} className="text-dayC" />
                <span className="text-[7px] font-bold text-neutral-600 uppercase">Kroki</span>
              </div>
            </div>
            <p className="text-xs font-black text-white">{activeSteps?.steps?.toLocaleString() || '--'}</p>
          </div>
        </div>
      </section>
    </div>

  );
}
