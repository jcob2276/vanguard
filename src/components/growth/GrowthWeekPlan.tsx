import { Check, ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { GrowthLinkRow, GrowthTodoRow } from '../../hooks/useGrowthData';
import type { GrowthPinSlot, LearningSkill, LearningWeekPin } from '../../lib/growth';
import { MAX_ACTIVE, MAX_MUST, RESOURCE_TYPE_META } from '../../lib/growth';
import type { TheoryPracticeBalance } from '../../lib/growthMastery';
import { pinResourceType, pinTitle } from './PinPickerModal';

function SlotSection({
  title,
  slot,
  max,
  pins,
  skillsById,
  linksById,
  todosById,
  focusSkillId,
  focusTargetLevel,
  onAdd,
  onDone,
  onRemove,
  readOnly,
  gridMode = false,
  hideHeader = false,
}: {
  title: string;
  slot: GrowthPinSlot;
  max: number;
  pins: LearningWeekPin[];
  skillsById: Map<string, LearningSkill>;
  linksById: Map<string, GrowthLinkRow>;
  todosById: Map<string, GrowthTodoRow>;
  focusSkillId: string | null;
  focusTargetLevel: number | null;
  onAdd: () => void;
  onDone: (pin: LearningWeekPin) => void;
  onRemove: (pinId: string) => void;
  readOnly: boolean;
  gridMode?: boolean;
  hideHeader?: boolean;
}) {
  const slotPins = pins.filter((p) => p.slot === slot);
  const empty = max - slotPins.length;

  const renderEmpty = (i: number) => (
    <button
      key={`empty-${slot}-${i}`}
      type="button"
      onClick={onAdd}
      className={`rounded-xl border border-dashed border-border-custom text-[11px] font-bold text-text-muted hover:border-primary/40 hover:text-primary cursor-pointer flex flex-col items-center justify-center gap-1 ${
        gridMode ? 'min-h-[100px] py-6' : 'w-full py-4 flex-row'
      }`}
    >
      <Plus size={14} />
      {gridMode ? <span>MUST {slotPins.length + i + 1}</span> : <span>Przypnij</span>}
    </button>
  );

  const renderPin = (pin: LearningWeekPin) => {
          const rt = pinResourceType(pin, linksById);
          const meta = RESOURCE_TYPE_META[rt];
          const skill = pin.skill_id ? skillsById.get(pin.skill_id) : null;
          const titleText = pinTitle(pin, linksById, todosById);
          const link = pin.entity_type === 'link' && pin.entity_id ? linksById.get(pin.entity_id) : null;

          const isFocusPin =
            slot === 'must' &&
            focusSkillId &&
            pin.skill_id === focusSkillId &&
            focusTargetLevel != null;

          return (
            <div
              key={pin.id}
              className={`rounded-xl border p-3 transition-all h-full ${
                pin.done
                  ? 'border-emerald-500/25 bg-emerald-500/[0.04] opacity-75'
                  : slot === 'must'
                    ? 'border-rose-500/20 bg-surface/40'
                    : 'border-border-custom bg-surface/40'
              }`}
            >
              <div className="flex items-start gap-2">
                {slot === 'must' && !pin.done && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" title="MUST" />
                )}
                <span className="text-lg leading-none mt-0.5">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-bold leading-snug ${pin.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                    {titleText}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {skill && (
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                        {skill.label}
                      </span>
                    )}
                    {isFocusPin && (
                      <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400">
                        → Lvl {focusTargetLevel}
                      </span>
                    )}
                    <span className="text-[9px] text-text-muted">{meta.label}</span>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex shrink-0 gap-1">
                    {link?.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-text-muted hover:text-primary"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    {!pin.done && (
                      <button
                        type="button"
                        onClick={() => onDone(pin)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 cursor-pointer"
                        title="Done"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(pin.id)}
                      className="p-1.5 text-text-muted hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
  };

  if (gridMode) {
    return (
      <>
        {slotPins.map(renderPin)}
        {!readOnly && empty > 0 && Array.from({ length: empty }).map((_, i) => renderEmpty(i))}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {!hideHeader && title && (
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">{title}</p>
      )}
      <div className="space-y-2">
        {slotPins.map(renderPin)}
        {!readOnly && empty > 0 && Array.from({ length: empty }).map((_, i) => renderEmpty(i))}
      </div>
    </div>
  );
}

export default function GrowthWeekPlan({
  pins,
  skills,
  links,
  todos,
  focusSkillId,
  focusTargetLevel,
  readOnly,
  suggestedLinks = [],
  suggestedTodos = [],
  balance,
  onAddPin,
  onQuickPinLink,
  onQuickPinTodo,
  onDonePin,
  onRemovePin,
}: {
  pins: LearningWeekPin[];
  skills: LearningSkill[];
  links: GrowthLinkRow[];
  todos: GrowthTodoRow[];
  focusSkillId: string | null;
  focusTargetLevel: number | null;
  readOnly: boolean;
  suggestedLinks?: GrowthLinkRow[];
  suggestedTodos?: GrowthTodoRow[];
  balance?: TheoryPracticeBalance;
  onAddPin: (slot: GrowthPinSlot) => void;
  onQuickPinLink?: (linkId: string, slot: GrowthPinSlot) => void;
  onQuickPinTodo?: (todoId: string, slot: GrowthPinSlot) => void;
  onDonePin: (pin: LearningWeekPin) => void;
  onRemovePin: (pinId: string) => void;
}) {
  const skillsById = new Map(skills.map((s) => [s.id, s]));
  const linksById = new Map(links.map((l) => [l.id, l]));
  const todosById = new Map(todos.map((t) => [t.id, t]));

  const doneCount = pins.filter((p) => p.done).length;

  const mustPins = pins.filter((p) => p.slot === 'must');
  const mustOpen = MAX_MUST - mustPins.length;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-muted">Reps tygodnia</p>
          <p className="text-[13px] font-bold text-text-primary mt-1">
            {doneCount}/{pins.length} zamknięte
            <span className="text-text-muted font-semibold ml-2">
              · MUST {mustPins.filter((p) => p.done).length}/{mustPins.length || MAX_MUST}
            </span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Max 3 micro-misje · 70% czasu na weak link, nie na to co już umiesz
          </p>
        </div>
        {!readOnly && mustOpen > 0 && (
          <button
            type="button"
            onClick={() => onAddPin('must')}
            className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase text-white cursor-pointer shrink-0"
          >
            + MUST
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SlotSection
          title=""
          slot="must"
          max={MAX_MUST}
          pins={pins}
          skillsById={skillsById}
          linksById={linksById}
          todosById={todosById}
          onAdd={() => onAddPin('must')}
          onDone={onDonePin}
          onRemove={onRemovePin}
          focusSkillId={focusSkillId}
          focusTargetLevel={focusTargetLevel}
          readOnly={readOnly}
          gridMode
          hideHeader
        />
      </div>

      {!readOnly && mustOpen > 0 && (suggestedTodos.length > 0 || suggestedLinks.length > 0) && (
        <div className="rounded-xl border border-dashed border-primary/25 bg-primary/[0.03] p-3 space-y-2">
          <p className="text-[9px] font-black uppercase tracking-wider text-primary">
            Szybki rep (praktyka &gt; teoria)
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedTodos.slice(0, 3).map((todo) =>
              onQuickPinTodo ? (
                <button
                  key={todo.id}
                  type="button"
                  onClick={() => onQuickPinTodo(todo.id, 'must')}
                  className="max-w-full rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] font-semibold text-text-primary hover:border-primary/40 cursor-pointer truncate"
                >
                  ↗ {todo.title}
                </button>
              ) : null,
            )}
            {suggestedLinks.slice(0, 4).map((link) =>
              onQuickPinLink ? (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onQuickPinLink(link.id, 'must')}
                  className="max-w-full rounded-lg border border-border-custom bg-surface-solid px-2.5 py-1.5 text-[11px] font-semibold text-text-primary hover:border-primary/40 cursor-pointer truncate"
                >
                  + {link.title || link.domain}
                </button>
              ) : null,
            )}
          </div>
          {balance && balance.theory > balance.practice && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              Masz więcej teorii niż repów — priorytet: todo / ćwiczenie, nie kolejne wideo.
            </p>
          )}
        </div>
      )}

      <SlotSection
        title={`Teoria w toku · max ${MAX_ACTIVE}`}
        slot="active"
        max={MAX_ACTIVE}
        pins={pins}
        skillsById={skillsById}
        linksById={linksById}
        todosById={todosById}
        onAdd={() => onAddPin('active')}
        onDone={onDonePin}
        onRemove={onRemovePin}
        focusSkillId={focusSkillId}
        focusTargetLevel={focusTargetLevel}
        readOnly={readOnly}
      />
    </section>
  );
}

export function GrowthWeekStats({ pins }: { pins: LearningWeekPin[] }) {
  const done = pins.filter((p) => p.done).length;
  return (
    <p className="text-[10px] font-bold text-text-muted">
      {done}/{pins.length} slotów · {pins.filter((p) => p.slot === 'must' && p.done).length}/
      {pins.filter((p) => p.slot === 'must').length} MUST
    </p>
  );
}
