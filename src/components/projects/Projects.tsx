import { useState } from 'react';
import { FolderKanban, ChevronDown, ChevronRight } from 'lucide-react';
import { Pressable } from '../ui/ControlPrimitives';
import { Card } from '../ui/Card';
import DataStateNotice from '../core/DataStateNotice';
import LifeGoalsCard from './LifeGoalsCard';
import GoalCreateModal from './GoalCreateModal';
import RetroModal from './RetroModal';
import { PriorityTasksPanel } from './PriorityTasksPanel';
import { FocusProjectBanner } from './FocusProjectBanner';
import { ProjectCreateForm } from './ProjectCreateForm';
import { ProjectCardWrapper } from './ProjectCardWrapper';
import ProjectsSidebar from './ProjectsSidebar';
import { ProjectsHeader } from './ProjectsHeader';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import { useSession } from '../../store/useStore';
import { ProjectsProvider } from './context/ProjectsContext';
import { useProjectsContext } from './context/projectsContextStore';

export default function Projects({
  onNavigateTo,
  reviewOverdueDays = null,
}: {
  onNavigateTo?: (view: string) => void;
  reviewOverdueDays?: number | null;
}) {
  const session = useSession();
  const userId = session?.user.id || '';

  return (
    <ProjectsProvider userId={userId}>
      <ProjectsInner onNavigateTo={onNavigateTo} reviewOverdueDays={reviewOverdueDays} />
    </ProjectsProvider>
  );
}

function ProjectsInner({
  onNavigateTo,
  reviewOverdueDays: _reviewOverdueDays,
}: {
  onNavigateTo?: (view: string) => void;
  reviewOverdueDays?: number | null;
}) {
  const {
    loading, error, activeProjects, directionalGoalCount,
    setGoalCreateOpen, lifeGoals, items, handlers,
    pillarFilter, setPillarFilter,
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    showForm, form, setForm,
    busy, setShowForm, focusProject, stats, kpisByProject,
    setExpandedId, activeFiltered, pausedFiltered, pausedOpen,
    setPausedOpen, doneFiltered, doneOpen, setDoneOpen,
    goalCreateOpen, dreams, retroProject, retroForm, setRetroForm, userId, setError,
  } = useProjectsContext();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const goBack = () => onNavigateTo?.('dzis');

  if (loading) return <DataStateNotice tone="loading" title="Ładowanie projektów" detail="" />;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      <ProjectsSidebar
        pillarFilter={pillarFilter}
        onPillarFilterChange={setPillarFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onNavigateTo={onNavigateTo as (dest: string) => void}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <ProjectsHeader
          onBack={goBack}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          pillarFilter={pillarFilter}
          onPillarFilterChange={setPillarFilter}
          onAddGoal={() => setGoalCreateOpen(true)}
          activeCount={activeProjects.length}
          directionalGoalCount={directionalGoalCount}
        />

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6 space-y-5">
          {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

          <LifeGoalsCard userId={userId} lifeGoals={lifeGoals} />
          <PriorityTasksPanel items={items} onToggleDone={handlers.handleToggleTaskDone} />

          {showForm && (
            <ProjectCreateForm
              form={form} busy={busy}
              onChange={patch => setForm(f => ({ ...f, ...patch }))}
              onSubmit={() => handlers.handleCreate(form, setShowForm, setForm)}
            />
          )}

          <FocusProjectBanner
            focusProject={focusProject}
            activeFilteredFirst={activeFiltered[0]}
            stats={stats}
            kpisByProject={kpisByProject}
            onOpen={id => setExpandedId(prev => prev === id ? null : id)}
          />

          {activeFiltered.length === 0 ? (
            <Card variant="glass" padding="4rem 2rem" className="flex flex-col items-center justify-center text-center">
              <FolderKanban size={28} className="text-text-muted/30 mb-3" />
              <p className="text-base font-semibold text-text-secondary">Brak aktywnych projektów</p>
              <p className="text-sm text-text-muted mt-1">Kliknij „Nowy cel" żeby zacząć.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} />)}
            </div>
          )}

          {pausedFiltered.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-border-custom/60 overflow-hidden">
              <Pressable onClick={() => setPausedOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-solid/50 transition-colors">
                {pausedOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                <span className="text-sm font-semibold text-text-secondary">Pauza ({pausedFiltered.length})</span>
              </Pressable>
              {pausedOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-border-custom/30 pt-3">
                  {pausedFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} />)}
                </div>
              )}
            </div>
          )}

          {doneFiltered.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-border-custom/60 overflow-hidden">
              <Pressable onClick={() => setDoneOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-solid/50 transition-colors">
                {doneOpen ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                <span className="text-sm font-semibold text-text-secondary">Zakończone ({doneFiltered.length})</span>
              </Pressable>
              {doneOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-border-custom/30 pt-3">
                  {doneFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {goalCreateOpen && (
        <GoalCreateModal
          lifeGoals={lifeGoals} busy={busy}
          onClose={() => setGoalCreateOpen(false)}
          onConfirm={(preview, pillar) => handlers.handleGoalCreateConfirm(preview, pillar, dreams, setGoalCreateOpen)}
          onError={err => setError(err)}
        />
      )}

      {retroProject && (
        <RetroModal
          retroProject={retroProject} retroForm={retroForm}
          setRetroForm={setRetroForm}
          onSubmit={handlers.handleRetroSubmit}
          busy={busy}
        />
      )}

      <WorkspaceNavigation
        active="projekty"
        orientation="horizontal"
        onNavigate={onNavigateTo as (dest: string) => void}
        className="md:hidden fixed bottom-0 inset-x-0 z-[var(--z-overlay)] border-t border-border-custom bg-background/95 backdrop-blur-[var(--blur-xl)]"
      />
    </div>
  );
}
