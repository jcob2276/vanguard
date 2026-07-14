import type { GrowthLinkRow, GrowthProjectSummary, GrowthTodoRow } from './hooks/useGrowthData';
import type { GrowthPinSlot, LearningSkill, LearningWeekPin } from '../../lib/growth/growth';
import { MAX_ACTIVE, MAX_MUST } from '../../lib/growth/growth';
import type { TheoryPracticeBalance } from '../../lib/growth/growthMastery';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
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
          <Button
            variant="primary"
            size="sm"
            onClick={() => onAddPin('must')}
            className="shrink-0 uppercase font-black"
          >
            + MUST
          </Button>
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
        <Card variant="accent" padding="0.75rem" className="border-dashed space-y-2">
          <p className="text-[9px] font-black uppercase tracking-wider text-primary">
            Szybka akcja (praktyka &gt; teoria)
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedTodos.slice(0, 3).map((todo) =>
              onQuickPinTodo ? (
                <Button
                  key={todo.id}
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickPinTodo(todo.id, 'must')}
                  className="max-w-full truncate border-success/30 bg-success/5 hover:border-primary/40"
                >
                  ↗ {todo.title}
                </Button>
              ) : null,
            )}
            {suggestedLinks.slice(0, 4).map((link) =>
              onQuickPinLink ? (
                <Button
                  key={link.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => onQuickPinLink(link.id, 'must')}
                  className="max-w-full truncate hover:border-primary/40"
                >
                  + {link.title || link.domain}
                </Button>
              ) : null,
            )}
          </div>
          {balance && balance.theory > balance.practice && (
            <p className="text-[10px] text-warning dark:text-warning">
              Masz więcej teorii niż praktyki — priorytet: zadanie / ćwiczenie, nie kolejne wideo.
            </p>
          )}
        </Card>
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
