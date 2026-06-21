import { Clock, CheckSquare } from 'lucide-react';

interface DataExportSectionProps {
  dateRange: { from: string; to: string };
  setDateRange: (range: { from: string; to: string }) => void;
  includeWorkouts: boolean;
  setIncludeWorkouts: (v: boolean) => void;
  includeBody: boolean;
  setIncludeBody: (v: boolean) => void;
  includeYazio: boolean;
  setIncludeYazio: (v: boolean) => void;
  includeJournal: boolean;
  setIncludeJournal: (v: boolean) => void;
  includeOura: boolean;
  setIncludeOura: (v: boolean) => void;
  includeHabits: boolean;
  setIncludeHabits: (v: boolean) => void;
  includeActivityWatch: boolean;
  setIncludeActivityWatch: (v: boolean) => void;
  syncHistory: () => void;
  isSyncing: boolean;
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
  includeYazio,
  setIncludeYazio,
  includeJournal,
  setIncludeJournal,
  includeOura,
  setIncludeOura,
  includeHabits,
  setIncludeHabits,
  includeActivityWatch,
  setIncludeActivityWatch,
  syncHistory,
  isSyncing,
  exportData,
  isExporting,
}: DataExportSectionProps) {
  return (
    <>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">
          Eksport
        </p>
        <h2 className="mt-1 font-display text-[18px] font-black tracking-tight text-text-primary">
          Raport danych
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="relative group">
          <Clock
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-primary transition-colors"
            size={14}
          />
          <input
            type="date"
            value={dateRange.from}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-xl border border-border-custom bg-surface p-3 pl-10 text-[10px] font-bold text-text-primary outline-none transition-all focus:border-primary/70"
          />
        </div>
        <div className="relative group">
          <Clock
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-primary transition-colors"
            size={14}
          />
          <input
            type="date"
            value={dateRange.to}
            onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-xl border border-border-custom bg-surface p-3 pl-10 text-[10px] font-bold text-text-primary outline-none transition-all focus:border-primary/70"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-3 pt-1">
        {[
          { state: includeWorkouts, setter: setIncludeWorkouts, label: 'Trening (Siłownia/Strava)' },
          { state: includeBody, setter: setIncludeBody, label: 'Pomiary Ciała' },
          { state: includeYazio, setter: setIncludeYazio, label: 'Dieta (Vanguard)' },
          { state: includeJournal, setter: setIncludeJournal, label: 'Notatnik (Telegram)' },
          { state: includeOura, setter: setIncludeOura, label: 'Oura Ring' },
          { state: includeHabits, setter: setIncludeHabits, label: 'Nawyki' },
          {
            state: includeActivityWatch,
            setter: setIncludeActivityWatch,
            label: 'Aktywność komputera (ActivityWatch)',
          },
        ].map(({ state, setter, label }) => (
          <button
            key={label}
            onClick={() => setter(!state)}
            className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                state
                  ? 'bg-primary border-primary text-white shadow-[0_2px_6px_rgba(79,70,229,0.2)]'
                  : 'border-border-custom bg-surface-solid/35'
              }`}
            >
              {state && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-border-custom">
        <button
          onClick={exportData}
          disabled={isExporting}
          className="w-full rounded-xl bg-primary hover:bg-primary-hover px-6 py-3.5 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.99] font-display text-center cursor-pointer"
        >
          {isExporting ? 'Generowanie...' : 'Pobierz Raport (.md)'}
        </button>
      </div>
    </>
  );
}
