import { useReducedMotion } from 'framer-motion';
import {
  LIFE_OBLIGATION_KIND_LABELS,
  LIFE_OBLIGATION_RECURRENCE_LABELS,
  type LifeObligationKind,
  type LifeObligationRecurrence,
} from '@vanguard/domain';
import { Cake, Car, FileText, Trash2 } from 'lucide-react';
import { Pressable } from '../ui/ControlPrimitives';
import { formatLongDateWarsaw } from '../../lib/date';
import {
  countdownLabel,
  initialsFrom,
  type DerivedObligation,
} from './terminyDerived';

const KIND_ICON: Record<'people' | 'vehicle' | 'document', typeof Cake> = {
  people: Cake,
  vehicle: Car,
  document: FileText,
};

const KIND_ACCENT: Record<'people' | 'vehicle' | 'document', string> = {
  people: 'text-primary bg-primary/12',
  vehicle: 'text-info bg-info/12',
  document: 'text-warning bg-warning/12',
};

const RING_ACCENT: Record<'people' | 'vehicle' | 'document', string> = {
  people: 'stroke-primary',
  vehicle: 'stroke-info',
  document: 'stroke-warning',
};

interface Props {
  row: DerivedObligation;
  onDelete: () => void;
  onEdit?: () => void;
  compact?: boolean;
}

export function TerminyObligationCard({ row, onDelete, onEdit, compact = false }: Props) {
  const reduceMotion = useReducedMotion();
  const kind = (['people', 'vehicle', 'document'].includes(row.item.kind)
    ? row.item.kind
    : 'document') as 'people' | 'vehicle' | 'document';
  const Icon = KIND_ICON[kind];
  const ringClass = compact ? 'h-11 w-11' : 'h-14 w-14';
  const r = compact ? 19 : 25;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - row.ringProgress);
  const leads = row.item.lead_offsets.map((o) => (o === 0 ? '0' : String(Math.abs(o)))).join(' · ');
  const cx = compact ? 22 : 28;

  return (
    <article
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onClick={onEdit}
      onKeyDown={onEdit ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      } : undefined}
      className={`group flex items-center gap-3 rounded-2xl border border-border-custom/40 bg-surface-solid/80 p-3 transition-[transform,background-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 hover:bg-surface-2/60 hover:shadow-sm ${onEdit ? 'cursor-pointer' : ''}`}
    >
      <div className={`relative shrink-0 ${ringClass}`}>
        <svg viewBox={`0 0 ${cx * 2} ${cx * 2}`} className="h-full w-full -rotate-90" aria-hidden>
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            className="text-border-custom/50"
          />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className={`${RING_ACCENT[kind]} ${reduceMotion ? '' : 'transition-[stroke-dashoffset] duration-[var(--motion-slow)] ease-[var(--ease-out)]'}`}
          />
        </svg>
        <div className={`absolute inset-1.5 flex items-center justify-center rounded-full text-xs font-bold ${KIND_ACCENT[kind]}`}>
          {kind === 'people'
            ? initialsFrom(row.item.title, row.item.related_name)
            : <Icon size={compact ? 14 : 16} strokeWidth={2} />}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight text-text-primary">{row.item.title}</p>
        <p className="truncate text-xs text-text-muted">
          {LIFE_OBLIGATION_KIND_LABELS[row.item.kind as LifeObligationKind]}
          {row.item.related_name ? ` · ${row.item.related_name}` : ''}
        </p>
        <p className="mt-0.5 text-xs font-medium text-text-secondary">
          {formatLongDateWarsaw(row.nextDate)} · {countdownLabel(row.daysLeft)}
          {' · '}
          {LIFE_OBLIGATION_RECURRENCE_LABELS[
            (row.item.recurrence as LifeObligationRecurrence) || 'yearly'
          ]}
        </p>
        {!compact && (
          <p className="mt-1 text-3xs font-semibold uppercase tracking-wide text-text-muted/80">
            Przypomnienia {leads}
          </p>
        )}
      </div>

      <Pressable
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded-xl p-2.5 text-text-muted opacity-[var(--opacity-70)] transition-[opacity,background-color,color,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-danger/10 hover:text-danger hover:opacity-[var(--opacity-100)] active:scale-95 md:opacity-[var(--opacity-0)] md:group-hover:opacity-[var(--opacity-100)]"
        aria-label="Usuń termin"
      >
        <Trash2 size={16} />
      </Pressable>
    </article>
  );
}
