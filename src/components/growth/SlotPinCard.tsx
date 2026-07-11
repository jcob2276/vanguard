import { Check, ExternalLink, FolderKanban, Trash2 } from 'lucide-react';
import type { GrowthLinkRow, GrowthProjectSummary, GrowthTodoRow } from './hooks/useGrowthData';
import type { GrowthPinSlot, LearningSkill, LearningWeekPin } from '../../lib/growth/growth';
import { RESOURCE_TYPE_META } from '../../lib/growth/growth';
import { pinResourceType, pinTitle } from './PinPickerModal';

interface SlotPinCardProps {
  pin: LearningWeekPin;
  slot: GrowthPinSlot;
  skillsById: Map<string, LearningSkill>;
  linksById: Map<string, GrowthLinkRow>;
  todosById: Map<string, GrowthTodoRow>;
  projectsById: Map<string, GrowthProjectSummary>;
  focusSkillId: string | null;
  focusTargetLevel: number | null;
  onDone: (pin: LearningWeekPin) => void;
  onRemove: (pinId: string) => void;
  readOnly: boolean;
}

export default function SlotPinCard({
  pin,
  slot,
  skillsById,
  linksById,
  todosById,
  projectsById,
  focusSkillId,
  focusTargetLevel,
  onDone,
  onRemove,
  readOnly,
}: SlotPinCardProps) {
  const rt = pinResourceType(pin, linksById);
  const meta = RESOURCE_TYPE_META[rt];
  const skill = pin.skill_id ? skillsById.get(pin.skill_id) : null;
  const project = pin.project_id ? projectsById.get(pin.project_id) : null;
  const titleText = pinTitle(pin, linksById, todosById);
  const link = pin.entity_type === 'link' && pin.entity_id ? linksById.get(pin.entity_id) : null;

  const isFocusPin =
    slot === 'must' &&
    focusSkillId &&
    pin.skill_id === focusSkillId &&
    focusTargetLevel != null;

  return (
    <div
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
            {project && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                <FolderKanban size={9} /> {project.name}
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
}
