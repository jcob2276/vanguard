import { useState } from 'react';
import { X, Sparkles, Activity, Dumbbell, ShieldCheck, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import type { PhysiqueAnalysisResult, MuscleGroupAnalysis } from '../../lib/physiqueApi';
import { Pressable } from '../ui/ControlPrimitives';
import { Card } from '../ui/Card';

interface Props {
  analysis: PhysiqueAnalysisResult;
  photoDate?: string;
  onClose: () => void;
}

export default function PhysiqueAnalysisModal({ analysis, photoDate, onClose }: Props) {
  const [showAllMuscles, setShowAllMuscles] = useState(false);

  const displayedMuscles = showAllMuscles
    ? analysis.muscle_groups
    : analysis.muscle_groups.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/60 backdrop-blur-[var(--blur-md)] animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-surface border border-border-custom rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-custom bg-surface-solid/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-black font-display tracking-tight text-text-primary uppercase">
                Analiza Sylwetki AI
              </h2>
              {photoDate && (
                <p className="text-2xs font-bold text-text-muted uppercase tracking-wider">
                  Check-in: {photoDate}
                </p>
              )}
            </div>
          </div>
          <Pressable
            onClick={onClose}
            variant="ghost"
            icon={<X size={18} />}
            className="text-text-muted hover:text-text-primary p-2 rounded-xl"
          />
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 [scrollbar-width:none]">
          
          {/* Main Score Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card padding="1rem" className="text-center bg-primary/5 border-primary/20">
              <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Physique Score</span>
              <p className="mt-1 text-2xl font-black font-display text-primary">{analysis.overall_score}<span className="text-xs text-text-muted">/100</span></p>
            </Card>

            <Card padding="1rem" className="text-center">
              <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">% Body Fat</span>
              <p className="mt-1 text-lg font-black font-display text-text-primary">{analysis.body_fat_estimate}</p>
            </Card>

            <Card padding="1rem" className="text-center">
              <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Conditioning</span>
              <p className="mt-1 text-lg font-black font-display text-text-primary">{analysis.conditioning_score}<span className="text-xs text-text-muted">/100</span></p>
            </Card>

            <Card padding="1rem" className="text-center">
              <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Symetria</span>
              <p className="mt-1 text-lg font-black font-display text-text-primary">{analysis.symmetry_score}<span className="text-xs text-text-muted">/100</span></p>
            </Card>
          </div>

          {/* AI Coaching Summary */}
          {analysis.coaching_summary && (
            <Card padding="1.25rem" className="border-border-custom bg-surface-solid/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-primary tracking-wider font-display">
                <Activity size={15} />
                <span>Wnioski AI Trenera</span>
              </div>
              <p className="text-xs leading-relaxed text-text-secondary font-medium">
                {analysis.coaching_summary}
              </p>
            </Card>
          )}

          {/* Priorities */}
          {analysis.priorities && analysis.priorities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-muted font-display">
                Priorytety Treningowe
              </h3>
              <div className="space-y-2">
                {analysis.priorities.map((priority, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-surface border border-border-custom text-xs font-medium text-text-primary">
                    <div className="mt-0.5 shrink-0 text-primary">
                      <Dumbbell size={14} />
                    </div>
                    <span>{priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 15 Muscle Groups Breakdown */}
          {analysis.muscle_groups && analysis.muscle_groups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-text-muted font-display">
                  Rozbicie Grup Mięśniowych ({analysis.muscle_groups.length})
                </h3>
                <button
                  onClick={() => setShowAllMuscles(!showAllMuscles)}
                  className="text-2xs font-bold uppercase tracking-wider text-primary flex items-center gap-1 hover:underline"
                >
                  <span>{showAllMuscles ? 'Pokaż mniej' : `Pokaż wszystkie (${analysis.muscle_groups.length})`}</span>
                  {showAllMuscles ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {displayedMuscles.map((muscle, idx) => (
                  <MuscleGroupCard key={idx} muscle={muscle} />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-border-custom bg-surface-solid/50">
          <Pressable
            onClick={onClose}
            variant="ghost"
            className="px-6 py-2 bg-primary text-on-accent font-display font-bold text-xs uppercase rounded-xl hover:bg-primary-hover transition-all"
          >
            Zamknij
          </Pressable>
        </div>

      </div>
    </div>
  );
}

function MuscleGroupCard({ muscle }: { muscle: MuscleGroupAnalysis }) {
  const isLagging = muscle.status === 'lagging';
  const isStrong = muscle.status === 'strong';

  const badgeColor = isStrong
    ? 'bg-success/10 text-success border-success/20'
    : isLagging
    ? 'bg-warning/10 text-warning border-warning/20'
    : 'bg-primary/10 text-primary border-primary/20';

  const StatusIcon = isStrong ? ShieldCheck : isLagging ? AlertCircle : CheckCircle2;

  return (
    <div className="p-3 rounded-2xl border border-border-custom bg-surface space-y-1.5 hover:border-border-custom/80 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-primary font-display">{muscle.name}</span>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-2xs font-black uppercase ${badgeColor}`}>
          <StatusIcon size={12} />
          <span>{muscle.score}/100</span>
        </div>
      </div>
      <p className="text-2xs text-text-secondary leading-snug font-medium">
        {muscle.notes}
      </p>
    </div>
  );
}
