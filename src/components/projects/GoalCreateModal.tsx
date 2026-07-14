import { Pressable, ControlTextarea } from '../ui/ControlPrimitives';
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PILLARS, PILLAR_META, GOAL_QUESTIONS, PillarId } from './projectUtils';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import type { GoalCreatePreview } from './useProjectsData';

export interface GoalCreateModalProps {
  lifeGoals: Record<string, unknown> | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (preview: GoalCreatePreview, pillar: PillarId) => void;
  onError: (err: string) => void;
}

export default function GoalCreateModal({
  lifeGoals,
  busy,
  onClose,
  onConfirm,
  onError
}: GoalCreateModalProps) {
  const [goalCreateStep, setGoalCreateStep] = useState<'pillar' | number | 'loading' | 'preview'>('pillar');
  const [goalCreatePillar, setGoalCreatePillar] = useState<PillarId | ''>('');
  const [goalCreateAnswers, setGoalCreateAnswers] = useState({
    goal: '',
    why: '',
    milestones: '',
    blockers: '',
    weekly_actions: ''
  });
  const [goalCreatePreview, setGoalCreatePreview] = useState<GoalCreatePreview | null>(null);

  const handleGoalCreateNext = (currentVal: string) => {
    const step = goalCreateStep as number;
    const key = GOAL_QUESTIONS[step].key;
    const updatedAnswers = { ...goalCreateAnswers, [key]: currentVal };
    setGoalCreateAnswers(updatedAnswers);

    if (step < GOAL_QUESTIONS.length - 1) {
      setGoalCreateStep(step + 1);
    } else {
      handleGoalCreateSubmit(updatedAnswers);
    }
  };

  const handleGoalCreateSubmit = async (answers: typeof goalCreateAnswers) => {
    setGoalCreateStep('loading');
    try {
      const { data, error } = await supabase.functions.invoke('vanguard-oracle?action=goal-create', {
        body: { answers, pillar: goalCreatePillar, userName: 'Jakub' }
      });
      if (error) throw error;
      setGoalCreatePreview(data);
      setGoalCreateStep('preview');
    } catch (err: unknown) {
      onError('AI: ' + (err as Error).message);
      setGoalCreateStep(GOAL_QUESTIONS.length - 1);
    }
  };

  const isPillar = goalCreateStep === 'pillar';
  const isLoading = goalCreateStep === 'loading';
  const isPreview = goalCreateStep === 'preview';
  const qIdx = typeof goalCreateStep === 'number' ? goalCreateStep : 0;
  const q = GOAL_QUESTIONS[qIdx];
  const pm = goalCreatePillar ? PILLAR_META[goalCreatePillar] : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      showCloseButton={false}
      size="sm"
    >
      {/* Header strip */}
      <div className={`-mx-5 -mt-5 px-5 py-3 flex items-center justify-between ${pm ? pm.bg : 'bg-surface-solid/50'}`}>
        <div className="flex items-center gap-2">
          {pm && <pm.icon size={13} className={pm.text} />}
          <span className={`text-xs font-black uppercase tracking-widest ${pm ? pm.text : 'text-text-muted'}`}>
            {pm ? pm.label : 'Nowy cel'}
          </span>
        </div>
      </div>

      <div className="space-y-5">
          {/* PILLAR SELECTION */}
          {isPillar && (
            <div className="space-y-3">
              <p className="text-lg font-black text-text-primary leading-tight">Pod który filar?</p>
              <div className="space-y-2">
                {PILLARS.map(p => {
                  const meta = PILLAR_META[p];
                  const lg = lifeGoals?.[`goal_${p}`] as string | undefined;
                  return (
                    <Pressable
                      key={p}
                      onClick={() => {
                        setGoalCreatePillar(p);
                        setGoalCreateStep(0);
                      }}
                      className={`w-full text-left rounded-[var(--radius-lg)] border p-3.5 transition-all hover:scale-[var(--legacy-arbitrary-013)] cursor-pointer ${meta.border} ${meta.bg}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <meta.icon size={13} className={meta.text} />
                        <span className={`text-xs font-black uppercase tracking-widest ${meta.text}`}>
                          {meta.label}
                        </span>
                      </div>
                      {lg && <p className="text-sm text-text-secondary leading-snug line-clamp-1">{lg}</p>}
                    </Pressable>
                  );
                })}
              </div>
            </div>
          )}

          {/* QUESTIONS */}
          {typeof goalCreateStep === 'number' && (() => {
            const currentKey = q.key as keyof typeof goalCreateAnswers;
            const val = goalCreateAnswers[currentKey];
            return (
              <div className="space-y-4">
                {/* Progress dots */}
                <div className="flex gap-1.5">
                  {GOAL_QUESTIONS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i <= qIdx ? (pm?.dot ?? 'bg-primary') : 'bg-border-custom/50'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xl font-black text-text-primary leading-snug">{q.q}</p>
                <ControlTextarea
                  autoFocus
                  rows={3}
                  value={val}
                  onChange={e => setGoalCreateAnswers(a => ({ ...a, [currentKey]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && val.trim()) {
                      e.preventDefault();
                      handleGoalCreateNext(val);
                    }
                  }}
                  placeholder={q.hint}
                  className="w-full resize-none rounded-[var(--radius-md)] border border-border-custom bg-surface-solid/40 px-4 py-3 text-base text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/35 leading-relaxed"
                />
                <p className="text-xs text-text-muted/60">Enter = dalej · Shift+Enter = nowa linia</p>
                <div className="flex gap-2">
                  <Pressable
                    variant="outline"
                    onClick={() => setGoalCreateStep(qIdx > 0 ? qIdx - 1 : 'pillar')}
                    className="px-4 py-3 text-sm"
                  >
                    ← Wstecz
                  </Pressable>
                  <Pressable
                    onClick={() => {
                      if (val.trim()) handleGoalCreateNext(val);
                    }}
                    disabled={!val.trim()}
                    className="flex-1 py-3 text-sm"
                  >
                    {qIdx < GOAL_QUESTIONS.length - 1 ? 'Dalej →' : 'Generuj cel ✦'}
                  </Pressable>
                </div>
              </div>
            );
          })()}

          {/* LOADING */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Spinner size="md" />
              <p className="text-base font-semibold text-text-secondary">AI analizuje Twój cel...</p>
              <p className="text-xs text-text-muted">Generuje projekt, KPI i kamienie milowe</p>
            </div>
          )}

          {/* PREVIEW */}
          {isPreview && goalCreatePreview && pm && (
            <div className="space-y-4">
              <div>
                <p className="text-2xs font-black uppercase tracking-widest text-text-muted mb-1">Projekt</p>
                <p className="text-lg font-black text-text-primary">{goalCreatePreview.project_name}</p>
                {goalCreatePreview.affirmation && (
                  <p className="text-sm text-text-secondary mt-1 leading-snug italic">
                    "{goalCreatePreview.affirmation}"
                  </p>
                )}
              </div>
              {(goalCreatePreview.kpis ?? []).length > 0 && (
                <div>
                  <p className="text-2xs font-black uppercase tracking-widest text-text-muted mb-2">
                    KPI (leading indicators)
                  </p>
                  <div className="space-y-1.5">
                    {(goalCreatePreview.kpis ?? []).map((kpi, i) => (
                      <div key={i} className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 ${pm.bg}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${pm.dot}`} />
                        <span className="text-sm font-semibold text-text-primary flex-1">
                          {kpi.name || kpi.label || kpi.description || kpi.indicator || ''}
                        </span>
                        {kpi.target != null && (
                          <span className={`text-xs font-bold ${pm.text}`}>
                            / {kpi.target} {kpi.unit}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(goalCreatePreview.checkpoints ?? []).length > 0 && (
                <div>
                  <p className="text-2xs font-black uppercase tracking-widest text-text-muted mb-2">Kamienie milowe</p>
                  <div className="space-y-1.5">
                    {(goalCreatePreview.checkpoints ?? []).map((cp, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-custom mt-0.5" />
                        <span className="text-sm text-text-secondary flex-1 min-w-0">
                          {cp.title || cp.name || cp.description || cp.milestone || ''}
                        </span>
                        {cp.due_date && (
                          <span className="text-xs text-text-muted shrink-0">
                            {(() => {
                              const [, month, d] = cp.due_date.split('-');
                              return `${d}.${month}`;
                            })()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Pressable
                  variant="outline"
                  onClick={() => setGoalCreateStep(GOAL_QUESTIONS.length - 1)}
                  className="px-4 py-3 text-sm"
                >
                  Zmień
                </Pressable>
                <Pressable
                  onClick={() => {
                    if (goalCreatePillar) {
                      onConfirm(goalCreatePreview, goalCreatePillar);
                    }
                  }}
                  disabled={busy}
                  loading={busy}
                  className="flex-1 py-3 text-sm"
                >
                  Utwórz projekt ✦
                </Pressable>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
}
