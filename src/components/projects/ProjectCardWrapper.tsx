/**
 * @component ProjectCardWrapper
 * @role Named-export shim wokół domyślnego eksportu ProjectCard (dla DashboardProjektyTab).
 * @composes ProjectCard -> ProjectCardCollapsed / ProjectCardExpanded (patrz ProjectCard.tsx)
 * @usedBy DashboardProjektyTab
 */
import ProjectCard from './ProjectCard';
import { ProjectRow } from './projectUtils';

export function ProjectCardWrapper({ project }: { project: ProjectRow }) {
  return (
    <ProjectCard project={project} />
  );
}
