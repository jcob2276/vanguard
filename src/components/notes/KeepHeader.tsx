import { Grid3X3, LayoutList, Columns } from 'lucide-react';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';

interface KeepHeaderProps {
  onBack: () => void;
  search: string;
  setSearch: (value: string) => void;
  viewMode: 'grid' | 'list' | 'split';
  setViewMode: (value: 'grid' | 'list' | 'split') => void;
}

export default function KeepHeader({ onBack, search, setSearch, viewMode, setViewMode }: KeepHeaderProps) {
  return (
    <WorkspaceHeader
      title="Notatki"
      onBack={onBack}
      search={{ value: search, onChange: setSearch, placeholder: 'Szukaj notatek…' }}
      tabs={{
        items: [
          { key: 'grid', label: 'Siatka', icon: <Grid3X3 size={14} /> },
          { key: 'list', label: 'Lista', icon: <LayoutList size={14} /> },
          { key: 'split', label: 'Podział', icon: <Columns size={14} /> },
        ],
        active: viewMode,
        onChange: (key) => setViewMode(key as 'grid' | 'list' | 'split'),
      }}
    />
  );
}
