import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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

export function useLinksInboxData(session: Session, haptic: (pattern: number | number[]) => void) {
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [sharingStatus, setSharingStatus] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = usePersistentDraft<Record<string, string>>(`vanguard_link_notes_drafts_${session.user.id}`, {});
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [addUrl, setAddUrl] = usePersistentDraft(`vanguard_link_add_url_draft_${session.user.id}`, '');
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

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchLinks(supabase, session.user.id);
      setLinks(data);
    } catch (err: unknown) {
      console.error('[LinksInbox] fetchLinks failed:', err);
      notify('Nie udało się załadować linków.', 'error');
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  const saveSharedLink = useCallback(async (actualUrl: string) => {
    setLoading(true);
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
      fetchLinks();
    }
  }, [fetchLinks]);

  const handleAddLink = async () => {
    const raw = addUrl.trim();
    const urlMatch = raw.match(/https?:\/\/[^\s]+/);
    if (!urlMatch) return;
    setAddLoading(true);
    try {
      await apiAddNewLink(urlMatch[0]);
      setAddUrl('');
      setShowAddForm(false);
      await fetchLinks();
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
      void (async () => { await saveSharedLink(match[0]); })();
    } else {
      void (async () => { await fetchLinks(); })();
    }
  }, [fetchLinks, saveSharedLink]);

  const toggleReadStatus = async (id: string, current: 'unread' | 'read') => {
    haptic(current === 'unread' ? [8, 20, 8] : [5]);
    const next = current === 'unread' ? 'read' : 'unread';
    setBouncingIds(prev => new Set([...prev, id]));
    setTimeout(() => setBouncingIds(prev => { const n = new Set(prev); n.delete(id); return n; }), 400);
    setLinks(prev => prev.map(l => l.id === id ? { ...l, status: next } : l));
    try {
      await apiUpdateLinkTriage(supabase, id, { status: next });
    } catch (err) {
      console.error('[LinksInbox] toggleReadStatus failed:', err);
      fetchLinks();
    }
  };

  const saveNotes = async (id: string) => {
    const draft = notesDrafts[id];
    if (draft === undefined) return;
    const link = links.find(l => l.id === id);
    if (!link || draft === (link.notes ?? '')) return;
    try {
      await apiUpdateLinkNotes(supabase, id, draft);
      setLinks(prev => prev.map(l => l.id === id ? { ...l, notes: draft } : l));
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
      setLinks(prev => prev.filter(l => l.id !== id));
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
      setLinks(prev => prev.map(l => l.id === id ? { ...l, category: newCategory } : l));
    } catch (err: unknown) {
      console.error('[Action Error]', err);
      notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
    }
  };

  const handleLinkToTodo = async (link: SavedLink) => {
    setConvertingLinkId(link.id);
    try {
      await convertLinkToTodoItem(session.user.id, link);
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: 'read' as const } : l));
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
      await convertLinkToKeepNote(session.user.id, link);
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: 'read' as const } : l));
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
      const suggestions = await apiFetchTriageSuggestions(session.user.id);
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
        setLinks(prev => prev.filter(l => l.id !== id));
        notify('Oznaczono jako przeczytany', 'success');
      } else if (action === 'todo') {
        await convertLinkToTodoItem(session.user.id, link);
        setLinks(prev => prev.filter(l => l.id !== id));
        notify('Dodano do zadań', 'success');
      } else {
        await apiUpdateLinkTriage(supabase, id, { category, takeaways });
        setLinks(prev => prev.map(l => l.id === id ? { ...l, category, takeaways } : l));
        notify('Zaktualizowano dane linku', 'success');
      }
      setTriageSuggestions(prev => prev.filter(s => s.id !== id));
    } catch (err: unknown) {
      notify(`Błąd: ${(err as Error).message}`, 'error');
    }
  };

  const filteredLinks = links.filter(link => {
    const matchesStatus = statusFilter === 'all' || link.status === statusFilter;
    const matchesCategory = !categoryFilter || link.category === categoryFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      (link.title || '').toLowerCase().includes(q) ||
      (link.description || '').toLowerCase().includes(q) ||
      (link.domain || '').toLowerCase().includes(q) ||
      (link.category || '').toLowerCase().includes(q);
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const unreadCount = links.filter(l => l.status === 'unread').length;

  return {
    // Data
    links,
    loading,
    filteredLinks,
    unreadCount,
    // Filters
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    viewMode,
    setViewMode,
    // Expanded state
    expandedLinkId,
    setExpandedLinkId,
    // Sharing
    sharingStatus,
    // Add form
    addUrl,
    setAddUrl,
    showAddForm,
    setShowAddForm,
    addLoading,
    handleAddLink,
    // Notes
    notesDrafts,
    setNotesDrafts,
    savedNoteId,
    saveNotes,
    // Delete
    deletingIds,
    deleteLink,
    // Bounce animation
    bouncingIds,
    // Read toggle
    toggleReadStatus,
    // Convert
    convertingLinkId,
    handleLinkToTodo,
    handleLinkToNote,
    updateLinkCategory,
    // Triage
    triageLoading,
    triageSuggestions,
    setTriageSuggestions,
    showTriagePanel,
    setShowTriagePanel,
    handleAiTriage,
    applyTriageSuggestion,
  };
}
