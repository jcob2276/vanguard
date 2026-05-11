import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Shield, Brain, CheckCircle2, Database } from 'lucide-react';

export default function IdentityVault() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchVault();
  }, []);

  const fetchVault = async () => {
    try {
      const { data } = await supabase
        .from('life_goals')
        .select('vault_content')
        .maybeSingle();

      if (data?.vault_content) {
        setContent(data.vault_content);
      }
    } catch (e) {
      console.error("Vault fetch error:", e);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Błąd: Nie jesteś zalogowany.");
        return;
      }

      // UPSERT - Zapisz lub zaktualizuj niezależnie od tego czy rekord istnieje
      const { error } = await supabase
        .from('life_goals')
        .upsert({ 
          user_id: user.id, 
          vault_content: content
        }, { onConflict: 'user_id' });
      
      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Vault save error:", e);
      alert("Błąd zapisu: " + e.message);
    }
    setLoading(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setContent(prev => prev ? prev + "\n\n--- IMPORTOWANY PLIK: " + file.name + " ---\n" + text : text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 flex items-center justify-center gap-2 transition-all">
          <Database size={14} className="text-primary" />
          <span className="text-[10px] font-black uppercase text-neutral-400">Importuj Plik (.txt, .md)</span>
          <input type="file" className="hidden" accept=".txt,.md,.json" onChange={handleFileUpload} />
        </label>
      </div>

      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Wklej tutaj swoją ankietę lub wgraj pliki powyżej..."
          className="w-full h-96 bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-neutral-300 font-mono focus:border-primary/50 outline-none transition-all resize-none"
        />
        <div className="absolute top-4 right-4 opacity-10">
          <Brain size={40} className="text-primary" />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20'
          }`}
      >
        {saved ? (
          <><CheckCircle2 size={16} /> Zapisano w Skarbcu</>
        ) : (
          <><Save size={16} /> {loading ? 'Synchronizacja...' : 'Zapisz Skarbiec Tożsamości'}</>
        )}
      </button>

      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
        <Shield size={12} className="text-emerald-500" />
        <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Dane są szyfrowane i dostępne tylko dla Twojego AI Oracle.</span>
      </div>
    </div>
  );
}
