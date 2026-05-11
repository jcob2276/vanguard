import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Save, FileText, Brain, Heart, Zap, Ghost, BookOpen } from 'lucide-react';

export default function IdentityVault({ session }) {
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  
  // State for different vault sections
  const [vault, setVault] = useState({
    vision: '', // Misja & Cele długoterminowe
    identity: '', // Filary (Kim jesteś)
    knowledge: '', // Wiedza, umiejętności, przeczytane książki
    relationships: '', // Relacje, ludzie, problemy społeczne
    philosophy: '', // Skarbiec głęboki (Zmagania, gnębiące myśli, fetysze, prawda)
    finances: '' // Sytuacja finansowa, Net Worth, cele pieniężne
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
          finances: data.finances || ''
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
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Identity Vault v3.0</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic">FUNDAMENT TOŻSAMOŚCI</h1>
          <p className="text-neutral-500 text-sm mt-2 font-medium">To jest baza danych Twojego Bliźniaka. Im więcej tu wpiszesz, tym potężniejsza będzie Wyrocznia.</p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-primary text-black px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {loading ? 'Synchronizacja...' : <><Save size={16} /> Zapisz Fundament</>}
        </button>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-xl text-xs font-black uppercase text-center animate-in zoom-in-95">
          Fundament Zaktualizowany. Wyrocznia właśnie wchłonęła Twoje nowe dane.
        </div>
      )}

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section 
          title="Misja & Wizja"
          icon={Zap}
          field="vision"
          color="yellow-500"
          description="Twoje ostateczne 'Dlaczego'"
          placeholder="Jaki jest Twój ostateczny cel? Co chcesz po sobie zostawić? Czego chcesz się nauczyć w najbliższym czasie?"
        />
        <Section 
          title="Filary Tożsamości"
          icon={Brain}
          field="identity"
          color="blue-500"
          description="Kim jesteś w swojej najlepszej wersji"
          placeholder="Np. High-Stakes Entrepreneur, Świadomy Partner, Elitarny Deweloper..."
        />
        <Section 
          title="Wiedza & Skille"
          icon={BookOpen}
          field="knowledge"
          color="emerald-500"
          description="Twój intelektualny arsenał"
          placeholder="Co potrafisz? Jakie książki przeczytałeś? Co wiesz o świecie, czego inni nie wiedzą?"
        />
        <Section 
          title="Relacje & Ludzie"
          icon={Heart}
          field="relationships"
          color="rose-500"
          description="Twoja sieć społeczna"
          placeholder="Z kim trzymasz? Kto Cię inspiruje? Jakie masz problemy w relacjach? Z czym się zmagasz?"
        />
        <Section 
          title="Cienie & Prawda"
          icon={Ghost}
          field="philosophy"
          color="purple-500"
          description="To, o czym nie mówisz nikomu"
          placeholder="Co Cię gnębi? Co powtarzasz (nałogi, wzorce)? Twoje lęki, fetysze, mroczne strony. Wyrocznia Cię nie oceni."
        />
        <Section 
          title="Finanse & Zasoby"
          icon={FileText}
          field="finances"
          color="orange-500"
          description="Twoja siła materialna"
          placeholder="Twoja obecna sytuacja finansowa, Net Worth, cele pieniężne i stosunek do pieniędzy."
        />
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-start gap-4">
        <Shield size={24} className="text-primary shrink-0" />
        <div>
          <h4 className="text-xs font-black text-white uppercase mb-1">Pełna Prywatność</h4>
          <p className="text-[10px] text-neutral-400 leading-relaxed uppercase tracking-widest">
            Dane te są przesyłane bezpośrednio do Twojego modelu AI w celu personalizacji analiz. Nikt poza Tobą i Twoim Bliźniakiem nie ma do nich wglądu.
          </p>
        </div>
      </div>
    </div>
  );
}
