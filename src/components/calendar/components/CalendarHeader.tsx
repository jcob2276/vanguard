import { Pressable } from '../../ui/ControlPrimitives';
import { RefreshCw } from 'lucide-react';
import { useCalendar } from '../context/CalendarContext';
import Tabs from '../../ui/Tabs';
import { WorkspaceHeader, WorkspaceSearch } from '../../shared/WorkspaceHeader';

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
        center={<WorkspaceSearch value={searchQuery} onChange={setSearchQuery} placeholder="Szukaj w kalendarzu…" />}
        actions={
          <Pressable
            onClick={onSyncCalendar}
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />}
          >
            {isSyncing ? 'Synchronizuję…' : 'GCal'}
          </Pressable>
        }
        navigation={<Tabs tabs={CALENDAR_TABS} active={calView} onChange={(key) => setCalView(key as typeof calView)} />}
      />
    </>
  );
}
