import { useState } from 'react';
import { X, Sparkles, Send } from 'lucide-react';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { useShutdownData } from './shutdown/useShutdownData';
import ShutdownScoreSliders from './shutdown/ShutdownScoreSliders';

interface Props {
  onClose: () => void;
  onSaved?: () => void;
  onPlanTomorrow?: () => void;
}

export default function DailyShutdownModal({ onClose, onSaved, onPlanTomorrow }: Props) {
  const d = useShutdownData();
  const [step, setStep] = useState<1 | 2>(1);

  const handleSave = async () => {
    await d.handleSaveShutdown();
    if (onSaved) onSaved();
    setStep(2);
  };

  if (d.loading) {
    return (
      <Modal isOpen={true} onClose={onClose} showCloseButton={false} padding="p-6" size="xs" overlayClassName="z-[60]" closeOnBackdropClick={false}>
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm font-bold text-text-muted">Wczytywanie rytuału wieczornego...</span>
        </div>
      </Modal>
    );
  }

  if (!d.todayWin) {
    return (
      <Modal isOpen={true} onClose={onClose} showCloseButton={false} padding="p-6" size="sm" overlayClassName="z-[60]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto text-xl font-bold">!</div>
          <h2 className="text-base font-black text-text-primary">Brak planu na dziś</h2>
          <p className="text-sm text-text-muted">Rytuał poranny nie został ukończony na dzisiejszy dzień, więc nie możemy go dzisiaj rozliczyć.</p>
          <Button onClick={onClose} className="w-full" size="sm">Zamknij</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} showCloseButton={false} padding="p-0" overflowY={false} size="lg" overlayClassName="z-[60]">
      <div className="relative w-full flex flex-col max-h-[85vh] sm:max-h-[680px] overflow-hidden">
        <div className="p-4 border-b border-border-custom/20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-text-primary uppercase tracking-wider">Domknięcie Dnia</h2>
            <span className="text-xs font-semibold text-text-muted">{d.today}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary"><X size={18} /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <span className="text-xs font-bold text-text-secondary">Zadania Power List (podgląd)</span>
                {d.tasksList.length === 0 ? (
                  <div className="py-4 text-center text-text-muted/50 italic text-xs">Brak zadań w Power List na dziś.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {d.tasksList.map((task) => (
                      <div key={task.idx} className={`px-3 py-2 rounded-lg border flex items-center justify-between transition-all ${task.done ? 'border-success/10 bg-success/[0.01] text-text-primary' : 'border-border-custom/40 bg-surface/30 text-text-muted'}`}>
                        <span className={`text-xs font-medium ${task.done ? 'line-through opacity-70' : ''}`}>{task.title}</span>
                        <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${task.done ? 'bg-success/10 text-success' : 'bg-slate-500/10 text-slate-500'}`}>{task.done ? 'Tak' : 'Nie'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-text-primary block">Refleksja: co realnie poszło inaczej i dlaczego?</span>
                <textarea value={d.reflectionText} onChange={(e) => d.setReflectionText(e.target.value)} placeholder="Zapisz krótkie podsumowanie lub napotkane tarcia..." rows={2} className="w-full bg-slate-50 dark:bg-white/[0.01] border border-border-custom/60 rounded-xl px-3 py-2 text-sm font-semibold text-text-primary placeholder:text-text-muted/30 focus:border-primary/50 outline-none transition-colors resize-none" />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-text-primary block">Dodatkowe notatki z wykonania (opcjonalnie)</span>
                <textarea value={d.actualAccomplishmentText} onChange={(e) => d.setActualAccomplishmentText(e.target.value)} placeholder="Co konkretnie udało się dzisiaj dowieźć poza planem..." rows={2} className="w-full bg-slate-50 dark:bg-white/[0.01] border border-border-custom/60 rounded-xl px-3 py-2 text-sm font-semibold text-text-primary placeholder:text-text-muted/30 focus:border-primary/50 outline-none transition-colors resize-none" />
              </div>

              <ShutdownScoreSliders dayScore={d.dayScore} setDayScore={d.setDayScore} moodScore={d.moodScore} setMoodScore={d.setMoodScore} rpeScore={d.rpeScore} setRpeScore={d.setRpeScore} />
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl shadow-lg shadow-primary/5"><Sparkles /></div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-text-primary uppercase tracking-wider">Dzień Zamknięty</h2>
                <p className="text-sm text-text-muted">Praca została mentalnie domknięta. Czas na odpoczynek i regenerację.</p>
              </div>
              <Card variant="glass" className="w-full text-left space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                  <span>Wynik Dnia:</span>
                  <span className="text-primary font-black">{d.dayScore}/10</span>
                </div>
                {d.actualAccomplishmentText.trim() && (
                  <div className="text-xs text-text-muted mt-1 pt-1.5 border-t border-border-custom/20">
                    <span className="font-bold text-text-secondary block">Co realnie zrobione:</span>
                    <p className="italic mt-0.5 break-words">{d.actualAccomplishmentText.trim()}</p>
                  </div>
                )}
                {d.reflectionText.trim() && (
                  <div className="text-xs text-text-muted mt-1 pt-1.5 border-t border-border-custom/20">
                    <span className="font-bold text-text-secondary block">Refleksja wieczorna:</span>
                    <p className="italic mt-0.5 break-words">{d.reflectionText.trim()}</p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-custom/20 flex items-center justify-between shrink-0">
          {step === 1 && (
            <Button onClick={handleSave} loading={d.saving} icon={<Send size={14} />} className="w-full">
              {d.saving ? 'Zamykam dzień...' : 'Zatwierdź zamknięcie'}
            </Button>
          )}
          {step === 2 && (
            <div className="w-full flex gap-2">
              <Button onClick={onClose} variant="outline" className={onPlanTomorrow ? 'flex-1' : 'w-full'}>Zamknij i odpocznij</Button>
              {onPlanTomorrow && <Button onClick={onPlanTomorrow} className="flex-1">Zaplanuj jutro</Button>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
