import { Pressable, ControlTextarea } from '../ui/ControlPrimitives';
import React from 'react';
import type { SprintFacts, SprintProjectDecision } from '../../lib/growth/sprintReview';
import { Card } from '../ui/Card';

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border-custom" />
      <span className="text-2xs uppercase tracking-widest text-text-muted font-black">{title}</span>
      <div className="h-px flex-1 bg-border-custom" />
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <Card padding="0.625rem 0.75rem">
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </Card>
  );
}

function Textarea({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <ControlTextarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-surface border border-border-custom rounded-xl px-3 py-2 text-sm
        text-text-primary placeholder-text-muted resize-y min-h-[var(--ds-h-72px)] focus:outline-none
        focus:border-primary/50 transition-colors"
    />
  );
}

export default function DirectionSprintMode({
  sprintFacts,
  reflection,
  setReflection,
  nextSprintGoal,
  setNextSprintGoal,
  projectDecisions,
  setProjectDecisions,
  onComplete,
  completing,
}: {
  sprintFacts: SprintFacts;
  reflection: string;
  setReflection: (v: string) => void;
  nextSprintGoal: string;
  setNextSprintGoal: (v: string) => void;
  projectDecisions: Record<string, SprintProjectDecision>;
  setProjectDecisions: (v: Record<string, SprintProjectDecision>) => void;
  onComplete: () => void;
  completing: boolean;
}) {
  const pillarLine = [
    sprintFacts.pillarAverages.cialo != null && `Ciało ${sprintFacts.pillarAverages.cialo}`,
    sprintFacts.pillarAverages.duch != null && `Duch ${sprintFacts.pillarAverages.duch}`,
    sprintFacts.pillarAverages.konto != null && `Konto ${sprintFacts.pillarAverages.konto}`,
  ].filter(Boolean).join(' · ');

  const canComplete = nextSprintGoal.trim().length > 0;

  const setProject = (id: string, decision: SprintProjectDecision) => {
    setProjectDecisions({ ...projectDecisions, [id]: decision });
  };

  return (
    <div className="space-y-6 pb-6 border-b border-border-custom mb-6">
      <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3">
        <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-2em)] text-warning">Zamknięcie sprintu</p>
        <p className="mt-1 text-sm font-semibold text-text-primary">
          {sprintFacts.sprintLabel} · tydzień 12/12
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {sprintFacts.sprintStart} – {sprintFacts.sprintEnd}
          {sprintFacts.currentGoal ? ` · ${sprintFacts.currentGoal}` : ''}
        </p>
      </div>

      <div className="space-y-3">
        <Divider title="12 tygodni w liczbach" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard value={`${sprintFacts.weeksReviewed}/${sprintFacts.weeksInSprint}`} label="tygodni z refleksją" />
          <StatCard value={String(sprintFacts.powerListZ)} label="dni Z (PowerList)" />
          <StatCard
            value={`${sprintFacts.powerListDone}/${sprintFacts.powerListPlanned || '?'}`}
            label="zwycięstw odhaczonych"
          />
          <StatCard value={String(sprintFacts.kpiWeeksLogged)} label="tygodni z KPI" />
        </div>
        {pillarLine && (
          <p className="text-xs text-text-secondary">
            <span className="font-black text-text-muted">Śr. oceny filarów: </span>
            {pillarLine}
          </p>
        )}
      </div>

      {sprintFacts.kpiSummaries.length > 0 && (
        <div className="space-y-2">
          <Divider title="KPI sprintu" />
          <ul className="space-y-1.5">
            {sprintFacts.kpiSummaries.slice(0, 8).map((k) => (
              <li
                key={`${k.name}-${k.projectName}`}
                className="rounded-xl border border-border-custom bg-surface/50 px-3 py-2 text-xs text-text-secondary"
              >
                <span className="font-semibold text-text-primary">{k.name}</span>
                {k.projectName ? ` · ${k.projectName}` : ''}
                {' — '}
                {k.lastValue != null ? k.lastValue : '—'}
                {k.target != null ? ` / ${k.target}` : ''}
                {k.unit ? ` ${k.unit}` : ''}
                <span className="text-text-muted"> ({k.weeksLogged} tyg.)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sprintFacts.weekHighlights.length > 0 && (
        <div className="space-y-2">
          <Divider title="Tygodnie — jedna linia" />
          <ul className="space-y-1">
            {sprintFacts.weekHighlights.map((w) => (
              <li key={w.weekStart} className="text-xs text-text-secondary leading-snug">
                <span className="font-mono text-2xs text-text-muted">{w.weekStart}</span>
                {' — '}
                {w.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sprintFacts.activeProjects.length > 0 && (
        <div className="space-y-2">
          <Divider title="Projekty na następny sprint" />
          <p className="text-xs text-text-muted">Kontynuuj aktywne albo odłóż (pauza).</p>
          <ul className="space-y-2">
            {sprintFacts.activeProjects.map((p) => {
              const decision = projectDecisions[p.id] ?? 'continue';
              const projectKpis = sprintFacts.kpiSummaries.filter((k) => k.projectName === p.name);
              return (
                <li
                  key={p.id}
                  className="rounded-xl border border-border-custom bg-surface/40 px-3 py-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">{p.name}</span>
                    <div className="flex shrink-0 gap-1">
                    {(['continue', 'defer'] as const).map((d) => (
                      <Pressable
                        key={d}
                        type="button"
                        onClick={() => setProject(p.id, d)}
                        className={`rounded-lg px-2 py-1 text-2xs font-black uppercase tracking-wide transition-colors ${
                          decision === d
                            ? d === 'continue'
                              ? 'bg-primary text-on-accent'
                              : 'bg-warning/20 text-warning'
                            : 'text-text-muted hover:bg-surface'
                        }`}
                      >
                        {d === 'continue' ? 'Kontynuuj' : 'Odłóż'}
                      </Pressable>
                    ))}
                  </div>
                  </div>
                  {projectKpis.length > 0 && (
                    <ul className="text-xs text-text-muted space-y-0.5 pl-0.5">
                      {projectKpis.map((k) => (
                        <li key={k.name}>
                          {k.name}: {k.lastValue ?? '—'}/{k.target ?? '?'}
                          {k.unit ? ` ${k.unit}` : ''} ({k.weeksLogged} tyg.)
                        </li>
                      ))}
                    </ul>
                  )}
                  {decision === 'continue' && (
                    <p className="text-2xs font-semibold text-primary">→ wchodzi w sprint {sprintFacts.sprintNumber + 1}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Divider title="Jedna decyzja" />
        <p className="text-xs text-text-muted">
          Cel na sprint {sprintFacts.sprintNumber + 1} — jedna linia. Projekty „Kontynuuj” zapiszą się jako focus sprintu.
        </p>
        <Textarea
          value={nextSprintGoal}
          onChange={setNextSprintGoal}
          placeholder="Np. „Pipeline 3 rozmowy/tydz.” albo „Fundament ciała przed Q4”"
          rows={2}
        />
        <p className="text-xs text-text-muted">Opcjonalnie — notatka z zamknięcia:</p>
        <Textarea
          value={reflection}
          onChange={setReflection}
          placeholder="Co wyszło w tym sprincie? (krótko)"
          rows={2}
        />
      </div>

      <Pressable
        type="button"
        onClick={onComplete}
        disabled={!canComplete || completing}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-accent
          disabled:opacity-[var(--opacity-40)] disabled:cursor-not-allowed transition-opacity"
      >
        {completing ? 'Zapisuję…' : `Zamknij sprint → cel na sprint ${sprintFacts.sprintNumber + 1}`}
      </Pressable>
    </div>
  );
}
