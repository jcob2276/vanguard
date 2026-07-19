import type { GrowthLinkRow, GrowthTodoRow } from './hooks/useGrowthData';

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
