import { motion, useReducedMotion } from 'framer-motion';
import { LIFE_OBLIGATION_KIND_LABELS, type LifeObligationKind } from '@vanguard/domain';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import { TerminyObligationCard } from './TerminyObligationCard';
import { filterByKind, type DerivedObligation } from './terminyDerived';

interface Props {
  kind: LifeObligationKind;
  rows: DerivedObligation[];
  onDelete: (id: string, title: string) => void;
  onEdit: (id: string) => void;
  onOpenAdd: () => void;
}

export function TerminyVault({ kind, rows, onDelete, onEdit, onOpenAdd }: Props) {
  const reduceMotion = useReducedMotion();
  const filtered = filterByKind(rows, kind);

  if (filtered.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={kind === 'people' ? '🎂' : kind === 'vehicle' ? '🚗' : '📄'}
          label={`Brak pozycji w: ${LIFE_OBLIGATION_KIND_LABELS[kind]}`}
          action={{ label: 'Dodaj', onClick: onOpenAdd }}
        />
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onOpenAdd}>Dodaj termin</Button>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {filtered.map((row, index) => (
        <motion.li
          key={row.item.id}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.22,
            delay: reduceMotion ? 0 : Math.min(index, 8) * 0.035,
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
  );
}
