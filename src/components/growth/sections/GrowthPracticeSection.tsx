import { Award, Zap, BookOpen, Hammer, Activity, type LucideIcon } from 'lucide-react';
import type { PracticeEvidence } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';

interface GrowthPracticeSectionProps {
  evidences: PracticeEvidence[];
  skills: LearningSkill[];
  onAdd: () => void;
  onEditItem: (item: PracticeEvidence) => void;
}

const COMPETENCE_LEVELS: Record<PracticeEvidence['competenceLevel'], { label: string; color: string; icon: LucideIcon }> = {
  consume: { label: 'Konsumuję', color: 'bg-border-custom text-text-muted', icon: BookOpen },
  understand: { label: 'Rozumiem', color: 'bg-primary/10 text-primary', icon: Zap },
  try: { label: 'Próbuję', color: 'bg-warning/10 text-warning', icon: Activity },
  can_do: { label: 'Potrafię', color: 'bg-success/15 text-success', icon: Hammer },
  apply_regularly: { label: 'Stosuję regularnie', color: 'bg-success/20 text-success border border-success/20', icon: Award }
};

export default function GrowthPracticeSection({ evidences, skills, onAdd, onEditItem }: GrowthPracticeSectionProps) {
  return (
    <Card variant="surface" padding="1.5rem" className="space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-border-custom/50 pb-4">
        <div>
          <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Dowody Zastosowania</span>
          <h3 className="text-lg font-black uppercase font-display mt-0.5">Praktyka i Dowody</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} className="uppercase font-black text-2xs">
          + Zaloguj Praktykę
        </Button>
      </div>

      <div className="space-y-3">
        {evidences.map(ev => {
          const levelMeta = COMPETENCE_LEVELS[ev.competenceLevel] || { label: ev.competenceLevel, color: 'bg-border-custom text-text-muted', icon: Award };
          const LevelIcon = levelMeta.icon;
          const matchedSkill = skills.find(s => s.id === ev.skillId);

          return (
            <Card
              key={ev.id}
              variant="outline"
              padding="1rem"
              onClick={() => onEditItem(ev)}
              className="bg-background/20 hover:bg-background/40 transition-all border border-border-custom/60 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-3xs font-black uppercase tracking-wider text-text-muted bg-border-custom px-2 py-0.5 rounded">
                    {ev.type}
                  </span>
                  {matchedSkill && (
                    <span className="text-3xs font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                      Skill: {matchedSkill.label}
                    </span>
                  )}
                  <span className="text-3xs text-text-muted">{ev.date}</span>
                </div>
                <h4 className="text-sm font-black text-text-primary leading-tight">{ev.title}</h4>
                {ev.details && <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{ev.details}</p>}
              </div>

              <div className="shrink-0 flex items-center">
                <span className={`text-2xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${levelMeta.color}`}>
                  <LevelIcon size={12} />
                  {levelMeta.label}
                </span>
              </div>
            </Card>
          );
        })}

        {evidences.length === 0 && (
          <div className="rounded-xl border border-dashed border-border-custom py-12 text-center">
            <p className="text-xs text-text-muted italic">Nie zalogowano jeszcze żadnych dowodów praktyki.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
