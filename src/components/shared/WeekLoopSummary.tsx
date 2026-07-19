import { Link } from 'react-router-dom';
import type { DirectionContextData } from '../../lib/dailyPlanProposal';
import { Card } from '../ui/Card';

function norm(text: string | null | undefined): string {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = norm(a);
  const nb = norm(b);
  return na.length > 0 && na === nb;
}

function truncate(text: string, max = 110): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function WeekLoopSummary({
  ctx,
  compact = false,
}: {
  ctx: Pick<
    DirectionContextData,
    | 'weekGoals'
    | 'weekGoalsMeta'
    | 'focus'
    | 'sprintGoal'
    | 'monthTheme'
    | 'monthLabel'
    | 'bhagLine'
  >;
  compact?: boolean;
}) {
  const intention = (ctx.weekGoals.intention || ctx.weekGoals.commitment)?.trim() || null;
  const bhag = ctx.bhagLine?.trim() || null;
  const month = ctx.monthTheme?.trim() || null;
  const sprint = ctx.sprintGoal?.trim() || null;

  const showSprint = Boolean(sprint && !sameText(sprint, month) && !sameText(sprint, bhag));
  const showWeek = Boolean(
    intention && !sameText(intention, month) && !sameText(intention, sprint) && !sameText(intention, bhag),
  );

  return (
    <Card className={compact ? 'space-y-2' : 'space-y-3'} padding={compact ? '0.875rem' : '1.25rem'}>
      <p className="text-2xs font-black uppercase tracking-[var(--ds-arbitrary-0-2em)] text-text-muted">Pętla tygodnia</p>

      <div className="space-y-2">
        {bhag && (
          <Layer label="Rok" text={truncate(bhag)} muted />
        )}

        {month && (
          <Layer
            label={`Miesiąc${ctx.monthLabel ? ` · ${ctx.monthLabel}` : ''}`}
            text={month}
            accent
          />
        )}

        {showSprint && (
          <Layer label="Sprint" text={sprint!} />
        )}

        {showWeek ? (
          <div className="space-y-1">
            <Layer label="Ten tydzień" text={intention!} strong />
            {ctx.weekGoalsMeta?.source === 'fallback' && (
              <p className="text-xs font-semibold text-warning">
                Plan z poprzedniego tygodnia — uzupełnij w niedzielnym przeglądzie.
              </p>
            )}
          </div>
        ) : intention ? (
          ctx.weekGoalsMeta?.source === 'fallback' ? (
            <p className="text-xs font-semibold text-warning">
              Plan z poprzedniego tygodnia — uzupełnij w niedzielnym przeglądzie.
            </p>
          ) : null
        ) : (
          <p className="text-xs text-text-muted">
            Brak intencji tygodnia —{' '}
            <Link to="/?view=tydzien" className="text-primary font-bold hover:underline">
              uzupełnij w Tydzień
            </Link>
          </p>
        )}
      </div>

      {ctx.focus.skillLabel && (
        <p className="text-xs text-text-secondary">
          <span className="font-black text-text-muted">Focus: </span>
          {ctx.focus.skillLabel}
          {ctx.focus.subskillLabel ? ` → ${ctx.focus.subskillLabel}` : ''}
          {ctx.focus.targetLevel != null ? ` · cel ${ctx.focus.targetLevel}/5` : ''}
        </p>
      )}

      {(ctx.weekGoals.cialo || ctx.weekGoals.duch || ctx.weekGoals.konto) && !compact && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border-custom/50">
          {ctx.weekGoals.cialo && <PillarChip label="Ciało" text={ctx.weekGoals.cialo} cls="text-success" />}
          {ctx.weekGoals.duch && <PillarChip label="Duch" text={ctx.weekGoals.duch} cls="text-primary" />}
          {ctx.weekGoals.konto && <PillarChip label="Konto" text={ctx.weekGoals.konto} cls="text-warning" />}
        </div>
      )}
    </Card>
  );
}

function Layer({
  label,
  text,
  muted,
  accent,
  strong,
}: {
  label: string;
  text: string;
  muted?: boolean;
  accent?: boolean;
  strong?: boolean;
}) {
  return (
    <p className={`leading-snug ${strong ? 'text-sm font-bold text-text-primary' : muted ? 'text-xs text-text-secondary' : 'text-xs text-text-primary'}`}>
      <span className={`font-black uppercase tracking-wider ${accent ? 'text-primary' : 'text-text-muted'}`}>
        {label}:{' '}
      </span>
      {text}
    </p>
  );
}

function PillarChip({ label, text, cls }: { label: string; text: string; cls: string }) {
  return (
    <span className="text-2xs text-text-secondary max-w-full">
      <span className={`font-black ${cls}`}>{label}: </span>
      {text}
    </span>
  );
}
