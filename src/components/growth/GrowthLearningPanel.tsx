import Button from '../ui/Button';
import { BookOpen, CheckCircle2, ExternalLink, FileText, Link2, TrendingUp } from 'lucide-react';
import type { LearningNeedItem, WeekLearningItem } from '../../lib/growth/growthOverview';
import type { GrowthLinkRow } from './hooks/useGrowthData';
import type { GrowthPinSlot } from '../../lib/growth/growth';
import { Card } from '../ui/Card';

const KIND_ICON = {
  pin: CheckCircle2,
  note: FileText,
  link: Link2,
  score: TrendingUp,
} as const;

function NeedRow({ item, primary }: { item: LearningNeedItem; primary?: boolean }) {
  return (
    <li
      className={`rounded-lg border px-3 py-2 ${
        primary ? 'border-primary/30 bg-primary/[0.05]' : 'border-border-custom bg-background/30'
      }`}
    >
      <p className="text-sm font-bold text-text-primary">{item.label}</p>
      <p className="text-xs text-text-muted mt-0.5 tabular-nums">
        {item.score}/5
        {item.target != null && item.score < item.target ? ` · cel ${item.target}` : ''}
      </p>
    </li>
  );
}

export default function GrowthLearningPanel({
  primary,
  alsoWeak,
  drill,
  weekItems,
  readOnly,
  focusLinks = [],
  onQuickPinLink,
}: {
  primary: LearningNeedItem | null;
  alsoWeak: LearningNeedItem[];
  drill: string | null;
  weekItems: WeekLearningItem[];
  readOnly: boolean;
  focusLinks?: GrowthLinkRow[];
  onQuickPinLink?: (linkId: string, slot: GrowthPinSlot) => void;
}) {
  return (
    <div className="space-y-4 h-full flex flex-col">
      <Card variant="surface" padding="1rem">
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen size={12} className="text-text-muted" />
          <p className="text-2xs font-black uppercase tracking-wider text-text-muted">
            Czego się uczyć {readOnly ? '(archiwum)' : 'teraz'}
          </p>
        </div>

        {primary ? (
          <ul className="space-y-2">
            <NeedRow item={primary} primary />
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Ustaw focus w Todo albo oceń skilli — wtedy widać priorytet.</p>
        )}

        {drill && (
          <div className="mt-3 rounded-lg border border-border-custom bg-background/40 px-3 py-2">
            <p className="text-2xs font-black uppercase text-text-muted">Drill / ćwiczenie</p>
            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{drill}</p>
          </div>
        )}

        {focusLinks && focusLinks.length > 0 && (
          <div className="mt-3">
            <p className="text-2xs font-black uppercase text-text-muted mb-1.5">Materiały z Keep dla focusu</p>
            <ul className="space-y-1.5">
              {focusLinks.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-border-custom bg-background/40 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text-primary truncate" title={link.title}>
                      {link.title || link.domain}
                    </p>
                    <p className="text-2xs text-text-muted">{link.domain}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-text-muted hover:text-primary"
                      title="Otwórz"
                    >
                      <ExternalLink size={12} />
                    </a>
                    {!readOnly && onQuickPinLink && (
                      <Button
                        variant="tonal"
                        onClick={() => onQuickPinLink(link.id, 'must')}
                        className="px-2 py-0.5 text-2xs rounded font-black uppercase"
                        title="Dodaj jako MUST"
                        size="sm"
                      >
                        Przypnij
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {alsoWeak.length > 0 && (
          <div className="mt-3">
            <p className="text-2xs font-black uppercase text-text-muted mb-1.5">Słabsze linki (&lt;3)</p>
            <ul className="space-y-1.5">
              {alsoWeak.map((w) => (
                <NeedRow key={w.label} item={w} />
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card variant="surface" padding="1rem" className="flex-1 flex flex-col min-h-[var(--ds-h-200px)]">
        <p className="text-2xs font-black uppercase tracking-wider text-text-muted mb-2">
          Nauczyłem się w tym tygodniu
        </p>
        {weekItems.length === 0 ? (
          <p className="text-sm text-text-muted leading-relaxed">
            Puste — zamknij MUST, przeczytaj link, zapisz notatkę #rozwoj albo podnieś ocenę skilli.
          </p>
        ) : (
          <ul className="space-y-1.5 overflow-y-auto max-h-[var(--ds-h-280px)] pr-1">
            {weekItems.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-border-custom bg-background/30 px-3 py-2"
                >
                  <Icon size={14} className="text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{item.label}</p>
                    {item.detail && (
                      <p className="text-xs text-text-muted truncate">{item.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
