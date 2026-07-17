/**
 * @component KeepHeader
 * @role Pasek góry: search + przełącznik trybu widoku (grid/list/split).
 * @usedBy Keep
 */
import { Grid3X3, LayoutList, Columns } from 'lucide-react';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';

interface KeepHeaderProps {
  onBack: () => void;
  viewMode: 'grid' | 'list' | 'split';
  setViewMode: (value: 'grid' | 'list' | 'split') => void;
}

export default function KeepHeader({ onBack, viewMode, setViewMode }: KeepHeaderProps) {
  return (
    <WorkspaceHeader
      title="Notatki"
      onBack={onBack}
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
