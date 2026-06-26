import { useState } from 'react';
import { SPRINT_SEASON } from './desktopUtils';
import SprintMetricsGrid from './SprintMetricsGrid';

export interface SprintPanelProps {
  sprint: any;
  sprintGoal: any;
  onSave: (goalText: string) => Promise<void>;
  metrics: any;
  prevMetrics: any;
  projectMetrics: any;
  goals: any;
  currentWeight: number | null;
  weight30ago: number | null;
}

export default function SprintPanel({
  sprint,
  sprintGoal,
  onSave,
  metrics,
  prevMetrics,
  projectMetrics,
  goals,
  currentWeight,
  weight30ago,
}: SprintPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sprintGoal?.goal_text || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="rounded-[24px] border border-primary/15 bg-primary/[0.03] p-6">
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-text-muted">
            Personal year {sprint.personalYear}
          </span>
          <span className="rounded-full border border-primary/20 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5">
            Sprint {sprint.sprintNumber} · {SPRINT_SEASON[sprint.sprintNumber] || `S${sprint.sprintNumber}`}
          </span>
        </div>

        {editing ? (
          <div className="flex gap-3 items-start mb-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) void handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              placeholder="Cel sprintu — co ma się wydarzyć w tych 12 tygodniach?"
              className="flex-1 bg-surface border border-primary/30 rounded-[14px] p-3 text-[15px] font-semibold text-text-primary outline-none resize-none focus:border-primary/60 leading-snug"
              rows={2}
              autoFocus
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-[10px] bg-primary text-white text-[9px] font-black uppercase px-3 py-2 cursor-pointer hover:bg-primary-hover disabled:opacity-50 transition-all"
              >
                {saving ? '…' : 'Zapisz'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-[10px] border border-border-custom text-[9px] font-black uppercase px-3 py-2 text-text-muted cursor-pointer hover:text-text-primary transition-all"
              >
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setDraft(sprintGoal?.goal_text || '');
              setEditing(true);
            }}
            className="text-left group cursor-pointer mb-4 block w-full"
          >
            {sprintGoal?.goal_text ? (
              <p className="text-[20px] font-black text-text-primary leading-snug group-hover:text-primary transition-colors">
                {sprintGoal.goal_text}
              </p>
            ) : (
              <p className="text-[15px] font-semibold text-text-muted italic group-hover:text-primary transition-colors">
                + Dodaj cel sprintu…
              </p>
            )}
          </button>
        )}

        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[9px] font-bold text-text-muted">Tydzień {sprint.weekInSprint} / 12</span>
            <span className="text-[9px] font-bold text-text-muted">{sprint.daysLeft} dni do końca sprintu</span>
          </div>
          <div className="h-2.5 bg-border-custom rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${sprint.pct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] text-text-muted">{sprint.sprintStart}</span>
            <span className="text-[9px] font-black text-primary">{sprint.pct}% ukończone</span>
            <span className="text-[8px] text-text-muted">{sprint.sprintEnd}</span>
          </div>
        </div>
      </div>

      <SprintMetricsGrid
        metrics={metrics}
        prevMetrics={prevMetrics}
        projectMetrics={projectMetrics}
        goals={goals}
        currentWeight={currentWeight}
        weight30ago={weight30ago}
      />
    </div>
  );
}
