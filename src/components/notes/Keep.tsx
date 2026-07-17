import EditNoteModal from './EditNoteModal';
import KeepHeader from './KeepHeader';
import KeepSidebar from './KeepSidebar';
import KeepNotesList from './KeepNotesList';
import SplitNotesView from './SplitNotesView';
import { useUserId } from '../../store/useStore';
import { useNotesData } from './hooks/useNotesData';
import { useKeepView } from './hooks/useKeepView';
import './notes.css';
import WorkspaceNavigation from '../shared/WorkspaceNavigation';

export default function Keep({ onBack, onNavigateTo }: { onBack?: () => void; onNavigateTo?: (dest: string) => void }) {
  const userId = useUserId();

  const {
    notes, setNotes, loading, error, setError, busy, setBusy,
    handleCreate, handleUpdate, handleDelete, handleTogglePin, handleNewNote,
    handleDeleteTag, handleCreateTag, handleReorder,
  } = useNotesData(userId!);

  const {
    search, setSearch,
    activeTag, setActiveTag,
    sidebarTab, setSidebarTab,
    viewMode, setViewMode,
    editingId, setEditingId,
    visibleCount, setVisibleCount,
    goTo, goBack,
    handleCloseCard,
    allTags,
    handleConfirmDeleteTag,
    handlePromptCreateTag,
    filtered, pinned, others, visibleOthers,
    handleExportChecklists,
    sharedGridProps,
  } = useKeepView({
    userId: userId!, notes, setNotes, busy, setBusy,
    handleCreate, handleUpdate, handleDelete, handleTogglePin, handleReorder,
    handleNewNote, handleDeleteTag, handleCreateTag,
    onBack, onNavigateTo,
  });

  if (!userId) return null;

  return (
    <div className={`keep-root ${viewMode === 'split' && editingId ? 'keep-mobile-note-open' : ''}`}>
      <KeepSidebar
          notes={notes}
          allTags={allTags}
          sidebarTab={sidebarTab}
          setSidebarTab={(tab) => { setSidebarTab(tab); setEditingId(null); }}
          activeTag={activeTag}
          setActiveTag={(fn) => { setActiveTag(fn); setEditingId(null); }}
          setSearch={setSearch}
          goTo={goTo}
          onPromptCreateTag={handlePromptCreateTag}
          onConfirmDeleteTag={handleConfirmDeleteTag}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="keep-browser-header"><KeepHeader
          onBack={goBack}
          search={search}
          setSearch={setSearch}
          viewMode={viewMode}
          setViewMode={(mode) => { setViewMode(mode); setEditingId(null); }}
        /></div>
        {viewMode === 'split' ? (
          <SplitNotesView
            notes={notes}
            filtered={filtered}
            pinned={pinned}
            others={others}
            activeNoteId={editingId}
            onSelectNote={setEditingId}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onTogglePin={handleTogglePin}
            busy={busy}
            allTags={allTags}
            onCreate={handleCreate}
            search={search}
            activeTag={activeTag}
            onExportChecklists={handleExportChecklists}
          />
        ) : (
          <KeepNotesList
            error={error}
            onClearError={() => setError(null)}
            sidebarTab={sidebarTab}
            onCreate={handleCreate}
            busy={busy}
            allTags={allTags}
            loading={loading}
            filtered={filtered}
            search={search}
            activeTag={activeTag}
            pinned={pinned}
            others={others}
            visibleOthers={visibleOthers}
            visibleCount={visibleCount}
            setVisibleCount={setVisibleCount}
            viewMode={viewMode}
            sharedGridProps={sharedGridProps}
          />
        )}
      </div>

      {/* Page-level Edit Modal */}
      {editingId && viewMode !== 'split' && (
        (() => {
          const noteToEdit = notes.find(n => n.id === editingId);
          return noteToEdit ? (
            <EditNoteModal
              note={noteToEdit}
              onClose={handleCloseCard}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              busy={busy}
              allTags={allTags}
              allNotes={notes}
              onExportChecklists={handleExportChecklists}
              onNavigateToNote={(id) => { setEditingId(id); }}
            />
          ) : null;
        })()
      )}

      {/* Mobile bottom nav */}
      <WorkspaceNavigation
        active="keep"
        orientation="horizontal"
        onNavigate={goTo}
        className="keep-mobile-navigation md:hidden fixed bottom-0 inset-x-0 z-[var(--z-overlay)] border-t border-border-custom bg-background/95 backdrop-blur-[var(--blur-xl)]"
      />
    </div>
  );
}
