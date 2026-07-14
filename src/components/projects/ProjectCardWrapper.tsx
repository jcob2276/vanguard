import ProjectCard from './ProjectCard';
import { ProjectRow } from './projectUtils';

export function ProjectCardWrapper({ project }: { project: ProjectRow }) {
  return (
    <ProjectCard project={project} />
  );
}
