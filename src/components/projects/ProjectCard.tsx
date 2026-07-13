import { Card } from '../ui/Card';
import {
  colorOf, PILLAR_META, ProjectStats, ProjectRow,
  calculateHealthScore, getHealthLevel, HEALTH_COLORS, getNextAction, getProjectMomentum
} from './projectUtils';
import ProjectCardExpanded from './ProjectCardExpanded';
import ProjectCardCollapsed from './ProjectCardCollapsed';
import { useProjectsContext } from './context/projectsContextStore';

const MOMENTUM_META: Record<string, { label: string; color: string }> = {
  accelerating: { label: '↑ Momentum', color: '#10b981' },
  steady:       { label: '→ Steady',   color: '#3b82f6' },
  slipping:     { label: '↓ Slipuje',  color: '#f59e0b' },
  stalled:      { label: '✕ Stale',   color: '#f43f5e' },
};

const emptyStats: ProjectStats = {
  section: null, openItems: [], doneItems: [], total: 0, progress: 0,
  lastActivity: null, daysSince: null, slipping: false, daysLeft: null,
};

interface ProjectCardProps {
  project: ProjectRow;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const {
    stats, checkpointsByProject, kpisByProject, projectPillar, expandedId
  } = useProjectsContext();

  const s = stats[project.id] ?? emptyStats;
  const isExpanded = expandedId === project.id;
  const projectCheckpoints = checkpointsByProject[project.id] ?? [];
  const doneCheckpoints = projectCheckpoints.filter(cp => cp.status === 'done').length;

  const col = colorOf(project.color);
  const pillar = projectPillar(project);
  const pm = pillar ? PILLAR_META[pillar] : null;
  const kpis = kpisByProject[project.id] ?? [];
  const healthScore = calculateHealthScore(project, s, kpis);
  const healthLevel = getHealthLevel(healthScore);
  const healthColors = HEALTH_COLORS[healthLevel];
  const momentum = getProjectMomentum(s);
  const nextAction = getNextAction(s.openItems);
  const momentumMeta = MOMENTUM_META[momentum];

  // Checkpoint mini-timeline (show up to 5)
  const visibleCps = projectCheckpoints.slice(0, 5);

  return (
    <Card
      variant="glass"
      padding="0"
      className={`overflow-hidden hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.10)] ${
        healthLevel === 'critical' && project.status === 'active'
          ? 'border-rose-500/30 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]'
          : 'border-border-custom'
      }`}
      style={{ borderRadius: '22px' }}
    >
      {/* Color accent strip */}
      <div className={`h-0.5 w-full ${col.bar} opacity-70`} />

      {/* Collapsed Card header */}
      <ProjectCardCollapsed
        project={project}
        s={s}
        isExpanded={isExpanded}
        col={col}
        pm={pm}
        momentumMeta={momentumMeta}
        healthScore={healthScore}
        kpis={kpis}
        visibleCps={visibleCps}
        doneCheckpoints={doneCheckpoints}
        projectCheckpoints={projectCheckpoints}
        nextAction={nextAction}
      />

      {/* ── EXPANDED SECTION ── */}
      {isExpanded && (
        <ProjectCardExpanded
          project={project}
          s={s}
          col={col}
          healthScore={healthScore}
          healthColors={healthColors}
          nextAction={nextAction}
          projectCheckpoints={projectCheckpoints}
          doneCheckpoints={doneCheckpoints}
        />
      )}
    </Card>
  );
}
