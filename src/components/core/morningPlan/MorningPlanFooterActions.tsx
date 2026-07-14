import { ChevronRight, ChevronLeft, Send } from 'lucide-react';
import Button from '../../ui/Button';

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
        <Button
          onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
          variant="outline"
          size="sm"
          icon={<ChevronLeft size={16} />}
        >
          Wróć
        </Button>
      ) : (
        <div />
      )}

      {step < 3 ? (
        <Button
          onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
          size="sm"
          icon={<ChevronRight size={16} />}
          iconPosition="right"
          className="ml-auto"
        >
          Dalej
        </Button>
      ) : (
        <Button
          onClick={onSubmit}
          loading={sending}
          icon={<Send size={14} />}
          size="sm"
          className="ml-auto"
        >
          {sending ? 'Zapisuję plan...' : `Zatwierdź Plan${dayWordCap === 'Jutro' ? ' na Jutro' : ''}`}
        </Button>
      )}
    </div>
  );
}
