import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { VanguardCore, computeSignals } from '../lib/vanguardCore';
import { ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

export default function AIInsight({ session }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchInsight() {
    if (!session?.user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const core = new VanguardCore(session.user.id, supabase);
      
      // UNIFIED FETCH PIPELINE
      const [stayfreeRes, latestOuraRes, powerListRes, historyRes] = await Promise.all([
        supabase.from('stayfree_usage').select('*').eq('user_id', session.user.id).eq('date', today),
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('daily_wins').select('*').eq('user_id', session.user.id).eq('date', today).maybeSingle(),
        supabase.from('vanguard_daily_aggregates').select('*').eq('user_id', session.user.id).order('date', { ascending: true })
      ]);

      const stayfreeToday = stayfreeRes.data || [];
      const latestOura = latestOuraRes.data;
      const powerListToday = powerListRes.data;
      const history = historyRes.data || [];

      // 1. CALCULATE SIGNALS & STATE
      const currentMetrics = computeSignals(stayfreeToday, latestOura, powerListToday);
      const personalBaseline = await core.getPersonalBaseline();
      const vanguardState = await core.determineState(currentMetrics, personalBaseline);

      // 2. CONSTRUCT STATE VECTOR (High Density)
      const stateVector = {
        state: vanguardState,
        confidence: stayfreeToday.length > 0 && latestOura ? 0.9 : 0.6,
        now: new Date().toISOString(),
        metrics: {
          execution: currentMetrics.execution_ratio || 0,
          biological: {
            sleep_z: currentMetrics.sleep ? (currentMetrics.sleep - personalBaseline.means.sleep) / (personalBaseline.stdDevs.sleep || 1) : 0,
            hrv_z: currentMetrics.hrv ? (currentMetrics.hrv - personalBaseline.means.hrv) / (personalBaseline.stdDevs.hrv || 1) : 0,
            readiness: currentMetrics.readiness || 0
          },
          digital: {
            dopamine_z: currentMetrics.dopamine_load ? (currentMetrics.dopamine_load - personalBaseline.means.dopamine_load) / (personalBaseline.stdDevs.dopamine_load || 1) : 0,
            fragmentation_z: currentMetrics.fragmentation ? (currentMetrics.fragmentation - personalBaseline.means.fragmentation) / (personalBaseline.stdDevs.fragmentation || 1) : 0,
            screen_time: currentMetrics.screen_time_min || 0
          }
        },
        lag_correlations: core.detectLagCorrelations(history),
        predictions: await core.computePredictions(currentMetrics, history, personalBaseline),
        goal_alignment: core.calculateGoalAlignment(powerListToday),
        identity_vault: await core.evaluateIdentityVault() 
      };

      // 3. INVOKE ORACLE
      const { data, error: functionError } = await supabase.functions.invoke('vanguard-oracle', {
        body: {
          state_vector: stateVector,
          user_id: session.user.id
        }
      });

      if (functionError) throw functionError;
      if (data?.text) setInsight(data.text);
      
    } catch (err) {
      console.error('Vanguard Oracle Error:', err);
      setError(`Błąd systemu: ${err.message || 'Brak odpowiedzi od Wyroczni.'}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInsight();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={14} className="text-neutral-700 animate-spin" />
          <div className="h-2 w-24 bg-neutral-800 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-neutral-800 rounded"></div>
          <div className="h-3 w-2/3 bg-neutral-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!insight && !error) return null;

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-1000"></div>

        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary animate-pulse" />
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest italic">System Mirror Mode</h3>
          </div>
          <button
            onClick={fetchInsight}
            className="text-neutral-600 hover:text-white transition-colors"
            title="Odśwież analizę"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 text-neutral-600">
            <ShieldAlert size={14} />
            <p className="text-[11px] font-bold uppercase italic">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-[14px] font-normal text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {(() => {
                if (!insight) return null;
                const keywords = [
                  'CO SIĘ DZIEJE', 'DLACZEGO', 'CO TO OZNACZA', 'ROZKAZ OPERACYJNY',
                  'CHAOS', 'LOCKED_IN', 'AVOIDANCE', 'STABLE', 'MOMENTUM', 'RECOVERY', 'CONSUMING'
                ];
                const regex = new RegExp(`(${keywords.join('|')})`, 'g');
                return insight.split(regex).map((part, i) =>
                  keywords.includes(part) ? <span key={i} className="text-primary font-black uppercase tracking-tight">{part}</span> : part
                );
              })()}
            </div>
            <div className="pt-4 border-t border-white/5">
              <p className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.2em]">Strategiczny Obserwator v2.0 (STATE_VECTOR)</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
