import Button from '../../ui/Button';
import { ControlInput } from '../../ui/ControlPrimitives';
import { Clock, CheckSquare } from 'lucide-react';

interface DataExportSectionProps {
  dateRange: { from: string; to: string };
  setDateRange: (range: { from: string; to: string }) => void;
  includeWorkouts: boolean;
  setIncludeWorkouts: (v: boolean) => void;
  includeBody: boolean;
  setIncludeBody: (v: boolean) => void;
  includeNutrition: boolean;
  setIncludeNutrition: (v: boolean) => void;
  includeJournal: boolean;
  setIncludeJournal: (v: boolean) => void;
  exportData: () => void;
  isExporting: boolean;
}

export function DataExportSection({
  dateRange,
  setDateRange,
  includeWorkouts,
  setIncludeWorkouts,
  includeBody,
  setIncludeBody,
  includeNutrition,
  setIncludeNutrition,
  includeJournal,
  setIncludeJournal,
  exportData,
  isExporting,
}: DataExportSectionProps) {
  return (
    <>
      <div>
        <p className="text-2xs font-bold uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted font-display">
          Eksport
        </p>
        <h2 className="mt-1 font-display text-lg font-black tracking-tight text-text-primary">
          Raport danych
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="relative group">
          <Clock
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-primary transition-colors"
            size={14}
          />
          <ControlInput
            type="date"
            value={dateRange.from}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-xl border border-border-custom bg-surface p-3 pl-10 text-xs font-bold text-text-primary outline-none transition-all focus:border-primary/70"
          />
        </div>
        <div className="relative group">
          <Clock
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-primary transition-colors"
            size={14}
          />
          <ControlInput
            type="date"
            value={dateRange.to}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-xl border border-border-custom bg-surface p-3 pl-10 text-xs font-bold text-text-primary outline-none transition-all focus:border-primary/70"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-3 pt-1">
        {[
          { state: includeWorkouts, setter: setIncludeWorkouts, label: 'Trening (Siłownia/Garmin)' },
          { state: includeBody, setter: setIncludeBody, label: 'Pomiary Ciała' },
          { state: includeNutrition, setter: setIncludeNutrition, label: 'Dieta (Vanguard)' },
          { state: includeJournal, setter: setIncludeJournal, label: 'Notatnik (Telegram)' },
        ].map(({ state, setter, label }) => (

          <Button
            key={label}
            variant="ghost"
            onClick={() => setter(!state)}
            className="flex items-center gap-2 p-0 h-auto text-text-muted hover:text-text-primary hover:bg-transparent normal-case font-normal"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                state
                  ? 'bg-primary border-primary text-on-accent shadow-[0_2px_6px_var(--primary-25)]'
                  : 'border-border-custom bg-surface-solid/35'
              }`}
            >
              {state && <CheckSquare size={10} />}
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-border-custom">
        <Button
          variant="primary"
          onClick={exportData}
          disabled={isExporting}
          className="w-full"
        >
          {isExporting ? 'Generowanie...' : 'Pobierz Raport (.md)'}
        </Button>
      </div>
    </>
  );
}
