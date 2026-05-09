import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Link2, RefreshCcw, CheckCircle2, 
  XCircle, ChevronLeft, Globe, ShieldCheck, Database
} from 'lucide-react';
import StayFreeSync from './StayFreeSync';
import IdentityVault from './IdentityVault';

export default function DataHub({ onBack }) {
  return (
    <div className="min-h-screen bg-black p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 text-neutral-500 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="font-black text-2xl text-white uppercase italic tracking-tighter">Data Hub</h1>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest">Reality Sync Console</p>
        </div>
      </header>

      <section className="bg-neutral-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <Database className="text-primary" size={20} />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Strumień StayFree</h3>
        </div>

        <div className="mb-4">
          <StayFreeSync />
        </div>
      </section>

      <section className="bg-neutral-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="text-primary" size={20} />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Identity Vault (Głęboki Kontekst)</h3>
        </div>
        
        <p className="text-[10px] text-neutral-500 font-bold mb-4 uppercase">Wklej tutaj ankiety, wyniki testów (MBTI, Enneagram), sesje terapeutyczne lub notatki o sobie. AI będzie o tym pamiętać.</p>
        
        <IdentityVault />
      </section>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 mb-2">
          <ShieldCheck size={14} /> System Integrity
        </h4>
        <p className="text-[9px] text-neutral-500 font-bold leading-relaxed uppercase">
          Dane są przetwarzane lokalnie i używane wyłącznie do kalibracji Twojego "Cienia".
        </p>
      </div>
    </div>
  );
}
