import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { SavedLink, TriageSuggestion } from '../../lib/linksApi';
import Modal from '../ui/Modal';

interface LinksTriagePanelProps {
  showTriagePanel: boolean;
  setShowTriagePanel: (val: boolean) => void;
  triageLoading: boolean;
  triageSuggestions: TriageSuggestion[];
  setTriageSuggestions: React.Dispatch<React.SetStateAction<TriageSuggestion[]>>;
  links: SavedLink[];
  applyTriageSuggestion: (id: string, action: string, category: string, takeaways: string[]) => Promise<void>;
}

export function LinksTriagePanel({
  showTriagePanel,
  setShowTriagePanel,
  triageLoading,
  triageSuggestions,
  setTriageSuggestions,
  links,
  applyTriageSuggestion,
}: LinksTriagePanelProps) {
  if (!showTriagePanel) return null;

  return (
    <Modal
      isOpen
      onClose={() => { if (!triageLoading) setShowTriagePanel(false); }}
      title={<span className="flex items-center gap-2 text-indigo-400"><Sparkles size={16} /> AI Triage - Sugestie Organizacji Linków</span>}
      size="lg"
    >

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {triageLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
              <Loader2 className="animate-spin mb-2" size={24} />
              <p className="text-[12px] font-bold">Analizowanie nieprzeczytanych linków...</p>
            </div>
          )}

          {!triageLoading && triageSuggestions.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <p className="text-[12px] font-semibold">Brak zalecanych sugestii AI</p>
              <p className="text-[10px] text-slate-600 mt-1">Wszystkie linki wydają się być odpowiednio sklasyfikowane.</p>
            </div>
          )}

          {!triageLoading && triageSuggestions.map((s) => {
            const link = links.find(l => l.id === s.id);
            if (!link) return null;
            return (
              <div key={s.id} className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-[13px] font-bold text-text-primary leading-snug">{link.title}</h4>
                
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                  <span className={`px-2 py-0.5 rounded ${
                    s.action === 'keep' ? 'bg-indigo-500/10 text-indigo-400' :
                    s.action === 'archive' ? 'bg-slate-500/10 text-slate-400' :
                    'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    Sugerowana akcja: {s.action === 'keep' ? 'Zostaw' : s.action === 'archive' ? 'Archiwizuj' : 'Zrób Todo'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                    Kategoria: {s.category}
                  </span>
                </div>

                {s.reasoning && (
                  <p className="text-[11.5px] text-text-muted italic bg-slate-900/50 p-2 rounded-lg border border-slate-800/40">
                    "{s.reasoning}"
                  </p>
                )}

                {s.takeaways && s.takeaways.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Kluczowe wnioski:</span>
                    <ul className="list-disc list-inside text-[11px] text-text-secondary pl-1 space-y-0.5">
                      {s.takeaways.map((t: string, idx: number) => (
                        <li key={idx} className="font-medium">{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 justify-end">
                  <button
                    onClick={() => setTriageSuggestions(prev => prev.filter(item => item.id !== s.id))}
                    className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-text-primary transition-colors"
                  >
                    Pomiń
                  </button>
                  <button
                    onClick={() => applyTriageSuggestion(s.id, s.action, s.category, s.takeaways)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold transition-colors shadow-sm"
                  >
                    Zastosuj
                  </button>
                </div>
              </div>
            );
          })}
        </div>
    </Modal>
  );
}
