import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Link2, RefreshCcw, CheckCircle2, 
  XCircle, ChevronLeft, Globe, ShieldCheck, Database
} from 'lucide-react';

export default function DataHub({ onBack }) {
  const [integrations, setIntegrations] = useState([
    { id: 'calendar', name: 'Google Calendar', status: 'ready', icon: Calendar, color: 'text-blue-500', lastSync: 'Nigdy' },
    { id: 'gmail', name: 'Gmail Metadata', status: 'pending', icon: Globe, color: 'text-red-500', lastSync: '-' },
    { id: 'bank', name: 'Financial API', status: 'locked', icon: ShieldCheck, color: 'text-emerald-500', lastSync: '-' },
  ]);

  return (
    <div className="min-h-screen bg-black p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 text-neutral-500 hover:text-white transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="font-black text-2xl text-white uppercase italic tracking-tighter">Data Hub</h1>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest">Reality Import Management</p>
        </div>
      </header>

      <section className="bg-neutral-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <Database className="text-primary" size={20} />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Aktywne Strumienie</h3>
        </div>

        <div className="space-y-4">
          {integrations.map((int) => (
            <div key={int.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-white/10 transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-white/5 ${int.color}`}>
                  <int.icon size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase italic">{int.name}</h4>
                  <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Ostatnia synchronizacja: {int.lastSync}</p>
                </div>
              </div>

              {int.status === 'ready' && (
                <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                  <Link2 size={12} /> Połącz
                </button>
              )}
              {int.status === 'pending' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-full text-[10px] font-black uppercase tracking-widest opacity-50">
                   Wkrótce
                </div>
              )}
              {int.status === 'locked' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 text-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                   Zablokowane
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-3">
        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck size={14} /> Security Protocol
        </h4>
        <p className="text-[10px] text-neutral-400 font-bold leading-relaxed uppercase">
          Wszystkie dane importowane przez Data Hub są szyfrowane po stronie serwera i używane wyłącznie przez Strategic Observer do kalibracji Twojego wektora stanu. System nie przechowuje treści maili, a jedynie metadane operacyjne.
        </p>
      </div>
    </div>
  );
}
