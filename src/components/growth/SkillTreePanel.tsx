import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useMemo } from 'react';
import type { LearningSkill } from '../../lib/growth/growth';
import { SCORE_LABELS, SCORE_RUBRICS } from '../../lib/growth/growth';
import SkillRadarPanel from './SkillRadarPanel';
import { Card } from '../ui/Card';

function SubSkillRow({
  skill,
  val,
  prev,
  showPrev,
  editing,
  onDraftChange,
}: {
  skill: LearningSkill;
  val: number;
  prev: number | undefined;
  showPrev: boolean;
  editing: boolean;
  onDraftChange: (key: string, val: number) => void;
}) {
  const delta = prev != null && showPrev ? val - prev : null;
  return (
    <div className="space-y-1 pl-3 border-l-2 border-primary/15">
      <div className="flex justify-between items-center gap-2 text-xs">
        <span className="font-semibold text-text-secondary truncate">{skill.label}</span>
        <span className="shrink-0 font-black text-primary tabular-nums">
          {val}/5
          {delta != null && delta !== 0 && (
            <span className={`ml-1 text-2xs ${delta > 0 ? 'text-success' : 'text-danger'}`}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </span>
      </div>
      {editing ? (
        <ControlInput
          type="range"
          min={0}
          max={5}
          value={val}
          onChange={(e) => onDraftChange(skill.key, parseInt(e.target.value, 10))}
          className="w-full h-1 bg-border-custom rounded-lg appearance-none cursor-pointer accent-primary"
        />
      ) : (
        <div className="h-1 rounded-full bg-border-custom overflow-hidden">
          <div className="h-full bg-primary/50 rounded-full" style={{ width: `${(val / 5) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

export default function SkillTreePanel({
  parents,
  childrenByParentId,
  scores,
  prevScores,
  showPrev,
  editing,
  draftScores,
  onDraftChange,
  grid,
  expandedParentId,
  onExpandParent,
}: {
  parents: LearningSkill[];
  childrenByParentId: Map<string, LearningSkill[]>;
  scores: Record<string, number>;
  prevScores: Record<string, number> | null;
  showPrev: boolean;
  editing: boolean;
  draftScores: Record<string, number>;
  onDraftChange: (key: string, val: number) => void;
  grid: string;
  expandedParentId: string | null;
  onExpandParent: (id: string | null) => void;
}) {
  const display = editing ? draftScores : scores;

  const avgSubScore = useMemo(() => {
    const fn = (parentId: string) => {
      const subs = childrenByParentId.get(parentId) ?? [];
      if (subs.length === 0) return null;
      const sum = subs.reduce((acc, s) => acc + (display[s.key] ?? 0), 0);
      return Math.round((sum / subs.length) * 10) / 10;
    };
    return fn;
  }, [childrenByParentId, display]);

  return (
    <div className="space-y-5">
      <SkillRadarPanel
        skills={parents}
        scores={display}
        prevScores={prevScores}
        showPrev={showPrev}
        editing={editing}
        draftScores={draftScores}
        onDraftChange={onDraftChange}
        grid={grid}
      />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-2em)] text-text-muted">Pod-skilli</p>
          <p className="text-2xs text-text-muted">Kliknij skill · skala 0–5</p>
        </div>

        <div className="space-y-2">
          {parents.map((parent) => {
            const subs = childrenByParentId.get(parent.id) ?? [];
            const open = expandedParentId === parent.id;
            const parentVal = display[parent.key] ?? 0;
            const subAvg = avgSubScore(parent.id);

            return (
              <Card key={parent.id} variant="outline" padding="0" className="!rounded-xl">
                <Pressable
                  type="button"
                  onClick={() => onExpandParent(open ? null : parent.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface/50 cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{parent.label}</p>
                    <p className="text-2xs text-text-muted mt-0.5">
                      {subs.length} pod-skilli
                      {subAvg != null && ` · śr. pod ${subAvg}/5`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-primary tabular-nums">{parentVal}/5</span>
                </Pressable>

                {open && (
                  <div className="border-t border-border-custom bg-surface/30 px-3 py-3 space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-black uppercase text-text-muted">Skill ogólny</span>
                        <span className="font-black text-primary tabular-nums">{parentVal}/5</span>
                      </div>
                      {editing ? (
                        <ControlInput
                          type="range"
                          min={0}
                          max={5}
                          value={parentVal}
                          onChange={(e) => onDraftChange(parent.key, parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-border-custom rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      ) : (
                        <div className="h-1.5 rounded-full bg-border-custom overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full"
                            style={{ width: `${(parentVal / 5) * 100}%` }}
                          />
                        </div>
                      )}
                      <p className="text-2xs text-text-muted">{SCORE_RUBRICS[parentVal] ?? SCORE_LABELS[parentVal]}</p>
                    </div>

                    {subs.length > 0 && (
                      <div className="space-y-2.5 pt-1">
                        <p className="text-2xs font-black uppercase tracking-wider text-text-muted">Szczegóły</p>
                        {subs.map((sub) => (
                          <SubSkillRow
                            key={sub.id}
                            skill={sub}
                            val={display[sub.key] ?? 0}
                            prev={prevScores?.[sub.key]}
                            showPrev={showPrev}
                            editing={editing}
                            onDraftChange={onDraftChange}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
