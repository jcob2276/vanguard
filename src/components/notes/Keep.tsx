import { BookOpen, Calendar, CheckSquare, ListTodo, Plus } from 'lucide-react';
import Spinner from '../ui/Spinner';
import EditNoteModal from './EditNoteModal';
import KeepHeader from './KeepHeader';
import KeepSidebar from './KeepSidebar';
import KeepNotesList from './KeepNotesList';
import { useUserId } from '../../store/useStore';
import { useNotesData } from './hooks/useNotesData';
import { useKeepView } from './hooks/useKeepView';
import './notes.css';

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
    <div className="keep-root">
      <KeepHeader
        onBack={goBack}
        search={search}
        setSearch={setSearch}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="keep-body">
        <KeepSidebar
          notes={notes}
          allTags={allTags}
          sidebarTab={sidebarTab}
          setSidebarTab={setSidebarTab}
          activeTag={activeTag}
          setActiveTag={setActiveTag}
          setSearch={setSearch}
          goTo={goTo}
          onPromptCreateTag={handlePromptCreateTag}
          onConfirmDeleteTag={handleConfirmDeleteTag}
        />

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
      </div>

      {/* iOS Notes-style FAB */}
      <button
        className="keep-fab"
        onClick={handleNewNote}
        disabled={busy}
        title="Nowa notatka"
        type="button"
      >
        {busy ? <Spinner size="sm" className="h-5 w-5 !border-white/30 !border-t-white" /> : <Plus size={24} strokeWidth={2} />}
      </button>

      {/* Page-level Edit Modal */}
      {editingId && (
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
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-border-custom bg-background/95 backdrop-blur-xl">
        <button className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-primary">
          <CheckSquare size={22} />
          <span className="text-[11px] font-semibold">Notatki</span>
        </button>
        <button onClick={() => goTo('todo')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <ListTodo size={22} />
          <span className="text-[11px] font-semibold">Zadania</span>
        </button>
        <button onClick={() => goTo('kalendarz')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <Calendar size={22} />
          <span className="text-[11px] font-semibold">Kalendarz</span>
        </button>
        <button onClick={() => goTo('links')} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-text-muted active:bg-surface">
          <BookOpen size={22} />
          <span className="text-[11px] font-semibold">Pocket</span>
        </button>
      </nav>
    </div>
  );
}
