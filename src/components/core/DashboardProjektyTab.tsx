import { FolderKanban } from 'lucide-react';
import { Card } from '../ui/Card';
import Spinner from '../ui/Spinner';
import { useSession } from '../../store/useStore';
import { ProjectsProvider } from '../projects/context/ProjectsContext';
import { useProjectsContext } from '../projects/context/projectsContextStore';
import { ProjectCardWrapper } from '../projects/ProjectCardWrapper';

function ViewFallback() {
  return (
    <div className="flex min-h-[var(--legacy-h-017)] items-center justify-center rounded-lg border border-on-accent/[0.06] bg-on-accent/[0.02]">
      <Spinner size="md" />
    </div>
  );
}

function DashboardProjektyContent() {
  const { loading, activeFiltered, pausedFiltered, doneFiltered, activeProjects, directionalGoalCount } = useProjectsContext();

  if (loading) return <ViewFallback />;

  return (
    <div className="p-5 pb-8 space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">Projekty</h2>
        <p className="text-sm text-text-muted">{activeProjects.length} aktywnych · {directionalGoalCount} kierunki</p>
      </div>

      {activeFiltered.length === 0 ? (
        <Card variant="glass" padding="4rem 2rem" className="flex flex-col items-center justify-center text-center">
          <FolderKanban size={28} className="text-text-muted/30 mb-3" />
          <p className="text-base font-semibold text-text-secondary">Brak aktywnych projektów</p>
          <p className="text-sm text-text-muted mt-1">Otwórz wersję desktopową żeby dodać pierwszy projekt.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} />)}
        </div>
      )}

      {pausedFiltered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-text-muted">Pauza ({pausedFiltered.length})</p>
          {pausedFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} />)}
        </div>
      )}

      {doneFiltered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-text-muted">Zakończone ({doneFiltered.length})</p>
          {doneFiltered.map(p => <ProjectCardWrapper key={p.id} project={p} />)}
        </div>
      )}
    </div>
  );
}

export function DashboardProjektyTab() {
  const session = useSession();

  if (!session) return null;

  return (
    <ProjectsProvider userId={session.user.id}>
      <DashboardProjektyContent />
    </ProjectsProvider>
  );
}
