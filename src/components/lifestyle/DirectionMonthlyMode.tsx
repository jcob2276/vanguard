import React from 'react';
import type { Session } from '@supabase/supabase-js';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import type { MonthFacts } from '../../lib/growth/monthReview';

type MonthRecap = {
  narrative: string;
  longterm_motif: string | null;
  question: string;
};

interface Props {
  session: Session;
  monthStart: string;
  monthFacts: MonthFacts;
  recap: MonthRecap | null;
  recapLoading: boolean;
  patternNote: string;
  setPatternNote: (v: string) => void;
  leverageNote: string;
  setLeverageNote: (v: string) => void;
  correctionNote: string;
  setCorrectionNote: (v: string) => void;
  monthTheme: string;
  setMonthTheme: (v: string) => void;
  onComplete: () => void;
  completing: boolean;
}

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
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-surface border border-border-custom rounded-xl px-3 py-2 text-sm
        text-text-primary placeholder-text-muted resize-y min-h-[72px] focus:outline-none
        focus:border-primary/50 transition-colors"
    />
  );
}

function Q({ num, label, value, onChange, placeholder }: {
  num: number; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-text-secondary font-semibold">{num}. {label}</p>
      <Textarea value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

export default function DirectionMonthlyMode({
  monthFacts,
  recap,
  recapLoading,
  patternNote,
  setPatternNote,
  leverageNote,
  setLeverageNote,
  correctionNote,
  setCorrectionNote,
  monthTheme,
  setMonthTheme,
  onComplete,
  completing,
}: Props) {
  const questionsOk =
    patternNote.trim().length > 0 &&
    leverageNote.trim().length > 0 &&
    correctionNote.trim().length > 0 &&
    monthTheme.trim().length > 0;

  const pillarLine = [
    monthFacts.pillarAverages.cialo != null && `Ciało ${monthFacts.pillarAverages.cialo}`,
    monthFacts.pillarAverages.duch != null && `Duch ${monthFacts.pillarAverages.duch}`,
    monthFacts.pillarAverages.konto != null && `Konto ${monthFacts.pillarAverages.konto}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-6 pb-6 border-b border-border-custom mb-6">
      <Card padding="0.75rem 1rem" style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
        <p className="text-2xs font-black uppercase tracking-[0.2em] text-warning">Przegląd miesiąca</p>
        <p className="mt-1 text-sm font-semibold text-text-primary capitalize">{monthFacts.monthLabel}</p>
        <p className="mt-1 text-xs text-text-secondary">
          Warstwa między sprintem a tygodniem — zamknij miesiąc, potem planuj tydzień.
        </p>
      </Card>

      {/* Blok 0: miesiąc w liczbach */}
      <div className="space-y-3">
        <Divider title="Miesiąc w liczbach" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            value={`${monthFacts.weeksReviewed}/${monthFacts.weeksInMonth}`}
            label="tygodni z refleksją"
          />
          <StatCard value={String(monthFacts.powerListZ)} label="dni Z (PowerList)" />
          <StatCard value={String(monthFacts.powerListP)} label="dni P" />
          <StatCard
            value={`${monthFacts.powerListDone}/${monthFacts.powerListPlanned}`}
            label="zwycięstw zrobionych"
          />
          <StatCard value={String(monthFacts.kpiWeeksLogged)} label="tygodni z KPI" />
          <StatCard value={String(monthFacts.activeProjectCount)} label="aktywnych projektów" />
        </div>
        {pillarLine && (
          <p className="text-xs text-text-muted">Średnie filarów z tygodni: {pillarLine}</p>
        )}
      </div>

      {/* Blok 1: AI narracja */}
      <div className="space-y-3">
        <Divider title="Jak wyglądał twój miesiąc" />
        {recapLoading && (
          <div className="flex items-center gap-2 py-3 text-text-muted text-sm">
            <Spinner size="sm" />
            AI analizuje miesiąc…
          </div>
        )}
        {recap && (
          <div className="space-y-3">
            <p className="text-sm text-text-primary leading-relaxed">{recap.narrative}</p>
            {recap.longterm_motif && (
              <div className="border-l-2 border-warning pl-3 py-1">
                <p className="text-xs text-warning font-bold uppercase tracking-wider mb-1">
                  Motyw powtarzający się
                </p>
                <p className="text-sm text-text-primary leading-relaxed">{recap.longterm_motif}</p>
              </div>
            )}
            {recap.question && (
              <div className="bg-surface border border-border-custom rounded-xl px-3 py-2.5">
                <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1">
                  Pytanie otwierające
                </p>
                <p className="text-sm text-text-secondary italic">„{recap.question}"</p>
              </div>
            )}
          </div>
        )}
        {!recapLoading && !recap && (
          <p className="text-sm text-text-muted italic">Podsumowanie AI pojawi się za chwilę…</p>
        )}
      </div>

      {/* Blok 2: trzy pytania */}
      <div className="space-y-4">
        <Divider title="Refleksja miesiąca" />
        <Q
          num={1}
          label="Jaki wzorzec wracał przez cały miesiąc?"
          value={patternNote}
          onChange={setPatternNote}
          placeholder="Co się powtarzało — w działaniu, unikaniu, energii…"
        />
        <Q
          num={2}
          label="Co było największą dźwignią?"
          value={leverageNote}
          onChange={setLeverageNote}
          placeholder="Jedna rzecz, która ciągnęła resztę do przodu."
        />
        <Q
          num={3}
          label="Co koryguję w następnym miesiącu?"
          value={correctionNote}
          onChange={setCorrectionNote}
          placeholder="Jedna korekta — nie plan 4 tygodni."
        />
      </div>

      {/* Blok 3: temat miesiąca */}
      <div className="space-y-2">
        <Divider title="Temat miesiąca" />
        <p className="text-xs text-text-muted">
          Jedna linia — horyzont na 4 tygodnie. Szczegóły zostają w planowaniu tygodniowym.
        </p>
        <Textarea
          value={monthTheme}
          onChange={setMonthTheme}
          placeholder="Np. „Pipeline przed perfekcją” albo „Ciało jako fundament”"
          rows={2}
        />
      </div>

      <Button
        variant="primary"
        size="lg"
        type="button"
        onClick={onComplete}
        disabled={!questionsOk || completing}
        loading={completing}
        className="w-full rounded-xl"
      >
        {completing ? 'Zapisuję…' : 'Zamknij miesiąc → przejdź do tygodnia'}
      </Button>
    </div>
  );
}
