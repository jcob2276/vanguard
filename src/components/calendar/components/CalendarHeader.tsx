import { Pressable } from '../../ui/ControlPrimitives';
import { RefreshCw } from 'lucide-react';
import { useCalendar } from '../context/CalendarContext';
import { WorkspaceHeader } from '../../shared/WorkspaceHeader';

const CALENDAR_TABS = [
  { key: 'dzien', label: 'Dzień' },
  { key: 'tydzien', label: 'Tydzień' },
  { key: 'agenda', label: 'Agenda' },
];

interface CalendarHeaderProps {
  onBack: () => void;
}

export default function CalendarHeader({ onBack }: CalendarHeaderProps) {
  const { calData: { calView, setCalView, searchQuery, setSearchQuery }, isSyncing, onSyncCalendar } = useCalendar();

  return (
    <>
      <WorkspaceHeader
        title="Kalendarz"
        onBack={onBack}
        search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Szukaj w kalendarzu…' }}
        actions={
          <Pressable
            onClick={onSyncCalendar}
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />}
          >
            {isSyncing ? 'Synchronizuję…' : 'Sync'}
          </Pressable>
        }
        tabs={{ items: CALENDAR_TABS, active: calView, onChange: (key) => setCalView(key as typeof calView) }}
      />
    </>
  );
}
