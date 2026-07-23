import type { BiologyScoreResult } from '../../../lib/getBased/biologyScoresLite';
import { toneColorClass } from '../../../lib/getBased/biologyScoresLite';
import { Card } from '../../ui/Card';
import { StatHero } from '../../ui/StatHero';
import { HelpCircle, AlertCircle } from 'lucide-react';

function ScoreCard({ score }: { score: BiologyScoreResult }) {
  const isCoveragePoor = score.coverage < 0.4;
  const noData = (score.score == null && score.toneLabel === 'Brak danych') || isCoveragePoor;

  return (
    <Card
      variant="surface"
      className={`border-border-custom flex flex-col justify-between gap-3 bg-background/25`}
      padding="1rem"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-3xs font-black uppercase tracking-wider text-text-muted">{score.kicker}</span>
            <h3 className="text-sm font-bold text-text-primary mt-0.5">{score.title}</h3>
          </div>
          {!isCoveragePoor ? (
            <StatHero
              value={noData ? '--' : (score.score ?? '--')}
              label={score.toneLabel}
              color={noData ? 'text-text-muted' : toneColorClass(score.tone)}
              size="sm"
              className="shrink-0"
            />
          ) : (
            <span className="text-3xs font-bold bg-border-custom text-text-muted px-2 py-0.5 rounded-full shrink-0">
              Niski wskaźnik pokrycia
            </span>
          )}
        </div>

        {isCoveragePoor ? (
          <div className="rounded-lg border border-warning/10 bg-warning/[0.02] p-2 flex gap-2 items-start mt-2">
            <AlertCircle size={12} className="text-warning shrink-0 mt-0.5" />
            <p className="text-3xs text-text-secondary leading-snug">
              Za mało porównywalnych danych, aby utworzyć wiarygodne podsumowanie.
            </p>
          </div>
        ) : (
          <p className="text-xs text-text-muted leading-relaxed">{score.summary}</p>
        )}

        <div className="space-y-1 pt-1 text-3xs font-semibold text-text-secondary">
          <p>
            <span className="text-text-muted uppercase font-black">Pokrycie panelu:</span> {score.coverageLabel} ({Math.round(score.coverage * 100)}%)
          </p>
          {score.missing.length > 0 && (
            <p className="text-text-secondary">
              <span className="text-text-muted uppercase font-black text-3xs">Brakuje:</span> {score.missing.slice(0, 3).join(', ')}
              {score.missing.length > 3 ? '…' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border-custom/40 pt-2 flex items-center justify-between text-3xs text-text-muted">
        <span className="flex items-center gap-1">
          <HelpCircle size={10} /> Model: getbased lite
        </span>
      </div>
    </Card>
  );
}

export default function MedicalBiologyScoresSection({ scores }: { scores: BiologyScoreResult[] }) {
  return (
    <div className="space-y-4">
      <div className="border-b border-border-custom/50 pb-3">
        <h2 className="text-lg font-black uppercase font-display">Eksperymentalne Wskaźniki</h2>
        <p className="text-2xs text-text-muted mt-0.5">Modele interpretacyjne getbased — wyłącznie poglądowe hipotezy</p>
      </div>

      {scores.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scores.map((s) => (
            <ScoreCard key={s.id} score={s} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted italic">
          Brak wystarczającej liczby markerów do wyliczenia Biology Scores.
        </p>
      )}
    </div>
  );
}
