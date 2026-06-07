import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Save, Heart, Ghost, Briefcase } from 'lucide-react';

export default function IdentityVault({ session: sessionProp }) {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [userId, setUserId] = useState(null);

  const [vault, setVault] = useState({
    identity: '',   // JA
    philosophy: '', // CIAŁO
    finances: '',   // ZASOBY
  });

  useEffect(() => {
    const resolveUser = async () => {
      // Najpierw prop, potem bezpośrednie zapytanie do Supabase
      const id = sessionProp?.user?.id ?? (await supabase.auth.getUser()).data?.user?.id;
      if (id) setUserId(id);
    };
    resolveUser();
  }, [sessionProp?.user?.id]);

  const fetchVault = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('user_fundament')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (data) {
        setVault({
          vision: data.vision || '',
          identity: data.identity || '',
          knowledge: data.knowledge || '',
          relationships: data.relationships || '',
          philosophy: data.philosophy || '',
          finances: data.finances || '',
          work_edu: data.work_edu || '' // Zakładając, że kolumna istnieje lub trafi do JSONa
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchVault();
  }, [fetchVault, userId]);

  const handleSave = async () => {
    let uid = userId;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data?.user?.id ?? null;
    }
    if (!uid) return;
    setLoading(true);
    setSaveStatus(null);
    try {
      // Tylko niepuste pola
      const nonEmpty = Object.fromEntries(
        Object.entries(vault).filter(([_, v]) => v.trim() !== '')
      );
      if (Object.keys(nonEmpty).length === 0) { setLoading(false); return; }

      // Każda kategoria → ingest-vault-log (chunking + embedding + graph)
      let totalChunks = 0;
      let totalTriads = 0;
      for (const [category, text] of Object.entries(nonEmpty)) {
        const { data, error } = await supabase.functions.invoke('ingest-vault-log', {
          body: { userId: uid, category, text }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        totalChunks += data?.chunks ?? 0;
        totalTriads += data?.triads ?? 0;
      }
      console.debug(`[VAULT] Ingested ${totalChunks} chunks, ${totalTriads} triads`);
      setSaveStatus('success');
      setVault({ identity: '', philosophy: '', finances: '' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const Section = ({ title, icon: Icon, field, placeholder, description, color }) => (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-4 hover:border-neutral-700 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}/10 border border-${color}/20`}>
          <Icon size={18} className={`text-${color}`} />
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight">{title}</h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{description}</p>
        </div>
      </div>
      <textarea
        value={vault[field]}
        onChange={(e) => setVault(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-xs text-neutral-300 min-h-[120px] focus:border-primary/30 outline-none transition-all placeholder:text-neutral-800"
      />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Identity Vault v3.1</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">Pełny Profil Bliźniaka</h1>
          <p className="text-neutral-500 text-sm mt-2 font-medium italic">Wpisz tu wszystko, co Wyrocznia powinna o Tobie wiedzieć.</p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={loading}
          className={`px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 ${saveStatus === 'success' ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-primary text-black shadow-primary/20'}`}
        >
          {loading ? 'Synchronizacja...' : saveStatus === 'success' ? '✓ Zapisano!' : <><Save size={16} /> Zaktualizuj Prawdę</>}
        </button>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl text-xs font-black uppercase text-center animate-in zoom-in-95">
          Fundament Zaktualizowany. Bliźniak właśnie stał się mądrzejszy.
        </div>
      )}

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 gap-6">
        <Section
          title="JA"
          icon={Ghost}
          field="identity"
          color="purple-500"
          description="Tożsamość, relacje, psychologia, cienie, misja"
          placeholder="Kim jesteś? Twoje wartości, lęki, relacje, cienie, misja życiowa, wzorce zachowań, sesje terapeutyczne, refleksje..."
        />
        <Section
          title="CIAŁO"
          icon={Heart}
          field="philosophy"
          color="rose-500"
          description="Trening, żywienie, biometria, zdrowie"
          placeholder="Plany treningowe, wyniki badań, dane z Oury, żywienie, pomiary, suplementacja, samopoczucie fizyczne..."
        />
        <Section
          title="ZASOBY"
          icon={Briefcase}
          field="finances"
          color="orange-500"
          description="Praca, studia, finanse, projekty"
          placeholder="Projekty, zarobki, cele finansowe, postępy na studiach, umiejętności, plany biznesowe..."
        />
      </div>
    </div>
  );
}
