import { motion, useReducedMotion } from 'framer-motion';
import { LIFE_OBLIGATION_KIND_LABELS } from '@vanguard/domain';
import { Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { Pressable } from '../ui/ControlPrimitives';
import { formatLongDateWarsaw } from '../../lib/date';
import { TerminyObligationCard } from './TerminyObligationCard';
import {
  STARTER_TEMPLATES,
  URGENCY_BUCKET_LABELS,
  bucketMap,
  countdownLabel,
  type DerivedObligation,
  type StarterTemplate,
  type UrgencyBucket,
} from './terminyDerived';

const BUCKET_ORDER: UrgencyBucket[] = ['today', 'week', 'month', 'later'];

const EMPTY_STARTERS = ['birthday', 'vehicle-inspection', 'insurance-policy']
  .map((id) => STARTER_TEMPLATES.find((t) => t.id === id))
  .filter((t): t is StarterTemplate => Boolean(t));

interface Props {
  rows: DerivedObligation[];
  onDelete: (id: string, title: string) => void;
  onEdit: (id: string) => void;
  onOpenAdd: (template?: StarterTemplate | null) => void;
}

export function TerminyHorizon({ rows, onDelete, onEdit, onOpenAdd }: Props) {
  const reduceMotion = useReducedMotion();
  const buckets = bucketMap(rows);
  const next = rows[0] ?? null;

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon="📅"
          label="Brak terminów — dodaj urodziny, przegląd albo polisę."
          action={{ label: 'Dodaj termin', onClick: () => onOpenAdd(null) }}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {EMPTY_STARTERS.map((tpl) => (
            <Pressable
              key={tpl.id}
              onClick={() => onOpenAdd(tpl)}
              className="items-start rounded-2xl border border-border-custom/40 bg-surface-solid/70 p-4 text-left transition-[transform,background-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-surface-2/70 hover:shadow-sm active:scale-95"
            >
              <span className="block w-full text-xs font-bold uppercase tracking-wide text-text-muted">
                {LIFE_OBLIGATION_KIND_LABELS[tpl.kind]}
              </span>
              <span className="mt-1 block w-full text-sm font-semibold text-text-primary">{tpl.title}</span>
              <span className="mt-1 block w-full text-xs text-text-muted">{tpl.blurb}</span>
            </Pressable>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {next && (
        <section
          role="button"
          tabIndex={0}
          onClick={() => onEdit(next.item.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onEdit(next.item.id);
            }
          }}
          className="relative cursor-pointer overflow-hidden rounded-3xl border border-border-custom/30 bg-gradient-to-br from-primary/15 via-surface-solid to-surface-2/80 p-6 transition-[transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 md:p-8"
        >
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                <Sparkles size={14} /> Najbliższy — kliknij, by edytować
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
                {next.item.title}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {LIFE_OBLIGATION_KIND_LABELS[next.item.kind]}
                {next.item.related_name ? ` · ${next.item.related_name}` : ''}
                {' · '}
                {formatLongDateWarsaw(next.nextDate)}
              </p>
            </div>
            <p className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
              {countdownLabel(next.daysLeft)}
            </p>
          </div>
        </section>
      )}

      {BUCKET_ORDER.map((bucket) => {
        const list = buckets[bucket];
        if (list.length === 0) return null;
        return (
          <section key={bucket}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">
              {URGENCY_BUCKET_LABELS[bucket]}
              <span className="ml-2 font-medium text-text-muted/70">{list.length}</span>
            </h3>
            <ul className="space-y-2">
              {list.map((row, index) => (
                <motion.li
                  key={row.item.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: reduceMotion ? 0 : Math.min(index, 8) * 0.04,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                >
                  <TerminyObligationCard
                    row={row}
                    onDelete={() => onDelete(row.item.id, row.item.title)}
                    onEdit={() => onEdit(row.item.id)}
                  />
                </motion.li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex justify-center pt-2">
        <Button variant="tonal" onClick={() => onOpenAdd(null)}>Dodaj termin</Button>
      </div>
    </div>
  );
}
