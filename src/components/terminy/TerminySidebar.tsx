import React from 'react';
import { User, Car, FileText, Calendar } from 'lucide-react';
import WorkspaceSidebar from '../shared/WorkspaceSidebar';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import SidebarSection from '../shared/SidebarSection';
import type { TerminyTabKey } from './TerminyPage';
import type { DerivedObligation } from './terminyDerived';

interface TerminySidebarProps {
  tab: TerminyTabKey;
  setTab: (tab: TerminyTabKey) => void;
  rows: DerivedObligation[];
  onNavigateTo?: (dest: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function TerminySidebar({
  tab,
  setTab,
  rows,
  onNavigateTo,
  collapsed,
  onToggleCollapse,
}: TerminySidebarProps) {
  const peopleCount = rows.filter((r) => r.item.kind === 'people').length;
  const vehicleCount = rows.filter((r) => r.item.kind === 'vehicle').length;
  const documentCount = rows.filter((r) => r.item.kind === 'document').length;

  return (
    <WorkspaceSidebar collapsed={collapsed} onCollapse={onToggleCollapse} className="select-none">
      <div className={`flex-1 overflow-y-auto ${collapsed ? 'px-1 py-2 space-y-4' : 'px-4 pb-4 space-y-6'}`}>
        <div>
          {!collapsed && <p className="pixel-label mb-1.5 px-2.5 text-text-muted/60">Workspace</p>}
          <WorkspaceNavigation active="terminy" onNavigate={onNavigateTo} />
        </div>

        <SidebarSection
          label="Terminy i Kategorie"
          items={[
            {
              id: 'horizon',
              label: 'Nadchodzące',
              icon: <Calendar size={15} />,
              count: rows.length,
              active: tab === 'horizon',
              onClick: () => setTab('horizon'),
            },
            {
              id: 'people',
              label: 'Ludzie (Urodziny)',
              icon: <User size={15} />,
              count: peopleCount,
              active: tab === 'people',
              onClick: () => setTab('people'),
            },
            {
              id: 'vehicle',
              label: 'Pojazd (Przeglądy)',
              icon: <Car size={15} />,
              count: vehicleCount,
              active: tab === 'vehicle',
              onClick: () => setTab('vehicle'),
            },
            {
              id: 'document',
              label: 'Dokumenty (Polisy)',
              icon: <FileText size={15} />,
              count: documentCount,
              active: tab === 'document',
              onClick: () => setTab('document'),
            },
          ]}
        />
      </div>
    </WorkspaceSidebar>
  );
}
