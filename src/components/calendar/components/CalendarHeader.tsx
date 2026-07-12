import React from 'react';
import { useCalendar } from '../context/CalendarContext';
import { RefreshCw } from 'lucide-react';

export default function CalendarHeader() {
  const {
    calData: {
      calView,
      setCalView,
    },
    isSyncing,
    onSyncCalendar,
  } = useCalendar();

  return (
    <div className="h-[60px] shrink-0 border-b border-border-custom/20 flex items-center px-6 justify-between bg-background select-none">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-border-custom/30">
          {(['dzien', 'tydzien', 'agenda'] as const).map((view) => {
            const label = view === 'dzien' ? 'Dzień' : view === 'tydzien' ? 'Tydzień' : 'Agenda';
            const shortcut = view === 'dzien' ? 'T' : view === 'tydzien' ? 'W' : 'A';
            return (
              <button
                key={view}
                onClick={() => setCalView(view)}
                title={`${label} (${shortcut})`}
                className={`flex items-center gap-1.5 text-[11px] font-black px-4 py-2 rounded-lg transition-all capitalize cursor-pointer outline-none ${
                  calView === view
                    ? 'bg-background text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
                <kbd
                  className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                    calView === view
                      ? 'border-border-custom/60 bg-black/5 dark:bg-white/10 text-text-muted'
                      : 'border-transparent'
                  }`}
                >
                  {shortcut}
                </kbd>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Sync buttons */}
        <button
          onClick={onSyncCalendar}
          disabled={isSyncing}
          className="flex items-center gap-1.5 rounded-xl border border-border-custom/60 hover:bg-surface-solid px-3.5 py-2 text-[11.5px] font-bold text-text-secondary transition-colors cursor-pointer outline-none"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Synchronizuję...' : 'GCal'}</span>
        </button>
      </div>
    </div>
  );
}
