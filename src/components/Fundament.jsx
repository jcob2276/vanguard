import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, Target, Shield, Zap, Info, Database, Brain, Fingerprint, 
  ChevronLeft, Save 
} from 'lucide-react';
import IdentityVault from './IdentityVault';

export default function Fundament({ onBack }) {
  const [identity, setIdentity] = useState({
    long_term_mission: '',
    pillars: ['', '', ''],
    avoidance_triggers: '',
    behavioral_baseline: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIdentity();
  }, []);

  async function fetchIdentity() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('vanguard_identity')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (data) {
      setIdentity({
        long_term_mission: data.long_term_mission || '',
        pillars: data.pillars || ['', '', ''],
        avoidance_triggers: data.avoidance_triggers || '',
        behavioral_baseline: data.behavioral_baseline ? JSON.stringify(data.behavioral_baseline, null, 2) : ''
      });
    }
    setLoading(false);
  }

  async function saveIdentity() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Brak aktywnej sesji.');

      let baselineJson = null;
      if (identity.behavioral_baseline) {
        try {
          baselineJson = JSON.parse(identity.behavioral_baseline);
        } catch (e) {
          throw new Error('BŁĄD FORMATU JSON: Upewnij się, że wkleiłeś poprawny kod ze skryptu Python.');
        }
      }
      
      const { error } = await supabase
        .from('vanguard_identity')
        .upsert({
          user_id: session.user.id,
          long_term_mission: identity.long_term_mission,
          pillars: identity.pillars,
          avoidance_triggers: identity.avoidance_triggers,
          behavioral_baseline: baselineJson,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      alert('IDENTYFIKACJA ZAPISANA. Digital Twin zsynchronizowany.');
    } catch (err) {
      console.error('Save Identity Error:', err);
      alert(`BŁĄD ZAPISU: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 text-neutral-500 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="font-black text-2xl text-white uppercase italic tracking-tighter">Identity Fundament</h1>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest">Digital Twin Core v2.0</p>
        </div>
      </header>

      <div className="space-y-6">
        {/* Misja */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Target size={14} className="text-primary" /> Long-Term Mission
          </h3>
          <textarea 
            value={identity.long_term_mission}
            onChange={(e) => setIdentity({...identity, long_term_mission: e.target.value})}
            placeholder="Jaki jest Twój ostateczny cel operacyjny?"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-primary min-h-[100px] transition-all"
          />
        </section>

        {/* Filary */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Shield size={14} className="text-primary" /> Identity Pillars (Kim jesteś?)
          </h3>
          <div className="space-y-2">
            {identity.pillars.map((p, i) => (
              <input 
                key={i}
                value={p}
                onChange={(e) => {
                  const n = [...identity.pillars]; n[i] = e.target.value; setIdentity({...identity, pillars: n});
                }}
                placeholder={`Filar ${i+1} (np. High-Stakes Entrepreneur)`}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-primary transition-all"
              />
            ))}
          </div>
        </section>

        {/* Triggery unikania */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <Zap size={14} className="text-red-500" /> System Drifters (Co Cię niszczy?)
          </h3>
          <textarea 
            value={identity.avoidance_triggers}
            onChange={(e) => setIdentity({...identity, avoidance_triggers: e.target.value})}
            placeholder="Wymień zachowania, które AI ma wykrywać jako błąd systemu (np. masturbacja, scrolling, brak snu)."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-red-500/50 min-h-[100px] transition-all"
          />
        </section>

        {/* Vault */}
        <div className="pt-8 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="text-primary" size={16} />
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Identity Vault (Głęboki Kontekst)</h3>
          </div>
          <p className="text-[9px] text-neutral-500 font-bold uppercase">Wgraj tutaj swoje ankiety, wyniki testów i notatki o sobie. AI będzie ich używać do każdej analizy.</p>
          <IdentityVault />
        </div>

        {/* Memory Ingest (NEW) */}
        <div className="pt-8 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="text-primary" size={16} />
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Behavioral Memory Ingest (Takeout JSON)</h3>
          </div>
          <p className="text-[9px] text-neutral-500 font-bold uppercase">Wklej tutaj wynik ze skryptu signal_engine.py. To zbuduje Twój statystyczny baseline.</p>
          <textarea 
            value={identity.behavioral_baseline}
            onChange={(e) => setIdentity({...identity, behavioral_baseline: e.target.value})}
            placeholder='{"baselineMode": "THE_BUILDER", ...}'
            className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-[10px] font-mono text-primary outline-none focus:border-primary min-h-[150px] transition-all"
          />
        </div>

        <button 
          onClick={saveIdentity}
          disabled={saving}
          className="w-full bg-primary text-white py-4 rounded-xl text-[12px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Fingerprint size={18} /> {saving ? 'SYNCHRONIZACJA...' : 'ZAPISZ CAŁY FUNDAMENT I MEMORY'}
        </button>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Brain className="text-primary mt-1" size={16} />
        <p className="text-[9px] font-bold text-neutral-400 uppercase leading-relaxed">
          Uwaga: Te dane są przekazywane bezpośrednio do AI Advisor. Bot będzie ich używał jako Twojej "Prawdy Ostatecznej" przy każdej diagnozie Mirror Mode.
        </p>
      </div>
    </div>
  );
}
