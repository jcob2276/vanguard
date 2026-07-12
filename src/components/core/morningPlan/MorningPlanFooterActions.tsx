import { ChevronRight, ChevronLeft, Send } from 'lucide-react';

interface MorningPlanFooterActionsProps {
  step: 1 | 2 | 3;
  setStep: (updater: (prev: 1 | 2 | 3) => 1 | 2 | 3) => void;
  dayWordCap: string;
  sending: boolean;
  onSubmit: () => void;
}

export default function MorningPlanFooterActions({ step, setStep, dayWordCap, sending, onSubmit }: MorningPlanFooterActionsProps) {
  return (
    <div className="p-4 border-t border-border-custom/20 flex items-center justify-between shrink-0">
      {step > 1 ? (
        <button
          onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
          className="px-4 py-3 rounded-xl border border-border-custom/80 text-text-primary text-[12px] font-black hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all flex items-center gap-1.5"
        >
          <ChevronLeft size={16} />
          Wróć
        </button>
      ) : (
        <div />
      )}

      {step < 3 ? (
        <button
          onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
          className="px-5 py-3 rounded-xl bg-primary text-white text-[12px] font-black hover:bg-primary/95 transition-all flex items-center gap-1.5 ml-auto"
        >
          Dalej
          <ChevronRight size={16} />
        </button>
      ) : (
        <button
          onClick={onSubmit}
          disabled={sending}
          className="px-5 py-3 rounded-xl bg-primary text-white text-[12px] font-black hover:bg-primary/95 transition-all flex items-center gap-1.5 ml-auto shadow-lg shadow-primary/10 disabled:opacity-40"
        >
          <Send size={14} />
          {sending ? 'Zapisuję plan...' : `Zatwierdź Plan${dayWordCap === 'Jutro' ? ' na Jutro' : ''}`}
        </button>
      )}
    </div>
  );
}
