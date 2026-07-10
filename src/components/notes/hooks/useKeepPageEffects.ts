import { useEffect, useRef } from 'react';

interface UseKeepPageEffectsProps {
  search: string;
  activeTag: string | null;
  sidebarTab: 'notes' | 'archive';
  viewMode: 'grid' | 'list';
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  setVisibleCount: (fn: (prev: number) => number) => void;
  setColumns: (cols: number) => void;
  handleNewNote: () => Promise<string | null | undefined>;
  handleCreate: (note: { title: string; content: string }) => void;
}

export function useKeepPageEffects({
  search, activeTag, sidebarTab, viewMode, editingId, setEditingId,
  setVisibleCount, setColumns, handleNewNote, handleCreate,
}: UseKeepPageEffectsProps) {
  const autoNewNote = new URLSearchParams(window.location.search).get('new') === '1'
    || localStorage.getItem('vanguard_keep_new') === '1';

  useEffect(() => {
    if (localStorage.getItem('vanguard_keep_new') === '1') {
      try { localStorage.removeItem('vanguard_keep_new'); } catch { /* storage unavailable — ignored */ }
    }
  }, []);

  useEffect(() => {
    void (async () => { setVisibleCount(() => 30); })();
  }, [search, activeTag, sidebarTab, setVisibleCount]);

  // Responsive columns
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 640) {
        setColumns(viewMode === 'grid' ? 2 : 1);
      } else if (w < 900) {
        setColumns(2);
      } else if (w < 1300) {
        setColumns(3);
      } else {
        setColumns(4);
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [viewMode, setColumns]);

  // Auto-open new note when navigated with ?new=1 (Telegram shortcut)
  const autoNewNoteHandled = useRef(false);
  useEffect(() => {
    if (autoNewNote && !autoNewNoteHandled.current) {
      autoNewNoteHandled.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      try { localStorage.removeItem('vanguard_keep_new'); } catch {}
      void handleNewNote().then(id => {
        if (id) setEditingId(id);
      });
    }
  }, [autoNewNote, handleNewNote, setEditingId]);

  // Capture shared text/title with no URL
  const autoShareCaptureHandled = useRef(false);
  useEffect(() => {
    if (autoShareCaptureHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const text = params.get('share_text') || '';
    const title = params.get('share_title') || '';
    if (!text && !title) return;
    autoShareCaptureHandled.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    window.setTimeout(() => {
      handleCreate({
        title: title || text.slice(0, 60) || 'Udostępnione',
        content: text ? `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '',
      });
    }, 0);
  }, [handleCreate]);

  // Ctrl+N and Ctrl+F keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) || e.key === '/') {
        const active = document.activeElement as HTMLElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        e.preventDefault();
        const searchInput = document.querySelector('.keep-search') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !editingId) {
        e.preventDefault();
        void handleNewNote().then(id => {
          if (id) setEditingId(id);
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingId, handleNewNote, setEditingId]);
}
