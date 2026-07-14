import { Plus, PanelLeft } from 'lucide-react';
import { Pressable } from '../ui/ControlPrimitives';
import { WorkspaceHeader } from '../shared/WorkspaceHeader';
import { PillarFilterTabs } from './PillarFilterTabs';
import type { PillarFilter } from './context/projectsContextStore';

interface ProjectsHeaderProps {
  onBack: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  pillarFilter: PillarFilter;
  onPillarFilterChange: (filter: PillarFilter) => void;
  onAddGoal: () => void;
  activeCount: number;
  directionalGoalCount: number;
}

export function ProjectsHeader({
  onBack,
  sidebarCollapsed,
  setSidebarCollapsed,
  searchQuery,
  setSearchQuery,
  pillarFilter,
  onPillarFilterChange,
  onAddGoal,
  activeCount,
  directionalGoalCount,
}: ProjectsHeaderProps) {
  return (
    <WorkspaceHeader
      title="Projekty"
      subtitle={`${activeCount} aktywnych · ${directionalGoalCount} kierunki`}
      onBack={onBack}
      leading={
        sidebarCollapsed ? (
          <Pressable
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(false)}
            title="Rozwiń panel boczny"
          >
            <PanelLeft size={16} />
          </Pressable>
        ) : undefined
      }
      search={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: 'Szukaj projektów…',
      }}
      actions={
        <Pressable
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={onAddGoal}
        >
          Nowy cel
        </Pressable>
      }
      secondaryRow={
        <PillarFilterTabs pillarFilter={pillarFilter} onChange={onPillarFilterChange} />
      }
    />
  );
}
