import Button from '../ui/Button';
import { Grid3X3, LayoutList } from 'lucide-react';
import Tabs from '../ui/Tabs';
import { WorkspaceHeader, WorkspaceSearch } from '../shared/WorkspaceHeader';

interface KeepHeaderProps {
  onBack: () => void;
  search: string;
  setSearch: (value: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (update: (value: 'grid' | 'list') => 'grid' | 'list') => void;
  sidebarTab: 'notes' | 'archive';
  onTabChange: (value: 'notes' | 'archive') => void;
}

export default function KeepHeader({ onBack, search, setSearch, viewMode, setViewMode, sidebarTab, onTabChange }: KeepHeaderProps) {
  return (
    <WorkspaceHeader
      title="Notatki"
      onBack={onBack}
      center={<WorkspaceSearch value={search} onChange={setSearch} placeholder="Szukaj notatek…" />}
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode((value) => (value === 'grid' ? 'list' : 'grid'))}
          title={viewMode === 'grid' ? 'Lista' : 'Siatka'}
          aria-label={viewMode === 'grid' ? 'Pokaż listę' : 'Pokaż siatkę'}
        >
          {viewMode === 'grid' ? <LayoutList size={16} /> : <Grid3X3 size={16} />}
        </Button>
      }
      navigation={<Tabs tabs={[{ key: 'notes', label: 'Notatki' }, { key: 'archive', label: 'Archiwum' }]} active={sidebarTab} onChange={(key) => onTabChange(key as 'notes' | 'archive')} />}
    />
  );
}
