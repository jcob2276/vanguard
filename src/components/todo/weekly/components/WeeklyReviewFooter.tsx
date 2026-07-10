import React from 'react';
import { useWeeklyReview } from '../context/WeeklyReviewContext';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface WeeklyReviewFooterProps {
  onClose: () => void;
}

export default function WeeklyReviewFooter({ onClose }: WeeklyReviewFooterProps) {
  const {
    step,
    setStep,
    currentSectionIdx,
    setCurrentSectionIdx,
    activeSections,
    saving,
    handleFinishReview,
  } = useWeeklyReview();

  return (
    <div className="p-4 border-t border-border-custom/20 flex items-center justify-between shrink-0">
      {step > 1 && step < 6 && (
        <button
          onClick={() => {
            if (step === 2) {
              setStep(1);
            } else if (step === 3) {
              setStep(2);
            } else if (step === 4) {
              setStep(3);
            } else if (step === 5) {
              setStep(4);
            }
          }}
          className="px-4 py-3 rounded-xl border border-border-custom/80 text-text-primary text-[12px] font-black hover:bg-slate-100 dark:hover:bg-white/[0.03] transition-all flex items-center gap-1.5 cursor-pointer outline-none"
        >
          <ChevronLeft size={16} />
          Wróć
        </button>
      )}

      {step === 1 && (
        <button
          onClick={() => setStep(2)}
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto cursor-pointer outline-none"
        >
          Dalej
          <ChevronRight size={16} />
        </button>
      )}

      {step === 2 && (
        <button
          onClick={() => {
            if (currentSectionIdx < activeSections.length - 1) {
              setCurrentSectionIdx(currentSectionIdx + 1);
            } else {
              setStep(3);
            }
          }}
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto cursor-pointer outline-none"
        >
          {currentSectionIdx < activeSections.length - 1 ? 'Następna Sekcja' : 'Dalej'}
          <ChevronRight size={16} />
        </button>
      )}

      {step === 3 && (
        <button
          onClick={() => setStep(4)}
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto cursor-pointer outline-none"
        >
          Dalej
          <ChevronRight size={16} />
        </button>
      )}

      {step === 4 && (
        <button
          onClick={() => setStep(5)}
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all flex items-center gap-1.5 ml-auto cursor-pointer outline-none"
        >
          Dalej
          <ChevronRight size={16} />
        </button>
      )}

      {step === 5 && (
        <button
          onClick={handleFinishReview}
          disabled={saving}
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-505 transition-all flex items-center gap-1.5 ml-auto disabled:opacity-40 cursor-pointer outline-none"
        >
          {saving ? 'Zapisywanie...' : 'Zatwierdź Przegląd'}
          <Check size={16} />
        </button>
      )}

      {step === 6 && (
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-500 transition-all text-center cursor-pointer outline-none"
        >
          Zamknij
        </button>
      )}
    </div>
  );
}
