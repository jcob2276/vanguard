import React, { useState } from 'react';
import { parseISO, differenceInDays } from 'date-fns';
import { Target, Zap, Briefcase } from 'lucide-react';
import { SPRINT_SEASON, sprintMetrics, daysBefore } from './desktopUtils';

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

interface BodyMetric {
  label: string;
  curr: any;
  prev: any;
  fmt: (v: any) => string;
  dec?: number;
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
  weight30ago
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

  const delta = (curr: any, prev: any, decimals = 0) => {
    if (curr == null || prev == null) return null;
    const d = +(curr - prev).toFixed(decimals);
    return d !== 0 ? { abs: Math.abs(d), up: d > 0 } : null;
  };

  const BODY: BodyMetric[] = [
    {
      label: 'Readiness',
      curr: metrics?.avgReadiness,
      prev: prevMetrics?.avgReadiness,
      fmt: (v: number) => `${Math.round(v)}`
    },
    { label: 'Sen avg', curr: metrics?.avgSleep, prev: prevMetrics?.avgSleep, fmt: (v: number) => `${v.toFixed(1)}h`, dec: 1 },
    { label: 'Treningi', curr: metrics?.trainDays, prev: prevMetrics?.trainDays, fmt: (v: number) => `${v}×` },
    { label: 'Km biegu', curr: metrics?.kmRun, prev: prevMetrics?.kmRun, fmt: (v: number) => `${v.toFixed(0)}`, dec: 1 },
    {
      label: 'Objętość',
      curr: metrics?.totalVol ? +(metrics.totalVol / 1000).toFixed(1) : null,
      prev: prevMetrics?.totalVol ? +(prevMetrics.totalVol / 1000).toFixed(1) : null,
      fmt: (v: number) => `${v}Mg`,
      dec: 1
    },
    ...(currentWeight != null
      ? [{ label: 'Waga', curr: currentWeight, prev: weight30ago, fmt: (v: number) => `${v.toFixed(1)}`, dec: 1 }]
      : [])
  ];

  const PROJECTS = [
    { label: 'Done w sprincie', val: projectMetrics?.doneInSprint, color: 'text-emerald-500' },
    { label: 'W toku', val: projectMetrics?.inProgress, color: 'text-sky-400' },
    { label: 'Zablokowane', val: projectMetrics?.blocked, color: projectMetrics?.blocked > 0 ? 'text-rose-500' : 'text-text-primary' },
    { label: 'Projekty', val: projectMetrics?.activeProjects, color: 'text-amber-400' }
  ];

  return (
    <div className="rounded-[24px] border border-primary/15 bg-primary/[0.03] p-6">
      {/* Header + goal + progress */}
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
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.metaKey) handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              placeholder="Cel sprintu — co ma się wydarzyć w tych 12 tygodniach?"
              className="flex-1 bg-surface border border-primary/30 rounded-[14px] p-3 text-[15px] font-semibold text-text-primary outline-none resize-none focus:border-primary/60 leading-snug"
              rows={2}
              autoFocus
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={handleSave}
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
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${sprint.pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] text-text-muted">{sprint.sprintStart}</span>
            <span className="text-[9px] font-black text-primary">{sprint.pct}% ukończone</span>
            <span className="text-[8px] text-text-muted">{sprint.sprintEnd}</span>
          </div>
        </div>
      </div>

      {/* 3 life pillars */}
      <div className="grid grid-cols-3 gap-6 pt-5 border-t border-primary/10">
        {/* Ciało */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-emerald-500 mb-3">Ciało</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {BODY.map(({ label, curr, prev, fmt, dec }) => {
              const d = curr != null && prev != null ? delta(curr, prev, dec ?? 0) : null;
              return (
                <div key={label}>
                  <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
                  <p className="font-display text-[18px] font-black leading-none text-text-primary">
                    {curr != null ? fmt(curr) : '—'}
                  </p>
                  {d && (
                    <p className={`text-[8px] font-bold mt-0.5 ${d.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {d.up ? '↑' : '↓'} {fmt(d.abs)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Projekty */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-500 mb-3">Projekty</p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {PROJECTS.map(({ label, val, color }) => (
              <div key={label}>
                <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-0.5">{label}</p>
                <p className={`font-display text-[18px] font-black leading-none ${color}`}>{val ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cele */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-3">Cele kierunkowe</p>
          <div className="space-y-2">
            {goals?.goal_konto && (
              <div className="rounded-[10px] bg-amber-500/[0.06] border border-amber-500/15 px-3 py-2.5">
                <p className="text-[7px] font-black uppercase tracking-wider text-amber-400 mb-1">Konto</p>
                <p className="text-[11px] font-semibold text-text-primary leading-snug line-clamp-2">
                  {goals.goal_konto}
                </p>
              </div>
            )}
            {goals?.goal_duch && (
              <div className="rounded-[10px] bg-indigo-500/[0.06] border border-indigo-500/15 px-3 py-2.5">
                <p className="text-[7px] font-black uppercase tracking-wider text-indigo-400 mb-1">Duch</p>
                <p className="text-[11px] font-semibold text-text-primary leading-snug line-clamp-2">
                  {goals.goal_duch}
                </p>
              </div>
            )}
            {!goals?.goal_konto && !goals?.goal_duch && (
              <p className="text-[10px] text-text-muted italic">Brak celów kierunkowych</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
