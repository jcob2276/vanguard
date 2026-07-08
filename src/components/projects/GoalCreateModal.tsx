import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PILLARS, PILLAR_META, GOAL_QUESTIONS, PillarId } from './projectUtils';

export interface GoalCreateModalProps {
  lifeGoals: any;
  dreams: any[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (preview: any, pillar: PillarId) => void;
  onError: (err: string) => void;
}

export default function GoalCreateModal({
  lifeGoals,
  dreams,
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
  const [goalCreatePreview, setGoalCreatePreview] = useState<any>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header strip */}
        <div className={`px-5 py-3 flex items-center justify-between ${pm ? pm.bg : 'bg-surface-solid/50'}`}>
          <div className="flex items-center gap-2">
            {pm && <pm.icon size={13} className={pm.text} />}
            <span className={`text-[10px] font-black uppercase tracking-widest ${pm ? pm.text : 'text-text-muted'}`}>
              {pm ? pm.label : 'Nowy cel'}
            </span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* PILLAR SELECTION */}
          {isPillar && (
            <div className="space-y-3">
              <p className="text-[18px] font-black text-text-primary leading-tight">Pod który filar?</p>
              <div className="space-y-2">
                {PILLARS.map(p => {
                  const meta = PILLAR_META[p];
                  const lg = (lifeGoals as any)?.[`goal_${p}`];
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setGoalCreatePillar(p);
                        setGoalCreateStep(0);
                      }}
                      className={`w-full text-left rounded-[16px] border p-3.5 transition-all hover:scale-[1.01] cursor-pointer ${meta.border} ${meta.bg}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <meta.icon size={13} className={meta.text} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${meta.text}`}>
                          {meta.label}
                        </span>
                      </div>
                      {lg && <p className="text-[12px] text-text-secondary leading-snug line-clamp-1">{lg}</p>}
                    </button>
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
                <p className="text-[19px] font-black text-text-primary leading-snug">{q.q}</p>
                <textarea
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
                  className="w-full resize-none rounded-[14px] border border-border-custom bg-surface-solid/40 px-4 py-3 text-[14px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/35 leading-relaxed"
                />
                <p className="text-[10px] text-text-muted/60">Enter = dalej · Shift+Enter = nowa linia</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGoalCreateStep(qIdx > 0 ? qIdx - 1 : 'pillar')}
                    className="rounded-xl border border-border-custom px-4 py-3 text-[12px] font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  >
                    ← Wstecz
                  </button>
                  <button
                    onClick={() => {
                      if (val.trim()) handleGoalCreateNext(val);
                    }}
                    disabled={!val.trim()}
                    className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white disabled:opacity-30 transition-opacity cursor-pointer"
                  >
                    {qIdx < GOAL_QUESTIONS.length - 1 ? 'Dalej →' : 'Generuj cel ✦'}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* LOADING */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-[14px] font-semibold text-text-secondary">AI analizuje Twój cel...</p>
              <p className="text-[11px] text-text-muted">Generuje projekt, KPI i kamienie milowe</p>
            </div>
          )}

          {/* PREVIEW */}
          {isPreview && goalCreatePreview && pm && (
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Projekt</p>
                <p className="text-[18px] font-black text-text-primary">{goalCreatePreview.project_name}</p>
                {goalCreatePreview.affirmation && (
                  <p className="text-[12px] text-text-secondary mt-1 leading-snug italic">
                    "{goalCreatePreview.affirmation}"
                  </p>
                )}
              </div>
              {(goalCreatePreview.kpis ?? []).length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">
                    KPI (leading indicators)
                  </p>
                  <div className="space-y-1.5">
                    {goalCreatePreview.kpis.map((kpi: any, i: number) => (
                      <div key={i} className={`flex items-center gap-2 rounded-[10px] px-3 py-2 ${pm.bg}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${pm.dot}`} />
                        <span className="text-[12px] font-semibold text-text-primary flex-1">
                          {kpi.name || kpi.label || kpi.description || kpi.indicator || ''}
                        </span>
                        {kpi.target != null && (
                          <span className={`text-[11px] font-bold ${pm.text}`}>
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
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-2">Kamienie milowe</p>
                  <div className="space-y-1.5">
                    {goalCreatePreview.checkpoints.map((cp: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-border-custom mt-0.5" />
                        <span className="text-[12px] text-text-secondary flex-1 min-w-0">
                          {cp.title || cp.name || cp.description || cp.milestone || ''}
                        </span>
                        {cp.due_date && (
                          <span className="text-[10px] text-text-muted shrink-0">
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
                <button
                  onClick={() => setGoalCreateStep(GOAL_QUESTIONS.length - 1)}
                  className="rounded-xl border border-border-custom px-4 py-3 text-[12px] font-bold text-text-muted hover:text-text-primary cursor-pointer"
                >
                  Zmień
                </button>
                <button
                  onClick={() => {
                    if (goalCreatePillar) {
                      onConfirm(goalCreatePreview, goalCreatePillar);
                    }
                  }}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-white disabled:opacity-50 cursor-pointer"
                >
                  Utwórz projekt ✦
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
