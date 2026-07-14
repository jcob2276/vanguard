import type { BiologyScoreResult } from '../../lib/getBased/biologyScoresLite';
import { toneColorClass } from '../../lib/getBased/biologyScoresLite';
import { Card } from '../ui/Card';

function ScoreCard({ score }: { score: BiologyScoreResult }) {
  const noData = score.score == null && score.toneLabel === 'Brak danych';
  return (
    <Card
      variant="glass"
      className={`border-border-custom flex flex-col gap-2 ${
        noData ? 'bg-surface/15 opacity-90' : 'bg-surface/30'
      }`}
      padding="1rem"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xs font-black uppercase tracking-wider text-text-muted">{score.kicker}</p>
          <h3 className="text-sm font-bold text-text-primary mt-0.5">{score.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-black tabular-nums ${noData ? 'text-text-muted' : toneColorClass(score.tone)}`}>
            {noData ? '—' : (score.score ?? '—')}
          </p>
          <p className="text-2xs font-black uppercase text-text-muted">{score.toneLabel}</p>
        </div>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{score.summary}</p>
      <p className="text-2xs text-text-muted">
        Pokrycie panelu: {score.coverageLabel} ({Math.round(score.coverage * 100)}%)
      </p>
      {score.missing.length > 0 && (
        <p className="text-xs text-text-secondary">
          Brakuje: {score.missing.slice(0, 4).join(', ')}
          {score.missing.length > 4 ? '…' : ''}
        </p>
      )}
      {score.flags.length > 0 && (
        <ul className="space-y-1 mt-1">
          {score.flags.slice(0, 3).map((f) => (
            <li key={f} className="text-xs text-warning dark:text-warning leading-snug">
              {f}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function MedicalBiologyScores({ scores }: { scores: BiologyScoreResult[] }) {
  if (scores.length === 0) {
    return (
      <p className="text-sm text-text-muted leading-relaxed">
        Biology Scores pojawią się, gdy w bazie są rozpoznawalne markery (ferrytyna, lipidy, TSH…).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {scores.map((s) => (
          <ScoreCard key={s.id} score={s} />
        ))}
      </div>
      <p className="text-xs text-text-muted leading-relaxed border-t border-border-custom/60 pt-3">
        Logika i zakresy optymalne inspirowane{' '}
        <a
          href="https://github.com/elkimek/get-based"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-semibold"
        >
          getbased
        </a>{' '}
        (AGPL-3.0). To robocze podsumowanie wzorców — nie diagnoza.
      </p>
    </div>
  );
}
