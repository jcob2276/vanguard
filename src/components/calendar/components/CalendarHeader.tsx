import { ControlInput, Pressable } from '../../ui/ControlPrimitives';
import { RefreshCw, Calendar as CalendarIcon, Search, X } from 'lucide-react';
import { useCalendar } from '../context/CalendarContext';
import { WorkspaceHeader } from '../../shared/WorkspaceHeader';
import { formatRangeLabel, weekMon } from '../calendarHelpers';

const CALENDAR_TABS = [
  { key: 'dzien', label: 'Dzień' },
  { key: '3dni', label: '3 Dni' },
  { key: 'tydzien', label: 'Tydzień' },
  { key: 'miesiac', label: 'Miesiąc' },
];

interface CalendarHeaderProps {
  onBack: () => void;
}

export default function CalendarHeader({ onBack }: CalendarHeaderProps) {
  const {
    today,
    calData: {
      calView,
      setCalView,
      selectedDay,
      setSelectedDay,
      weekStart,
      setWeekStart,
      searchQuery,
      setSearchQuery,
    },
    isSyncing,
    onSyncCalendar,
  } = useCalendar();

  const currentRangeLabel = formatRangeLabel(calView, selectedDay, weekStart);

  const handleTodayClick = () => {
    setSelectedDay(today);
    setWeekStart(weekMon(today));
  };

  return (
    <WorkspaceHeader
      title={currentRangeLabel || 'Kalendarz'}
      onBack={onBack}
      actions={
        <div className="flex items-center gap-2">
          {/* Live Search Input */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-2.5 text-text-muted pointer-events-none" />
            <ControlInput
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj wydarzeń…"
              className="h-8 w-36 sm:w-48 pl-8 pr-7 text-xs rounded-lg border border-border-custom/40 bg-surface-solid/30 text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:bg-background transition-all"
            />
            {searchQuery && (
              <Pressable
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-text-muted hover:text-text-primary"
              >
                <X size={12} />
              </Pressable>
            )}
          </div>

          <Pressable
            onClick={handleTodayClick}
            variant="secondary"
            size="sm"
            icon={<CalendarIcon size={14} />}
            className="calendar-today-button font-bold text-xs"
          >
            Dzisiaj
          </Pressable>
          <Pressable
            onClick={onSyncCalendar}
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />}
            className="calendar-sync-button"
          >
            {isSyncing ? 'Synchronizuję…' : 'Sync'}
          </Pressable>
        </div>
      }
      tabs={{
        items: CALENDAR_TABS,
        active: calView,
        onChange: (key) => setCalView(key as typeof calView),
      }}
    />
  );
}
