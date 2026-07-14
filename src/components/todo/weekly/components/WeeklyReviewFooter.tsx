import Button from '../../../ui/Button';
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
        <Button
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
          variant="outline"
          size="sm"
          icon={<ChevronLeft size={16} />}
        >
          Wróć
        </Button>
      )}

      {step === 1 && (
        <Button
          onClick={() => setStep(2)}
          size="sm"
          icon={<ChevronRight size={16} />}
          iconPosition="right"
          className="ml-auto"
        >
          Dalej
        </Button>
      )}

      {step === 2 && (
        <Button
          onClick={() => {
            if (currentSectionIdx < activeSections.length - 1) {
              setCurrentSectionIdx(currentSectionIdx + 1);
            } else {
              setStep(3);
            }
          }}
          size="sm"
          icon={<ChevronRight size={16} />}
          iconPosition="right"
          className="ml-auto"
        >
          {currentSectionIdx < activeSections.length - 1 ? 'Następna Sekcja' : 'Dalej'}
        </Button>
      )}

      {step === 3 && (
        <Button
          onClick={() => setStep(4)}
          size="sm"
          icon={<ChevronRight size={16} />}
          iconPosition="right"
          className="ml-auto"
        >
          Dalej
        </Button>
      )}

      {step === 4 && (
        <Button
          onClick={() => setStep(5)}
          size="sm"
          icon={<ChevronRight size={16} />}
          iconPosition="right"
          className="ml-auto"
        >
          Dalej
        </Button>
      )}

      {step === 5 && (
        <Button
          onClick={handleFinishReview}
          loading={saving}
          icon={<Check size={16} />}
          iconPosition="right"
          size="sm"
          className="ml-auto"
        >
          Zatwierdź Przegląd
        </Button>
      )}

      {step === 6 && (
        <Button
          onClick={onClose}
          className="w-full"
        >
          Zamknij
        </Button>
      )}
    </div>
  );
}
