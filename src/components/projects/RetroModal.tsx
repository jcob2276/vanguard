import { Pressable, ControlTextarea } from '../ui/ControlPrimitives';
import React from 'react';
import Modal from '../ui/Modal';
import type { ProjectRow } from './projectUtils';

export interface RetroModalProps {
  retroProject: ProjectRow | null;
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
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">Co poszło dobrze?</label>
            <ControlTextarea
              value={retroForm.good}
              onChange={e => setRetroForm(f => ({ ...f, good: e.target.value }))}
              rows={2}
              placeholder="Najlepszy moment, decyzja, wynik..."
              className="w-full resize-none rounded-[var(--radius-md)] border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1">Co zrobić inaczej?</label>
            <ControlTextarea
              value={retroForm.improve}
              onChange={e => setRetroForm(f => ({ ...f, improve: e.target.value }))}
              rows={2}
              placeholder="Błąd, bloker, coś czego uniknąć..."
              className="w-full resize-none rounded-[var(--radius-md)] border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-muted block mb-1.5">Ocena projektu</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable
                  key={n}
                  onClick={() => setRetroForm(f => ({ ...f, rating: f.rating === n ? 0 : n }))}
                  className={`flex-1 rounded-xl py-2 text-sm font-black transition-all cursor-pointer ${
                    retroForm.rating >= n ? 'bg-primary text-on-accent shadow-sm' : 'bg-surface-solid text-text-muted hover:bg-primary/10'
                  }`}
                >
                  {n}
                </Pressable>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Pressable variant="outline" onClick={() => onSubmit(true)} className="flex-1 py-3 text-sm">
            Pomiń
          </Pressable>
          <Pressable onClick={() => onSubmit(false)} disabled={busy} loading={busy} className="flex-1 py-3 text-sm">
            Zapisz i zamknij
          </Pressable>
        </div>
      </div>
    </Modal>
  );
}
