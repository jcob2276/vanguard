import { CircleDot, Pause, CheckCircle2 } from 'lucide-react';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import type { WorkspaceDestination } from '../shared/WorkspaceNavigation';
import WorkspaceSidebar from '../shared/WorkspaceSidebar';
import SidebarSection from '../shared/SidebarSection';
import { PILLARS, PILLAR_META, type PillarId } from '../../lib/projects/pillars';
import type { PillarFilter, StatusFilter } from './context/projectsContextStore';

interface ProjectsSidebarProps {
  pillarFilter: PillarFilter;
  onPillarFilterChange: (filter: PillarFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onNavigateTo?: (dest: WorkspaceDestination) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ProjectsSidebar({
  pillarFilter,
  onPillarFilterChange,
  statusFilter,
  onStatusFilterChange,
  onNavigateTo,
  collapsed,
  onToggleCollapse,
}: ProjectsSidebarProps) {
  return (
    <WorkspaceSidebar collapsed={collapsed} onCollapse={onToggleCollapse} className="gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="px-2.5 py-1 text-xs font-black uppercase tracking-wider text-text-muted/60">Workspace</p>
        <WorkspaceNavigation
          active="projekty"
          onNavigate={(destination) => onNavigateTo?.(destination)}
        />
      </div>

      <SidebarSection
        bordered
        label="Filtry"
        items={[
          {
            id: 'all',
            label: 'Wszystko',
            active: pillarFilter === 'all',
            onClick: () => onPillarFilterChange('all'),
          },
          ...PILLARS.map((p: PillarId) => {
            const meta = PILLAR_META[p];
            return {
              id: p,
              label: meta.label,
              icon: <meta.icon size={14} />,
              active: pillarFilter === p,
              onClick: () => onPillarFilterChange(p),
              colorDot: meta.dot,
            };
          }),
        ]}
      />

      <SidebarSection
        bordered
        label="Status"
        items={[
          {
            id: 'all',
            label: 'Wszystkie',
            icon: <CircleDot size={14} />,
            active: statusFilter === 'all',
            onClick: () => onStatusFilterChange('all'),
          },
          {
            id: 'active',
            label: 'Aktywne',
            icon: <CircleDot size={14} />,
            active: statusFilter === 'active',
            onClick: () => onStatusFilterChange('active'),
          },
          {
            id: 'paused',
            label: 'Pauza',
            icon: <Pause size={14} />,
            active: statusFilter === 'paused',
            onClick: () => onStatusFilterChange('paused'),
          },
          {
            id: 'done',
            label: 'Zakończone',
            icon: <CheckCircle2 size={14} />,
            active: statusFilter === 'done',
            onClick: () => onStatusFilterChange('done'),
          },
        ]}
      />
    </WorkspaceSidebar>
  );
}
