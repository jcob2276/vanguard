import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Save, Brain, Heart, Zap, Ghost, BookOpen, Briefcase, GraduationCap } from 'lucide-react';

export default function IdentityVault({ session }) {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  
  const [vault, setVault] = useState({
    vision: '', // Misja & Cele
    identity: '', // Filary
    knowledge: '', // Wiedza, umiejętności, książki
    relationships: '', // Relacje, miłość, problemy
    philosophy: '', // Cienie, prawda, fetysze, nałogi
    finances: '', // Finanse & Net Worth
    work_edu: '' // PRACA & STUDIA (Nowe!)
  });

  useEffect(() => {
    fetchVault();
  }, [session?.user?.id]);

  const fetchVault = async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('user_fundament')
        .select('*')
        .eq('user_id', session.user.id)
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
  };

  const handleSave = async () => {
    setLoading(true);
    setSaveStatus(null);
    try {
      const { error } = await supabase
        .from('user_fundament')
        .upsert({
          user_id: session.user.id,
          ...vault,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setSaveStatus('success');
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
          className="bg-primary text-black px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {loading ? 'Synchronizacja...' : <><Save size={16} /> Zaktualizuj Prawdę</>}
        </button>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl text-xs font-black uppercase text-center animate-in zoom-in-95">
          Fundament Zaktualizowany. Bliźniak właśnie stał się mądrzejszy.
        </div>
      )}

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section 
          title="Praca & Studia"
          icon={GraduationCap}
          field="work_edu"
          color="blue-400"
          description="Gdzie jesteś, co robisz i kiedy masz egzaminy"
          placeholder="Twoje stanowisko, wyniki w pracy, daty zaliczeń na studiach, projekty, którymi się zajmujesz..."
        />
        <Section 
          title="Cienie & Prawda"
          icon={Ghost}
          field="philosophy"
          color="purple-500"
          description="Fetysze, lęki, nałogi i mroczne strony"
          placeholder="Wpisz tu swoje najgłębsze prawdy: Twoje fetysze (np. rajstopy), to co Cię gnębi, Twoje nałogi, wzorce zachowań, których się wstydzisz. To klucz do Twojego cienia."
        />
        <Section 
          title="Relacje & Miłość"
          icon={Heart}
          field="relationships"
          color="rose-500"
          description="Kogo kochasz i z kim walczysz"
          placeholder="Kto jest dla Ciebie ważny? W kim się podkochujesz? Jakie masz relacje z rodziną i kobietami? Problemy w komunikacji..."
        />
        <Section 
          title="Wiedza & Potencjał"
          icon={BookOpen}
          field="knowledge"
          color="emerald-500"
          description="Co potrafisz i czego się uczysz"
          placeholder="Twoje umiejętności (np. SQL, AI), przeczytane książki, kursy, które chcesz ukończyć..."
        />
        <Section 
          title="Misja & Dlaczego"
          icon={Zap}
          field="vision"
          color="yellow-500"
          description="Twój ostateczny napęd"
          placeholder="Jaki jest Twój ostateczny cel operacyjny? Dlaczego rano wstajesz? Co chcesz osiągnąć przed śmiercią?"
        />
        <Section 
          title="Zasoby & Pieniądze"
          icon={Briefcase}
          field="finances"
          color="orange-500"
          description="Twoja siła materialna"
          placeholder="Twój Net Worth, zarobki, cele finansowe, co kupujesz i dlaczego..."
        />
      </div>
    </div>
  );
}
