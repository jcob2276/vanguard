import React from 'react';
import Modal from '../ui/Modal';

export interface RetroModalProps {
  retroProject: any;
  retroForm: { good: string; improve: string; rating: number };
  setRetroForm: React.Dispatch<React.SetStateAction<{ good: string; improve: string; rating: number }>>;
  onSubmit: (skip: boolean) => void;
  busy: boolean;
}

export default function RetroModal({ retroProject, retroForm, setRetroForm, onSubmit, busy }: RetroModalProps) {
  return (
    <Modal
      isOpen={!!retroProject}
      onClose={() => onSubmit(true)}
      title={retroProject?.name}
      subtitle="Projekt ukończony"
      size="sm"
      showCloseButton={false}
      closeOnBackdropClick={false}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">Co poszło dobrze?</label>
            <textarea
              value={retroForm.good}
              onChange={e => setRetroForm(f => ({ ...f, good: e.target.value }))}
              rows={2}
              placeholder="Najlepszy moment, decyzja, wynik..."
              className="w-full resize-none rounded-[14px] border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">Co zrobić inaczej?</label>
            <textarea
              value={retroForm.improve}
              onChange={e => setRetroForm(f => ({ ...f, improve: e.target.value }))}
              rows={2}
              placeholder="Błąd, bloker, coś czego uniknąć..."
              className="w-full resize-none rounded-[14px] border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1.5">Ocena projektu</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRetroForm(f => ({ ...f, rating: f.rating === n ? 0 : n }))}
                  className={`flex-1 rounded-xl py-2 text-[13px] font-black transition-all cursor-pointer ${
                    retroForm.rating >= n ? 'bg-primary text-white shadow-sm' : 'bg-surface-solid text-text-muted hover:bg-primary/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onSubmit(true)}
            className="flex-1 rounded-xl border border-border-custom py-3 text-[12px] font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            Pomiń
          </button>
          <button
            onClick={() => onSubmit(false)}
            disabled={busy}
            className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white shadow-sm disabled:opacity-50 cursor-pointer"
          >
            Zapisz i zamknij
          </button>
        </div>
      </div>
    </Modal>
  );
}
