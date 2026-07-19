import { Target, AlertTriangle, Play, CheckCircle } from 'lucide-react';
import type { VanguardIdentityData } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';

interface GrowthHeaderSectionProps {
  identity: VanguardIdentityData | null;
  skills: LearningSkill[];
  onEdit: () => void;
}

export default function GrowthHeaderSection({ identity, skills, onEdit }: GrowthHeaderSectionProps) {
  const activeSkillId = identity?.active_path?.mainSkillId;
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const activeSkillLabel = activeSkill ? activeSkill.label : (activeSkillId || 'Nie wybrano');

  const latestEvidence = identity?.practice_evidences && identity.practice_evidences.length > 0
    ? [...identity.practice_evidences].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  return (
    <Card variant="surface" padding="1.5rem" className="relative overflow-hidden border border-primary/20 bg-primary/[0.02]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <span className="text-2xs font-black uppercase tracking-[0.2em] text-primary">Kierunek Rozwoju</span>
          <h2 className="text-2xl font-black font-display uppercase tracking-tight mt-1">
            {identity?.development_theme || 'Zdefiniuj swój aktualny motyw'}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0 uppercase font-black tracking-wider text-xs">
          Zmień Kierunek
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border-custom bg-background/40 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <AlertTriangle size={12} className="text-warning" />
              Najważniejsza luka
            </div>
            <p className="text-sm font-bold text-text-primary mt-2">
              {identity?.development_gap || 'Nie określono'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border-custom bg-background/40 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <Target size={12} className="text-primary" />
              Aktywna umiejętność
            </div>
            <p className="text-sm font-bold text-text-primary mt-2">
              {activeSkillLabel}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border-custom bg-background/40 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <Play size={12} className="text-success" />
              Następna praktyka
            </div>
            <p className="text-sm font-bold text-text-primary mt-2">
              {identity?.active_path?.mainSkillWhy || 'Brak aktywnego planu praktyki'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border-custom bg-background/40 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <CheckCircle size={12} className="text-primary" />
              Ostatni dowód postępu
            </div>
            {latestEvidence ? (
              <div className="mt-2">
                <p className="text-sm font-bold text-text-primary line-clamp-1">
                  {latestEvidence.title}
                </p>
                <p className="text-2xs text-text-muted mt-1">
                  {latestEvidence.date}
                </p>
              </div>
            ) : (
              <p className="text-sm font-bold text-text-muted mt-2">Brak dowodów w tym cyklu</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
