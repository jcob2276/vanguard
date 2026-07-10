import { useCallback, useState } from 'react';
import type { Database } from '../../../lib/database.types';

type TodoItemRow = Database['public']['Tables']['todo_items']['Row'];

export function useTodoUiState() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [activeFilterSection, setActiveFilterSection] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: TodoItemRow } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleExpand = useCallback((id: string) => setExpandedId(prev => prev === id ? null : id), []);
  const toggleSectionCollapse = useCallback((id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const showContextMenu = useCallback((item: TodoItemRow, x: number, y: number) => {
    setContextMenu({ x, y, item });
    setExpandedId(null);
  }, []);

  return {
    busy, setBusy,
    error, setError,
    showDone, setShowDone,
    expandedId, setExpandedId,
    editingId, setEditingId,
    editingTitle, setEditingTitle,
    activeFilterSection, setActiveFilterSection,
    contextMenu, setContextMenu,
    collapsedSections, setCollapsedSections,
    toggleExpand, toggleSectionCollapse,
    showContextMenu,
  };
}
