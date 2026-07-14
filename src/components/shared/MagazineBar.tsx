import { Clock, Star } from 'lucide-react';
import type { ScheduleViewData } from '../../types/schedule';
import { Card } from '../ui/Card';

function MagazineHeroCard({
  hero,
}: {
  hero: NonNullable<ScheduleViewData['hero']>;
}) {
  return (
    <article
      className="relative overflow-hidden rounded-2xl p-5 min-h-[var(--legacy-h-013)] flex flex-col justify-end"
      style={{
        background: 'linear-gradient(135deg, var(--legacy-color-008), var(--legacy-color-003))',
        border: 'var(--border-width-thin) solid var(--legacy-color-129)',
      }}
    >
      <span
        className="absolute top-4 left-4 text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-lg"
        style={{ background: 'var(--legacy-color-132)', color: 'var(--legacy-color-139)' }}
      >
        Wyróżnione
      </span>
      <h3 className="text-xl font-bold leading-tight text-on-accent mt-8">{hero.title}</h3>
      {hero.description && (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--legacy-color-135)' }}>
          {hero.description}
        </p>
      )}
      {hero.startTime && (
        <p className="mt-3 flex items-center gap-1.5 text-sm" style={{ color: 'var(--legacy-color-134)' }}>
          <Clock size={14} />
          {hero.startTime}
        </p>
      )}
    </article>
  );
}

export function MagazineBar({ view }: { view: ScheduleViewData }) {
  if (
    !view.hero &&
    !view.editorialIntro &&
    !view.monthTheme &&
    !view.sprintWeekBridge &&
    !view.longTermBridge &&
    view.timeline.length === 0 &&
    view.quoteBlocks.length === 0
  ) {
    return null;
  }

  return (
    <section className="space-y-4">
      {view.hero && <MagazineHeroCard hero={view.hero} />}

      {view.monthTheme && (
        <p className="text-sm leading-relaxed text-text-secondary px-0.5">
          <span className="font-black uppercase tracking-wider text-primary text-xs">
            Temat miesiąca{view.monthThemeLabel ? ` · ${view.monthThemeLabel}` : ''}
          </span>
          <br />
          {view.monthTheme}
        </p>
      )}

      {view.longTermBridge && (
        <p className="text-sm leading-relaxed text-text-secondary px-0.5 font-medium">
          {view.longTermBridge}
        </p>
      )}

      {view.sprintWeekBridge && (
        <p className="text-sm font-semibold leading-relaxed text-text-primary px-0.5">
          {view.sprintWeekBridge}
        </p>
      )}

      {view.editorialIntro && (
        <p className="text-sm leading-relaxed text-text-secondary px-0.5">{view.editorialIntro}</p>
      )}

      {view.quoteBlocks.map((block) => (
        <Card as="blockquote" key={block.title} variant="outline" padding="0.75rem 1rem">
          <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
            <Star size={10} /> {block.title}
          </p>
          <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{block.content}</p>
        </Card>
      ))}

      {view.timeline.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-black uppercase tracking-[var(--legacy-arbitrary-053)] text-text-muted">Tydzień</p>
          {view.timeline.map((day) => (
            <div key={day.dayDate}>
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">{day.dayLabel}</p>
              <ul className="space-y-2">
                {day.items.map((item) => (
                  <Card as="li" key={item.id} variant="outline" padding="0.625rem 0.75rem" className="flex items-start gap-3">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: item.color ?? (item.kind === 'todo' ? 'var(--color-primary)' : 'var(--color-success)') }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                      {item.sourceFact && (
                        <p className="text-xs text-text-tertiary truncate">{item.sourceFact}</p>
                      )}
                    </div>
                    {item.dueAt && (
                      <span className="text-xs font-mono text-text-muted shrink-0">{item.dueAt.slice(5)}</span>
                    )}
                  </Card>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
