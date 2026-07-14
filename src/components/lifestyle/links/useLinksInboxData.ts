import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { notify, confirmDialog } from '../../../lib/notify';
import { convertLinkToKeepNote, convertLinkToTodoItem } from '../../../lib/behavior/captureBridge';
import { usePersistentDraft } from '../../../hooks/usePersistentDraft';
import {
  fetchLinks as apiFetchLinks,
  saveSharedLink as apiSaveSharedLink,
  addNewLink as apiAddNewLink,
  fetchTriageSuggestions as apiFetchTriageSuggestions,
  updateLinkTriage as apiUpdateLinkTriage,
  updateLinkNotes as apiUpdateLinkNotes,
  deleteLink as apiDeleteLink,
  type SavedLink,
  type TriageSuggestion,
} from '../../../lib/linksApi';

import { useSession } from '../../../store/useStore';
import { linksKeys } from '../../../lib/queryKeys';



export function useLinksInboxData(haptic: (pattern: number | number[]) => void) {
  const session = useSession();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [sharingStatus, setSharingStatus] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = usePersistentDraft<Record<string, string>>(`vanguard_link_notes_drafts_${userId}`, {});
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [addUrl, setAddUrl] = usePersistentDraft(`vanguard_link_add_url_draft_${userId}`, '');
  const [showAddForm, setShowAddForm] = useState(() => Boolean(addUrl.trim()));
  const [addLoading, setAddLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [bouncingIds, setBouncingIds] = useState<Set<string>>(new Set());
  const [convertingLinkId, setConvertingLinkId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageSuggestions, setTriageSuggestions] = useState<TriageSuggestion[]>([]);
  const [showTriagePanel, setShowTriagePanel] = useState(false);

  const linksQuery = useQuery({
    queryKey: linksKeys.list(userId),
    queryFn: () => apiFetchLinks(supabase, userId),
  });

  const links = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const loading = linksQuery.isLoading;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: linksKeys.list(userId) });
  }, [queryClient, userId]);

  const saveSharedLink = useCallback(async (actualUrl: string) => {
    setSharingStatus('Zapisywanie udostępnionego linku...');
    try {
      await apiSaveSharedLink(actualUrl);
      setSharingStatus('Zapisano!');
      setTimeout(() => setSharingStatus(null), 2500);
    } catch (err: unknown) {
      console.error('[LinksInbox] Failed to process shared link:', err);
      notify(`Błąd zapisu linku: ${(err as Error).message}`, 'error');
      setSharingStatus(null);
    } finally {
      invalidate();
    }
  }, [invalidate]);

  const handleAddLink = async () => {
    const raw = addUrl.trim();
    const urlMatch = raw.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) return;
    setAddLoading(true);
    try {
      await apiAddNewLink(urlMatch[0]);
      setAddUrl('');
      setShowAddForm(false);
      invalidate();
    } catch (err: unknown) {
      notify(`Błąd: ${(err as Error).message}`, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCandidate = params.get('share_url') || params.get('share_text') || '';
    const match = urlCandidate.match(/https?:\/\/[^\s]+/);
    if (match) {
      window.history.replaceState({}, document.title, '/');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate side effect on mount
      void saveSharedLink(match[0]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  const toggleReadStatus = async (id: string, current: 'unread' | 'read') => {
    haptic(current === 'unread' ? [8, 20, 8] : [5]);
    const next = current === 'unread' ? 'read' : 'unread';
    setBouncingIds(prev => new Set([...prev, id]));
    setTimeout(() => setBouncingIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 400);
    // Optimistic update
    queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
      (prev ?? []).map(l => l.id === id ? { ...l, status: next } : l)
    );
    try {
      await apiUpdateLinkTriage(supabase, id, { status: next });
    } catch (err) {
      console.error('[LinksInbox] toggleReadStatus failed:', err);
      invalidate();
    }
  };

  const saveNotes = async (id: string) => {
    const draft = notesDrafts[id];
    if (draft === undefined) return;
    const link = links.find(l => l.id === id);
    if (!link || draft === (link.notes ?? '')) return;
    try {
      await apiUpdateLinkNotes(supabase, id, draft);
      queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
        (prev ?? []).map(l => l.id === id ? { ...l, notes: draft } : l)
      );
      setSavedNoteId(id);
      setTimeout(() => setSavedNoteId(null), 1800);
    } catch (err) {
      console.error('[LinksInbox] saveNotes failed:', err);
      notify('Nie udało się zapisać notatki — spróbuj ponownie.', 'error');
      setNotesDrafts(prev => ({ ...prev, [id]: link.notes ?? '' }));
    }
  };

  const deleteLink = async (id: string) => {
    if (!(await confirmDialog('Usuń ten link?'))) return;
    haptic([12, 50, 18]);
    setDeletingIds(prev => new Set([...prev, id]));
    setTimeout(async () => {
      queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
        (prev ?? []).filter(l => l.id !== id)
      );
      setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      try {
        await apiDeleteLink(supabase, id);
      } catch (error) {
        console.warn('[LinksInbox] delete failed:', (error as Error).message);
      }
    }, 260);
  };

  const updateLinkCategory = async (id: string, newCategory: string) => {
    try {
      await apiUpdateLinkTriage(supabase, id, { category: newCategory });
      queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
        (prev ?? []).map(l => l.id === id ? { ...l, category: newCategory } : l)
      );
    } catch (err: unknown) {
      console.error('[Action Error]', err);
      notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
    }
  };

  const handleLinkToTodo = async (link: SavedLink) => {
    setConvertingLinkId(link.id);
    try {
      await convertLinkToTodoItem(userId, link);
      queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
        (prev ?? []).map(l => l.id === link.id ? { ...l, status: 'read' as const } : l)
      );
      notify('Dodano do zadań', 'success');
    } catch (err: unknown) {
      notify((err as Error).message || 'Nie udało się dodać do zadań', 'error');
    } finally {
      setConvertingLinkId(null);
    }
  };

  const handleLinkToNote = async (link: SavedLink) => {
    setConvertingLinkId(link.id);
    try {
      await convertLinkToKeepNote(userId, link);
      queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
        (prev ?? []).map(l => l.id === link.id ? { ...l, status: 'read' as const } : l)
      );
      notify('Zapisano w notatkach', 'success');
    } catch (err: unknown) {
      notify((err as Error).message || 'Nie udało się zapisać notatki', 'error');
    } finally {
      setConvertingLinkId(null);
    }
  };

  const handleAiTriage = async () => {
    setTriageLoading(true);
    setShowTriagePanel(true);
    try {
      const suggestions = await apiFetchTriageSuggestions(userId);
      setTriageSuggestions(suggestions);
    } catch (err: unknown) {
      console.error('[Triage Error]', err);
      notify('AI Triage nie powiodło się', 'error');
      setShowTriagePanel(false);
    } finally {
      setTriageLoading(false);
    }
  };

  const applyTriageSuggestion = async (id: string, action: string, category: string, takeaways: string[]) => {
    try {
      const link = links.find(l => l.id === id);
      if (!link) return;

      if (action === 'archive') {
        await apiUpdateLinkTriage(supabase, id, { status: 'read' });
        queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
          (prev ?? []).filter(l => l.id !== id)
        );
        notify('Oznaczono jako przeczytany', 'success');
      } else if (action === 'todo') {
        await convertLinkToTodoItem(userId, link);
        queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
          (prev ?? []).filter(l => l.id !== id)
        );
        notify('Dodano do zadań', 'success');
      } else {
        await apiUpdateLinkTriage(supabase, id, { category, takeaways });
        queryClient.setQueryData<SavedLink[]>(linksKeys.list(userId), (prev) =>
          (prev ?? []).map(l => l.id === id ? { ...l, category, takeaways } : l)
        );
        notify('Zaktualizowano dane linku', 'success');
      }
      setTriageSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (err: unknown) {
      notify(`Błąd: ${(err as Error).message}`, 'error');
    }
  };

  const filteredLinks = useMemo(() => links.filter(link => {
    const matchesStatus = statusFilter === 'all' || link.status === statusFilter;
    const matchesCategory = !categoryFilter || link.category === categoryFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      (link.title || '').toLowerCase().includes(q) ||
      (link.description || '').toLowerCase().includes(q) ||
      (link.domain || '').toLowerCase().includes(q) ||
      (link.category || '').toLowerCase().includes(q);
    return matchesStatus && matchesCategory && matchesSearch;
  }), [links, statusFilter, categoryFilter, search]);

  const unreadCount = useMemo(() => links.filter(l => l.status === 'unread').length, [links]);

  return {
    links,
    loading,
    filteredLinks,
    unreadCount,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    search, setSearch,
    viewMode, setViewMode,
    expandedLinkId, setExpandedLinkId,
    sharingStatus,
    addUrl, setAddUrl,
    showAddForm, setShowAddForm,
    addLoading, handleAddLink,
    notesDrafts, setNotesDrafts,
    savedNoteId, saveNotes,
    deletingIds, deleteLink,
    bouncingIds,
    toggleReadStatus,
    convertingLinkId,
    handleLinkToTodo, handleLinkToNote,
    updateLinkCategory,
    triageLoading, triageSuggestions, setTriageSuggestions,
    showTriagePanel, setShowTriagePanel,
    handleAiTriage, applyTriageSuggestion,
  };
}
