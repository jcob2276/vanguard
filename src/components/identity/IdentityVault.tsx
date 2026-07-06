import { useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { Shield, Save, Heart, Ghost, Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tables } from '../../lib/database.types';

const colorMap = {
  'purple-500': { 
    bg: 'bg-purple-500/8 dark:bg-purple-500/15', 
    border: 'border-purple-500/15 dark:border-purple-500/30', 
    text: 'text-purple-600 dark:text-purple-400' 
  },
  'rose-500': { 
    bg: 'bg-rose-500/8 dark:bg-rose-500/15', 
    border: 'border-rose-500/15 dark:border-rose-500/30', 
    text: 'text-rose-600 dark:text-rose-400' 
  },
  'orange-500': { 
    bg: 'bg-orange-500/8 dark:bg-orange-500/15', 
    border: 'border-orange-500/15 dark:border-orange-500/30', 
    text: 'text-orange-600 dark:text-orange-400' 
  }
};

type VaultField = keyof Pick<Tables<'user_fundament'>, 'vision' | 'identity' | 'knowledge' | 'relationships' | 'philosophy' | 'finances' | 'work_edu'>;
type VaultState = Record<string, string>;

const emptyVault: VaultState = {
  vision: '',
  identity: '',
  knowledge: '',
  relationships: '',
  philosophy: '',
  finances: '',
  work_edu: '',
};

export default function IdentityVault({ session: sessionProp }: { session?: Session | null }) {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [vault, setVault] = useState<VaultState>({
    identity: '',   // JA
    philosophy: '', // CIAŁO
    finances: '',   // ZASOBY
  });

  useEffect(() => {
    const resolveUser = async () => {
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
          work_edu: data.work_edu || ''
        });
      }
    } catch (err: unknown) {
      console.error('[Background Error]', err);
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
      const nonEmpty = Object.fromEntries(
        Object.entries(vault).filter(([_, v]) => v.trim() !== '')
      );
      if (Object.keys(nonEmpty).length === 0) { setLoading(false); return; }

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
      
      const { error: dbError } = await supabase
        .from('user_fundament')
        .upsert({
          user_id: uid,
          ...nonEmpty,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (dbError) throw dbError;

      setSaveStatus('success');
      setVault({ identity: '', philosophy: '', finances: '', vision: '', knowledge: '', relationships: '', work_edu: '' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: unknown) {
      console.error('Save error:', err);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const Section = ({ title, icon: Icon, field, placeholder, description, color }: { title: string; icon: LucideIcon; field: VaultField; placeholder: string; description: ReactNode; color: keyof typeof colorMap }) => {
    const themeStyles = colorMap[color] || colorMap['purple-500'];
    return (
      <div className="bg-surface border border-border-custom rounded-[24px] p-5 space-y-4 hover:border-primary/20 transition-all shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${themeStyles.bg} border ${themeStyles.border}`}>
            <Icon size={18} className={themeStyles.text} />
          </div>
          <div>
            <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">{title}</h3>
            <p className="text-[10px] text-text-muted uppercase tracking-widest">{description}</p>
          </div>
        </div>
        <textarea
          value={vault[field]}
          onChange={(e) => setVault(prev => ({ ...prev, [field]: e.target.value }))}
          placeholder={placeholder}
          className="w-full bg-surface-solid border border-border-custom rounded-2xl p-4 text-[12.5px] font-bold text-text-primary min-h-[120px] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] outline-none transition-all placeholder:text-text-muted/40"
        />
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Shield size={16} className="text-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Identity Vault v3.1</span>
          </div>
          <h1 className="text-3xl font-display font-black text-text-primary tracking-tight uppercase">Pełny Profil Bliźniaka</h1>
          <p className="text-text-secondary text-xs mt-1 font-semibold leading-relaxed">Wpisz tu wszystko, co Wyrocznia powinna o Tobie wiedzieć.</p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={loading}
          className={`px-8 py-3.5 rounded-2xl font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-md disabled:opacity-50 font-display cursor-pointer ${
            saveStatus === 'success' 
              ? 'bg-green-500 text-white shadow-green-500/20' 
              : 'bg-primary text-white hover:bg-primary-hover shadow-primary/20'
          }`}
        >
          {loading ? 'Synchronizacja...' : saveStatus === 'success' ? '✓ Zapisano!' : <><Save size={16} /> Zaktualizuj Prawdę</>}
        </button>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-500/5 dark:bg-green-500/10 border border-green-500/25 text-green-600 dark:text-green-400 p-4 rounded-2xl text-[11px] font-bold uppercase tracking-wider text-center animate-in zoom-in-95">
          Fundament Zaktualizowany. Bliźniak właśnie stał się mądrzejszy.
        </div>
      )}

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 gap-4.5">
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
