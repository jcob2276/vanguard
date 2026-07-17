/**
 * @component DashboardProjektyTab
 * @role Zakładka KIERUNEK — trzy sfery, aktywne projekty i przejście do Top 5.
 * @composes projects/DirectionView
 * @usedBy Dashboard
 */
import Spinner from '../ui/Spinner';
import { useSession } from '../../store/useStore';
import { ProjectsProvider } from '../projects/context/ProjectsContext';
import { useProjectsContext } from '../projects/context/projectsContextStore';
import { DirectionView } from '../projects/DirectionView';

function ViewFallback() {
  return (
    <div className="flex min-h-[var(--ds-h-220px)] items-center justify-center rounded-lg border border-on-accent/[0.06] bg-on-accent/[0.02]">
      <Spinner size="md" />
    </div>
  );
}

function DashboardProjektyContent() {
  const { loading } = useProjectsContext();

  if (loading) return <ViewFallback />;
  return <DirectionView />;
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
