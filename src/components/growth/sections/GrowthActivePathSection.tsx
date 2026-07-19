import { Target, Lightbulb, Zap, Plus, X, PlusCircle } from 'lucide-react';
import type { VanguardIdentityData } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';

interface GrowthActivePathSectionProps {
  identity: VanguardIdentityData | null;
  skills: LearningSkill[];
  onEdit: () => void;
}

export default function GrowthActivePathSection({ identity, skills, onEdit }: GrowthActivePathSectionProps) {
  const activePath = identity?.active_path || {};
  const mainSkill = skills.find(s => s.id === activePath.mainSkillId);
  const subSkill = skills.find(s => s.id === activePath.subSkillId);

  return (
    <Card variant="surface" padding="1.5rem" className="space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-border-custom/50 pb-4">
        <div>
          <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Aktywny Trening</span>
          <h3 className="text-lg font-black uppercase font-display mt-0.5">Aktywna Ścieżka</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit} className="uppercase font-black text-2xs">
          Edytuj Ścieżki
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Skill Card */}
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.02] p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-primary tracking-wider">
              <Target size={13} />
              Główna umiejętność (max 1)
            </div>
            {mainSkill ? (
              <div className="space-y-3">
                <h4 className="text-base font-black text-text-primary leading-tight">{mainSkill.label}</h4>
                <div className="space-y-1">
                  <p className="text-3xs font-black uppercase tracking-wider text-text-muted">Po co mi to?</p>
                  <p className="text-xs text-text-secondary">{activePath.mainSkillWhy || 'Brak opisu'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xs font-black uppercase tracking-wider text-text-muted">Definicja "umię"</p>
                  <p className="text-xs text-text-secondary">{activePath.mainSkillDefinition || 'Brak definicji sukcesu'}</p>
                </div>
                {activePath.mainSkillReviewDate && (
                  <p className="text-3xs font-black uppercase text-primary bg-primary/10 rounded-full px-2 py-0.5 w-max">
                    Kolejny przegląd: {activePath.mainSkillReviewDate}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">Nie wybrano głównej umiejętności.</p>
            )}
          </div>
        </div>

        {/* Secondary Skill Card */}
        <div className="rounded-2xl border border-border-custom bg-background/20 p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <Zap size={13} className="text-warning" />
              Poboczna umiejętność (max 1)
            </div>
            {subSkill ? (
              <div className="space-y-3">
                <h4 className="text-base font-black text-text-primary leading-tight">{subSkill.label}</h4>
                <div className="space-y-1">
                  <p className="text-3xs font-black uppercase tracking-wider text-text-muted">Po co mi to?</p>
                  <p className="text-xs text-text-secondary">{activePath.subSkillWhy || 'Brak opisu'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xs font-black uppercase tracking-wider text-text-muted">Definicja "umię"</p>
                  <p className="text-xs text-text-secondary">{activePath.subSkillDefinition || 'Brak definicji sukcesu'}</p>
                </div>
                {activePath.subSkillReviewDate && (
                  <p className="text-3xs font-black uppercase text-text-muted bg-border-custom rounded-full px-2 py-0.5 w-max">
                    Kolejny przegląd: {activePath.subSkillReviewDate}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">Nie wybrano pobocznej umiejętności.</p>
            )}
          </div>
        </div>

        {/* Active Experiment Card */}
        <div className="rounded-2xl border border-dashed border-border-custom bg-background/10 p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-2xs font-black uppercase text-text-muted tracking-wider">
              <Lightbulb size={13} className="text-success" />
              Aktywny eksperyment (max 1)
            </div>
            {activePath.experimentTitle ? (
              <div className="space-y-3">
                <h4 className="text-base font-black text-text-primary leading-tight">{activePath.experimentTitle}</h4>
                <div className="space-y-1">
                  <p className="text-3xs font-black uppercase tracking-wider text-text-muted">Po co mi to?</p>
                  <p className="text-xs text-text-secondary">{activePath.experimentWhy || 'Brak opisu'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xs font-black uppercase tracking-wider text-text-muted">Definicja "umię"</p>
                  <p className="text-xs text-text-secondary">{activePath.experimentDefinition || 'Brak definicji sukcesu'}</p>
                </div>
                {activePath.experimentReviewDate && (
                  <p className="text-3xs font-black uppercase text-success bg-success/10 rounded-full px-2 py-0.5 w-max">
                    Kolejny przegląd: {activePath.experimentReviewDate}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">Brak aktywnego eksperymentu.</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-3xs text-text-muted uppercase font-black text-center tracking-widest pt-2 border-t border-border-custom/40">
        Ograniczenie do maksymalnie jednej aktywnej ścieżki chroni przed kolekcjonowaniem teorii bez zastosowania.
      </p>
    </Card>
  );
}
