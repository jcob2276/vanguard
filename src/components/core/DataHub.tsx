import { ChevronLeft, ShieldCheck } from 'lucide-react';
import BrainHealth from '../biometrics/BrainHealth';

type DataHubProps = {
  onBack?: (() => void) | null;
  embedded?: boolean;
};

export default function DataHub({ onBack = null, embedded = false }: DataHubProps) {
  return (
    <div className={`${embedded ? 'space-y-6' : 'min-h-screen bg-black p-6 space-y-8 animate-in fade-in duration-500'}`}>
      {!embedded && (
        <header className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 text-neutral-500 hover:text-white transition-colors">
              <ChevronLeft size={24} />
            </button>
          )}
          <div>
            <h1 className="font-black text-2xl text-white uppercase italic tracking-tighter">Data Hub</h1>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest">Reality Sync Console</p>
          </div>
        </header>
      )}

      <BrainHealth />



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
