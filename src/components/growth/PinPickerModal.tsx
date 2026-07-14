import { Pressable, ControlInput, ControlSelect } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { BookOpen, ListTodo, Plus } from 'lucide-react';
import type { GrowthLinkRow, GrowthProjectSummary, GrowthTodoRow } from './hooks/useGrowthData';
import type { GrowthPinSlot, GrowthResourceType, LearningSkill } from '../../lib/growth/growth';
import {
  MAX_ACTIVE,
  MAX_MUST,
  RESOURCE_TYPE_META,
  inferResourceType,
} from '../../lib/growth/growth';
import Modal from '../ui/Modal';

export default function PinPickerModal({
  slot,
  skills,
  projects,
  focusSkillId,
  defaultProjectId,
  unreadLinks,
  openTodos,
  pinnedLinkIds,
  pinnedTodoIds,
  onClose,
  onPickLink,
  onPickTodo,
  onPickManual,
}: {
  slot: GrowthPinSlot;
  skills: LearningSkill[];
  projects: GrowthProjectSummary[];
  focusSkillId: string | null;
  defaultProjectId?: string | null;
  unreadLinks: GrowthLinkRow[];
  openTodos: GrowthTodoRow[];
  pinnedLinkIds: Set<string>;
  pinnedTodoIds: Set<string>;
  onClose: () => void;
  onPickLink: (linkId: string, skillId: string | null, projectId: string | null) => void;
  onPickTodo: (todoId: string, skillId: string | null, projectId: string | null) => void;
  onPickManual: (title: string, resourceType: GrowthResourceType, skillId: string | null, projectId: string | null) => void;
}) {
  const [tab, setTab] = useState<'pocket' | 'todo' | 'manual'>('pocket');
  const [skillId, setSkillId] = useState(focusSkillId ?? skills[0]?.id ?? '');
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '');
  const [manualTitle, setManualTitle] = useState('');
  const [manualType, setManualType] = useState<GrowthResourceType>('book');

  const availableLinks = unreadLinks.filter((l) => !pinnedLinkIds.has(l.id));
  const availableTodos = openTodos.filter((t) => !pinnedTodoIds.has(t.id));

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      showCloseButton={false}
    >
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">
          Przypnij — {slot === 'must' ? 'MUST' : 'W toku'}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Max {slot === 'must' ? MAX_MUST : MAX_ACTIVE} w slocie
        </p>
      </div>

      <div className="px-0 pt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-2xs font-black uppercase tracking-wider text-text-muted">Skill</label>
            <ControlSelect
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-sm"
            >
              {skills.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </ControlSelect>
          </div>
          <div>
            <label className="text-2xs font-black uppercase tracking-wider text-text-muted">Projekt</label>
            <ControlSelect
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-custom bg-surface-solid px-3 py-2 text-sm"
            >
              <option value="">— bez projektu —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </ControlSelect>
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-3">
          {([
            ['pocket', 'Pocket', BookOpen],
            ['todo', 'Zadania', ListTodo],
            ['manual', 'Ręcznie', Plus],
          ] as const).map(([id, label, Icon]) => (
            <Pressable
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-black uppercase cursor-pointer ${
                tab === id ? 'bg-primary/10 text-primary' : 'text-text-muted'
              }`}
            >
              <Icon size={12} /> {label}
            </Pressable>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tab === 'pocket' &&
            (availableLinks.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">Brak nieprzeczytanych linków</p>
            ) : (
              availableLinks.map((link) => (
                <Pressable
                  key={link.id}
                  variant="outline"
                  onClick={() => onPickLink(link.id, skillId || null, projectId || null)}
                  className="w-full text-left justify-start p-3 h-auto"
                >
                  <div>
                    <p className="text-sm font-bold text-text-primary line-clamp-2">{link.title || link.url}</p>
                    <p className="text-2xs text-text-muted mt-1">{link.category}</p>
                  </div>
                </Pressable>
              ))
            ))}

          {tab === 'todo' &&
            (availableTodos.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">Brak otwartych zadań</p>
            ) : (
              availableTodos.map((todo) => (
                <Pressable
                  key={todo.id}
                  variant="outline"
                  onClick={() => onPickTodo(todo.id, skillId || null, projectId || null)}
                  className="w-full text-left justify-start p-3 h-auto"
                >
                  <p className="text-sm font-bold text-text-primary">{todo.title}</p>
                </Pressable>
              ))
            ))}

          {tab === 'manual' && (
            <div className="space-y-3">
              <ControlInput
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Tytuł (książka, ćwiczenie…)"
                className="w-full rounded-xl border border-border-custom px-3 py-2.5 text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(RESOURCE_TYPE_META) as GrowthResourceType[]).map((t) => (
                  <Pressable
                    key={t}
                    type="button"
                    onClick={() => setManualType(t)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                      manualType === t ? 'bg-primary/15 text-primary' : 'bg-surface text-text-muted'
                    }`}
                  >
                    {RESOURCE_TYPE_META[t].emoji} {RESOURCE_TYPE_META[t].label}
                  </Pressable>
                ))}
              </div>
              <Pressable
                variant="primary"
                onClick={() => {
                  onPickManual(manualTitle.trim(), manualType, skillId || null, projectId || null);
                  onClose();
                }}
                disabled={!manualTitle.trim()}
                className="w-full"
              >
                Dodaj
              </Pressable>
            </div>
          )}
        </div>
    </Modal>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function pinTitle(
  pin: {
    entity_type: string;
    manual_title: string | null;
    entity_id: string | null;
  },
  linksById: Map<string, GrowthLinkRow>,
  todosById: Map<string, GrowthTodoRow>,
): string {
  if (pin.entity_type === 'manual') return pin.manual_title || 'Bez tytułu';
  if (pin.entity_type === 'link' && pin.entity_id) {
    const l = linksById.get(pin.entity_id);
    return l?.title || l?.url || 'Link';
  }
  if (pin.entity_type === 'todo' && pin.entity_id) {
    return todosById.get(pin.entity_id)?.title || 'Zadanie';
  }
  return '—';
}

// eslint-disable-next-line react-refresh/only-export-components
export function pinResourceType(
  pin: {
    entity_type: string;
    manual_resource_type: GrowthResourceType | null;
    entity_id: string | null;
  },
  linksById: Map<string, GrowthLinkRow>,
): GrowthResourceType {
  if (pin.manual_resource_type) return pin.manual_resource_type;
  if (pin.entity_type === 'todo') return 'exercise';
  if (pin.entity_type === 'link' && pin.entity_id) {
    const l = linksById.get(pin.entity_id);
    if (l?.resource_type) return l.resource_type as GrowthResourceType;
    return inferResourceType(l?.url ?? '', l?.domain ?? '');
  }
  return 'article';
}
