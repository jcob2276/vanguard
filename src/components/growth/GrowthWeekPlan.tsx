import type { GrowthLinkRow, GrowthProjectSummary, GrowthTodoRow } from './hooks/useGrowthData';
import type { GrowthPinSlot, LearningSkill, LearningWeekPin } from '../../lib/growth/growth';
import { MAX_ACTIVE, MAX_MUST } from '../../lib/growth/growth';
import type { TheoryPracticeBalance } from '../../lib/growth/growthMastery';
import SlotSection from './SlotSection';

export default function GrowthWeekPlan({
  pins,
  skills,
  links,
  todos,
  projects = [],
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
  projects?: GrowthProjectSummary[];
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
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const doneCount = pins.filter((p) => p.done).length;

  const mustPins = pins.filter((p) => p.slot === 'must');
  const mustOpen = MAX_MUST - mustPins.length;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-text-muted">Plan tygodnia</p>
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
          projectsById={projectsById}
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
            Szybka akcja (praktyka &gt; teoria)
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
              Masz więcej teorii niż praktyki — priorytet: zadanie / ćwiczenie, nie kolejne wideo.
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
        projectsById={projectsById}
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
