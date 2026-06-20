import { Target, Sparkles } from 'lucide-react';
import { useHaptics } from '../../../hooks/useHaptics';

interface IntentionsStepProps {
  intentions: string[];
  setIntentions: React.Dispatch<React.SetStateAction<string[]>>;
  dopamineIntentionIdx: number;
  setDopamineIntentionIdx: (idx: number) => void;
  onNext: () => void;
}

export default function IntentionsStep({
  intentions,
  setIntentions,
  dopamineIntentionIdx,
  setDopamineIntentionIdx,
  onNext,
}: IntentionsStepProps) {
  const haptics = useHaptics();

  const handleNextClick = () => {
    const activeText = intentions[dopamineIntentionIdx]?.trim();
    if (!activeText) {
      alert('Wpisz tekst dla wybranej intencji głównej, aby przejść do Zmiany Świateł.');
      return;
    }
    onNext();
  };

  const handleIntentionChange = (idx: number, val: string) => {
    setIntentions((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-5 flex-1 flex flex-col overflow-hidden">
        <header className="text-center space-y-1 shrink-0">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Target size={20} />
          </div>
          <h3 className="font-display text-lg font-black tracking-tight uppercase mt-2">
            KROK 5: 7 PORANNYCH INTENCJI
          </h3>
          <p className="text-[10px] text-text-muted leading-relaxed max-w-[280px] mx-auto">
            Przepisz je odręcznie na kartce w czasie teraźniejszym. Wpisz je tutaj i wybierz jedną do dopaminizacji.
          </p>
        </header>

        {/* Digital Inputs */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[320px]">
          {intentions.map((intent, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              {/* Index or Dopamine Target Selector */}
              <button
                onClick={() => {
                  setDopamineIntentionIdx(idx);
                  haptics.light();
                }}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black font-display transition-all cursor-pointer ${
                  dopamineIntentionIdx === idx
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 scale-110'
                    : 'bg-surface border border-border-custom text-text-muted hover:border-amber-500/40 hover:text-amber-500'
                }`}
                title={dopamineIntentionIdx === idx ? 'Główna intencja dnia (Dopaminowana)' : 'Oznacz jako główną'}
              >
                {dopamineIntentionIdx === idx ? <Sparkles size={11} fill="currentColor" /> : idx + 1}
              </button>
              {/* Input Field */}
              <input
                type="text"
                value={intent}
                onChange={(e) => handleIntentionChange(idx, e.target.value)}
                placeholder={`Intencja #${idx + 1}`}
                className={`flex-1 rounded-xl border bg-surface px-3.5 py-2.5 text-xs text-text-primary outline-none transition-all ${
                  dopamineIntentionIdx === idx
                    ? 'border-amber-500/40 bg-amber-500/[0.02] focus:border-amber-500'
                    : 'border-border-custom/80 focus:border-primary'
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleNextClick}
        className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest mt-4 active:scale-98 transition-all cursor-pointer"
      >
        Przepisane! Przejdź do Zmiany Świateł ⚡
      </button>
    </div>
  );
}
