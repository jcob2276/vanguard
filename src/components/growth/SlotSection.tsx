import { Plus } from 'lucide-react';
import type { GrowthLinkRow, GrowthProjectSummary, GrowthTodoRow } from './hooks/useGrowthData';
import type { GrowthPinSlot, LearningSkill, LearningWeekPin } from '../../lib/growth/growth';
import SlotPinCard from './SlotPinCard';

export default function SlotSection({
  title,
  slot,
  max,
  pins,
  skillsById,
  linksById,
  todosById,
  projectsById,
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
  projectsById: Map<string, GrowthProjectSummary>;
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

  const renderPin = (pin: LearningWeekPin) => (
    <SlotPinCard
      key={pin.id}
      pin={pin}
      slot={slot}
      skillsById={skillsById}
      linksById={linksById}
      todosById={todosById}
      projectsById={projectsById}
      focusSkillId={focusSkillId}
      focusTargetLevel={focusTargetLevel}
      onDone={onDone}
      onRemove={onRemove}
      readOnly={readOnly}
    />
  );

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
