import Button from '../ui/Button';
import React from 'react';
import { Sparkles } from 'lucide-react';
import Spinner from '../ui/Spinner';
import type { SavedLink, TriageSuggestion } from '../../lib/linksApi';
import Modal from '../ui/Modal';
import { Card } from '../ui/Card';

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
      title={<span className="flex items-center gap-2 text-primary"><Sparkles size={16} /> AI Triage - Sugestie Organizacji Linków</span>}
      size="lg"
    >

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {triageLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-primary">
              <Spinner size="md" className="mb-2" />
              <p className="text-sm font-bold">Analizowanie nieprzeczytanych linków...</p>
            </div>
          )}

          {!triageLoading && triageSuggestions.length === 0 && (
            <div className="text-center py-20 text-text-muted">
              <p className="text-sm font-semibold">Brak zalecanych sugestii AI</p>
              <p className="text-xs text-text-muted mt-1">Wszystkie linki wydają się być odpowiednio sklasyfikowane.</p>
            </div>
          )}

          {!triageLoading && triageSuggestions.map((s) => {
            const link = links.find(l => l.id === s.id);
            if (!link) return null;
            return (
              <Card key={s.id} variant="outline" padding="1rem" className="!bg-surface-2/40 !border-border-custom !rounded-xl space-y-3">
                <h4 className="text-sm font-bold text-text-primary leading-snug">{link.title}</h4>

                <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
                  <span className={`px-2 py-0.5 rounded ${
                    s.action === 'keep' ? 'bg-primary/10 text-primary' :
                    s.action === 'archive' ? 'bg-surface-2/10 text-text-muted' :
                    'bg-success/10 text-success'
                  }`}>
                    Sugerowana akcja: {s.action === 'keep' ? 'Zostaw' : s.action === 'archive' ? 'Archiwizuj' : 'Zrób Todo'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-warning/10 text-warning">
                    Kategoria: {s.category}
                  </span>
                </div>

                {s.reasoning && (
                  <p className="text-xs text-text-muted italic bg-surface-2/50 p-2 rounded-lg border border-border-custom/40">
                    "{s.reasoning}"
                  </p>
                )}

                {s.takeaways && s.takeaways.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Kluczowe wnioski:</span>
                    <ul className="list-disc list-inside text-xs text-text-secondary pl-1 space-y-0.5">
                      {s.takeaways.map((t: string, idx: number) => (
                        <li key={idx} className="font-medium">{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 justify-end">
                  <Button
                    onClick={() => setTriageSuggestions(prev => prev.filter(item => item.id !== s.id))}
                    variant="ghost"
                    size="sm"
                  >
                    Pomiń
                  </Button>
                  <Button
                    onClick={() => applyTriageSuggestion(s.id, s.action, s.category, s.takeaways)}
                    variant="primary"
                    size="sm"
                  >
                    Zastosuj
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
    </Modal>
  );
}
