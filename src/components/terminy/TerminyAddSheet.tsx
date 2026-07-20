import { useMemo, useState } from 'react';
import {
  DEFAULT_LEAD_OFFSETS,
  DEFAULT_RECURRENCE,
  LIFE_OBLIGATION_KIND_LABELS,
  LIFE_OBLIGATION_RECURRENCE_LABELS,
  LIFE_OBLIGATION_RECURRENCES,
  getTodayWarsaw,
  leadLabel,
  nextOccurrence,
  shiftDateStr,
  type LifeObligationKind,
  type LifeObligationRecurrence,
} from '@vanguard/domain';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Pressable } from '../ui/ControlPrimitives';
import type { LifeObligation, LifeObligationInput } from '../../lib/lifeObligationsApi';
import { formatLongDateWarsaw } from '../../lib/date';
import {
  isYmd,
  monthsAheadDate,
  templatesForKind,
  type StarterTemplate,
} from './terminyDerived';

const FORM_KINDS: LifeObligationKind[] = ['people', 'vehicle', 'document'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: LifeObligationInput) => Promise<void>;
  pending?: boolean;
  initialTemplate?: StarterTemplate | null;
  initialKind?: LifeObligationKind;
  editing?: LifeObligation | null;
}

interface FormSeed {
  kind: LifeObligationKind;
  recurrence: LifeObligationRecurrence;
  title: string;
  relatedName: string;
  anchorDate: string;
  typeId: string | null;
}

function buildSeed(
  editing: LifeObligation | null | undefined,
  initialTemplate: StarterTemplate | null | undefined,
  initialKind: LifeObligationKind,
  today: string,
): FormSeed {
  if (editing) {
    return {
      kind: editing.kind,
      recurrence: editing.recurrence,
      title: editing.title,
      relatedName: editing.related_name ?? '',
      anchorDate: editing.anchor_date,
      typeId: null,
    };
  }
  const nextKind = initialTemplate?.kind ?? initialKind;
  const options = templatesForKind(nextKind);
  const picked = initialTemplate ?? options[0] ?? null;
  return {
    kind: nextKind,
    recurrence: DEFAULT_RECURRENCE[nextKind],
    title: picked?.title ?? '',
    relatedName: '',
    anchorDate: picked ? monthsAheadDate(today, picked.monthsAhead) : today,
    typeId: picked?.id ?? null,
  };
}

/** Remounts when seed identity changes — avoids setState-in-effect. */
export default function TerminyAddSheet(props: Props) {
  const today = getTodayWarsaw();
  const formKey = props.open
    ? `${props.editing?.id ?? 'new'}:${props.initialTemplate?.id ?? 'none'}:${props.initialKind}`
    : 'closed';

  return (
    <Modal
      isOpen={props.open}
      onClose={props.onClose}
      title={props.editing ? 'Edytuj termin' : 'Nowy termin'}
      subtitle={props.editing ? 'Zmień datę, cykl albo przypomnienia' : 'Kategoria → typ → data'}
      size="md"
      padding="p-5"
    >
      {props.open ? (
        <TerminyAddForm
          key={formKey}
          seed={buildSeed(props.editing, props.initialTemplate, props.initialKind ?? 'people', today)}
          isEdit={Boolean(props.editing)}
          today={today}
          pending={props.pending}
          onClose={props.onClose}
          onSubmit={props.onSubmit}
        />
      ) : null}
    </Modal>
  );
}

interface FormProps {
  seed: FormSeed;
  isEdit: boolean;
  today: string;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (input: LifeObligationInput) => Promise<void>;
}

function TerminyAddForm({ seed, isEdit, today, pending, onClose, onSubmit }: FormProps) {
  const [kind, setKind] = useState(seed.kind);
  const [recurrence, setRecurrence] = useState(seed.recurrence);
  const [title, setTitle] = useState(seed.title);
  const [relatedName, setRelatedName] = useState(seed.relatedName);
  const [anchorDate, setAnchorDate] = useState(seed.anchorDate);
  const [typeId, setTypeId] = useState(seed.typeId);

  const typeOptions = useMemo(() => templatesForKind(kind), [kind]);
  const activeType = typeOptions.find((t) => t.id === typeId) ?? typeOptions[0] ?? null;
  const leads = DEFAULT_LEAD_OFFSETS[kind];
  const safeAnchor = isYmd(anchorDate) ? anchorDate : today;
  const occurrence = nextOccurrence(safeAnchor, recurrence, today) ?? safeAnchor;
  const leadPreview = isYmd(occurrence)
    ? leads.map((offset) => `${leadLabel(offset)} → ${formatLongDateWarsaw(shiftDateStr(occurrence, offset))}`).join(' · ')
    : '—';

  const selectKind = (next: LifeObligationKind) => {
    const first = templatesForKind(next)[0] ?? null;
    setKind(next);
    setRecurrence(DEFAULT_RECURRENCE[next]);
    setTypeId(first?.id ?? null);
    setTitle(first?.title ?? '');
    setRelatedName('');
  };

  const selectType = (tpl: StarterTemplate) => {
    setTypeId(tpl.id);
    setTitle(tpl.title);
    setAnchorDate(monthsAheadDate(today, tpl.monthsAhead));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !isYmd(anchorDate)) return;
    await onSubmit({
      title: title.trim(),
      kind,
      related_name: relatedName.trim() || null,
      anchor_date: anchorDate,
      recurrence,
      lead_offsets: leads,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Kategoria</p>
        <div className="flex flex-wrap gap-2">
          {FORM_KINDS.map((k) => (
            <Pressable
              key={k}
              onClick={() => selectKind(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 ${
                kind === k ? 'bg-primary text-on-accent' : 'bg-surface-2 text-text-secondary'
              }`}
            >
              {LIFE_OBLIGATION_KIND_LABELS[k]}
            </Pressable>
          ))}
        </div>
      </div>

      {!isEdit && typeOptions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Typ</p>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((tpl) => (
              <Pressable
                key={tpl.id}
                onClick={() => selectType(tpl)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 ${
                  typeId === tpl.id
                    ? 'bg-primary text-on-accent'
                    : 'border border-border-custom/50 bg-surface-2/60 text-text-secondary'
                }`}
              >
                {tpl.title}
              </Pressable>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Powtarzanie</p>
        <div className="flex flex-wrap gap-2">
          {LIFE_OBLIGATION_RECURRENCES.map((r) => (
            <Pressable
              key={r}
              onClick={() => setRecurrence(r)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 ${
                recurrence === r ? 'bg-primary text-on-accent' : 'bg-surface-2 text-text-secondary'
              }`}
            >
              {LIFE_OBLIGATION_RECURRENCE_LABELS[r]}
            </Pressable>
          ))}
        </div>
        <p className="mt-1.5 text-3xs text-text-muted">
          {recurrence === 'yearly' && 'Po dacie automatycznie liczy się ten sam dzień w kolejnym roku.'}
          {recurrence === 'monthly' && 'Po dacie skacze na ten sam dzień miesiąca w następnym miesiącu.'}
          {recurrence === 'once' && 'Po dacie znika z listy (jednorazowy termin).'}
        </p>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={activeType?.titlePlaceholder ?? 'Nazwa terminu'}
        aria-label="Nazwa"
      />
      <Input
        value={relatedName}
        onChange={(e) => setRelatedName(e.target.value)}
        placeholder={activeType?.relatedPlaceholder ?? 'Powiązanie (opcjonalnie)'}
        aria-label="Powiązanie"
      />
      <label className="block text-xs font-semibold text-text-muted">
        Data
        <Input
          type="date"
          value={isYmd(anchorDate) ? anchorDate : today}
          onChange={(e) => setAnchorDate(e.target.value)}
          className="mt-1"
        />
      </label>

      <p className="rounded-xl bg-surface-2/70 px-3 py-2 text-xs leading-relaxed text-text-secondary">
        Kolejna data: {formatLongDateWarsaw(occurrence)} ({LIFE_OBLIGATION_RECURRENCE_LABELS[recurrence]})
        <br />
        Przypomnienia: {leadPreview}
      </p>

      <div className="flex gap-2 pt-1">
        <Button onClick={() => void handleSubmit()} disabled={pending || !title.trim() || !isYmd(anchorDate)}>
          {isEdit ? 'Zapisz zmiany' : 'Zapisz'}
        </Button>
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
      </div>
    </div>
  );
}
