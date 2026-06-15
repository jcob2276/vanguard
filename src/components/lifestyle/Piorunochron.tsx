import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Zap,
  Check,
  Heart,
  Volume2,
  X,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';

interface PiorunochronProps {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
  onActionAdded?: () => void;
}

const EMOTIONS = [
  { id: 'wkurwienie', label: 'Wkurwienie 🤬', desc: 'Agresja, frustracja, gniew.' },
  { id: 'stres', label: 'Stres / Napięcie 😰', desc: 'Zatłoczona głowa, presja czasu.' },
  { id: 'lek', label: 'Lęk / Niepewność 😨', desc: 'Wątpliwości, strach przed oceną.' },
  { id: 'prokrastynacja', label: 'Prokrastynacja ⏳', desc: 'Unikanie, ucieczka w pierdoły.' },
  { id: 'inhibicja', label: 'Odrętwienie / Brak chęci 💤', desc: 'Zniechęcenie, paraliż decyzyjny.' },
];

export default function Piorunochron({ session, isOpen, onClose, onActionAdded }: PiorunochronProps) {
  const haptics = useHaptics();
  const userId = session?.user?.id;

  // Step: 1 (Feel) | 2 (Release) | 3 (Act)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [actionText, setActionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Breath count for box breathing
  const [breathPhase, setBreathPhase] = useState<'in' | 'hold' | 'out' | 'hold_out'>('in');
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [breathCycles, setBreathCycles] = useState(0);

  // Breathing simulation
  useEffect(() => {
    if (step !== 2) return;

    const interval = setInterval(() => {
      setBreathSeconds(prev => {
        if (prev <= 1) {
          // Change phase
          setBreathPhase(current => {
            switch (current) {
              case 'in':
                haptics.medium();
                return 'hold';
              case 'hold':
                haptics.light();
                return 'out';
              case 'out':
                haptics.medium();
                return 'hold_out';
              case 'hold_out':
                haptics.light();
                setBreathCycles(c => c + 1);
                return 'in';
            }
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  if (!isOpen) return null;

  const handleSelectEmotion = (emotionId: string) => {
    setSelectedEmotion(emotionId);
    haptics.light();
    setStep(2);
  };

  const handleReleaseComplete = () => {
    haptics.success();
    setStep(3);
  };

  const handleSubmitAction = async () => {
    if (actionText.trim().length < 3 || !userId) return;
    setIsSubmitting(true);

    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      const streamText = `[Piorunochron] Wykryta emocja: ${selectedEmotion?.toUpperCase()} | Uwolnienie zakończone sukcesem | Zadeklarowana akcja behawioralna: "${actionText.trim()}"`;

      // 1. Log to vanguard_stream
      const { error: streamErr } = await supabase.from('vanguard_stream').insert({
        user_id: userId,
        content: streamText,
        source: 'piorunochron',
        category: 'friction',
        classification: 'emotion_release',
        metadata: {
          emotion: selectedEmotion,
          action: actionText.trim(),
          date: today
        }
      });

      if (streamErr) throw streamErr;

      // 2. Add as high-priority todo item
      const { error: todoErr } = await supabase.from('todo_items').insert({
        user_id: userId,
        title: `⚡ [Piorunochron] ${actionText.trim()}`,
        priority: 'high',
        status: 'open',
        notes: `Zadanie behawioralne wygenerowane w celu rozładowania emocji: ${selectedEmotion}`
      });

      if (todoErr) throw todoErr;

      // 3. Try to append to daily_wins if there's space and it's active
      const { data: winToday } = await supabase
        .from('daily_wins')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (winToday) {
        // Find first empty task slot in daily_wins
        let emptySlotIdx = -1;
        for (let i = 1; i <= 5; i++) {
          if (!winToday[`task_${i}`]) {
            emptySlotIdx = i;
            break;
          }
        }

        if (emptySlotIdx !== -1) {
          const updates: any = {};
          updates[`task_${emptySlotIdx}`] = `⚡ ${actionText.trim()}`;
          updates[`category_${emptySlotIdx}`] = 'general';
          
          await supabase
            .from('daily_wins')
            .update(updates)
            .eq('id', winToday.id);
        }
      }

      haptics.success();
      if (onActionAdded) onActionAdded();
      
      // Reset & close
      setStep(1);
      setSelectedEmotion(null);
      setActionText('');
      onClose();
    } catch (err) {
      console.error('Error submitting piorunochron action:', err);
      alert('Wystąpił błąd podczas zapisywania akcji.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface p-5 shadow-2xl animate-scale-up relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1.5 text-text-secondary hover:bg-surface-solid hover:text-text-primary transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>

        {/* STEP 1: FEEL */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Zap size={16} fill="currentColor" />
              </div>
              <div>
                <h3 className="font-display text-sm font-black uppercase tracking-wider text-text-primary">PIORUNOCHRON Mority</h3>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Rozładowanie napięcia</p>
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-text-secondary">
              Czujesz opór, złość lub paraliż? Nie walcz z tym. Wybierz dominujące odczucie, aby je rozładować:
            </p>

            <div className="space-y-2">
              {EMOTIONS.map(e => (
                <button
                  key={e.id}
                  onClick={() => handleSelectEmotion(e.id)}
                  className="flex w-full flex-col text-left p-3 rounded-2xl border border-border-custom bg-surface-solid/40 hover:bg-surface-solid hover:border-primary/30 transition-all cursor-pointer"
                >
                  <span className="text-xs font-black text-text-primary">{e.label}</span>
                  <span className="text-[10px] text-text-muted mt-0.5">{e.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: RELEASE */}
        {step === 2 && (
          <div className="space-y-6 pt-2 text-center">
            <h3 className="font-display text-sm font-black uppercase tracking-wider text-text-primary">Krok 2: Uwolnij</h3>
            
            <div className="mx-auto w-32 h-32 flex items-center justify-center rounded-full bg-primary/5 border border-primary/10 relative">
              {/* Pulsating breathing indicator */}
              <div 
                className={`absolute inset-3 rounded-full bg-primary/10 transition-all duration-[4000ms] ${
                  breathPhase === 'in' ? 'scale-110 opacity-100' : 'scale-90 opacity-40'
                }`} 
              />
              <div className="z-10 flex flex-col items-center">
                <span className="text-xs font-black uppercase tracking-widest text-primary font-display">
                  {breathPhase === 'in' && 'WDECH'}
                  {breathPhase === 'hold' && 'PRZYTRZYMAJ'}
                  {breathPhase === 'out' && 'WYDECH'}
                  {breathPhase === 'hold_out' && 'PAUZA'}
                </span>
                <span className="text-2xl font-black text-text-primary font-display mt-1">
                  {breathSeconds}s
                </span>
              </div>
            </div>

            <div className="space-y-2 max-w-[280px] mx-auto">
              <p className="text-[13px] font-semibold text-text-primary leading-snug">
                Skoncentruj się na doznaniach fizycznych w ciele.
              </p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Pozwól energii przepłynąć. Emocje są jak chmury – pojawiają się i odchodzą. Wykonaj przynajmniej jeden cykl oddechowy.
              </p>
            </div>

            <div className="my-2 text-[10px] font-bold text-text-muted">
              Wykonano cykli: {breathCycles}
            </div>

            <button
              onClick={handleReleaseComplete}
              disabled={breathCycles === 0}
              className="w-full py-3 rounded-full bg-primary text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98 cursor-pointer"
            >
              Napięcie Uwolnione 🧘
            </button>
          </div>
        )}

        {/* STEP 3: ACT */}
        {step === 3 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Check size={16} strokeWidth={3} />
              </div>
              <div>
                <h3 className="font-display text-sm font-black uppercase tracking-wider text-text-primary">Krok 3: Celowe Działanie</h3>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Przekierowanie energii</p>
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-text-secondary">
              Umysł zajął się odczuciami, Ty zajmij się działaniem. Zgodnie z Moritą – **co zrobisz w tym momencie?** Wpisz jedną mikro-akcję, którą zaraz wykonasz:
            </p>

            <textarea
              autoFocus
              value={actionText}
              onChange={e => setActionText(e.target.value)}
              placeholder="np. Napiszę 10 linijek kodu, zmyję naczynia, wyślę maila do X..."
              rows={3}
              className="w-full rounded-xl border border-border-custom bg-surface p-3 text-xs text-text-primary outline-none focus:border-emerald-500 resize-none leading-relaxed"
            />

            <p className="text-[10px] text-text-muted italic">
              Akcja zostanie natychmiast dodana do Twojej PowerListy, abyś mógł od razu wejść w działanie.
            </p>

            <button
              onClick={handleSubmitAction}
              disabled={actionText.trim().length < 3 || isSubmitting}
              className="w-full py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest disabled:opacity-40 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Plus size={14} /> Wchodzę w Działanie! 🚀
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
