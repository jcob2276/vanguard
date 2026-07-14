import { useState } from 'react';
import { Bookmark, Search, X } from 'lucide-react';
import { useTodoContext } from './context/TodoContext';
import { confirmDialog } from '../../lib/notify';

interface TodoSearchBarProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function TodoSearchBar({ searchInputRef }: TodoSearchBarProps) {
  const {
    searchQuery, setSearchQuery,
    activeSmartListId, setActiveSmartListId,
    smartLists, activeSmartQuery,
    saveCurrentAsSmartList, removeSmartList,
  } = useTodoContext();

  const [showSaveSmartList, setShowSaveSmartList] = useState(false);
  const [newSmartListName, setNewSmartListName] = useState('');

  return (
    <div className="px-4 pt-3 pb-1 space-y-2">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted/50 pointer-events-none" />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setActiveSmartListId(null); }}
          placeholder="Szukaj… tag:x priority:high due:week section:nazwa"
          className="w-full rounded-xl border border-border-custom/50 bg-surface-solid/40 pl-8 pr-8 py-2 text-sm font-medium text-text-primary outline-none placeholder:text-text-muted/35 focus:border-primary/30"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {(smartLists.length > 0 || activeSmartQuery) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {smartLists.map((sl) => (
            <button
              key={sl.id}
              onClick={() => { setSearchQuery(''); setActiveSmartListId(cur => cur === sl.id ? null : sl.id); }}
              onContextMenu={(e) => {
                e.preventDefault();
                void confirmDialog(`Czy na pewno chcesz usunąć Smart Listę "${sl.name}"?`).then((ok) => {
                  if (ok) {
                    removeSmartList(sl.id);
                  }
                });
              }}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-all ${
                activeSmartListId === sl.id
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'border-border-custom/50 text-text-muted hover:text-text-primary hover:bg-surface-solid/40'
              }`}
              title="Kliknij prawym, aby usunąć"
            >
              <span>{sl.icon}</span>
              {sl.name}
            </button>
          ))}
          {searchQuery.trim() && !activeSmartListId && (
            showSaveSmartList ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newSmartListName}
                  onChange={(e) => setNewSmartListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSmartListName.trim()) {
                      saveCurrentAsSmartList(newSmartListName);
                      setNewSmartListName('');
                      setShowSaveSmartList(false);
                    } else if (e.key === 'Escape') setShowSaveSmartList(false);
                  }}
                  placeholder="Nazwa Smart Listy…"
                  className="rounded-full border border-primary/30 bg-surface-solid/60 px-2.5 py-1 text-xs font-semibold text-text-primary outline-none w-32"
                />
                <button
                  onClick={() => {
                    if (newSmartListName.trim()) {
                      saveCurrentAsSmartList(newSmartListName);
                      setNewSmartListName('');
                      setShowSaveSmartList(false);
                    }
                  }}
                  className="text-primary text-xs font-black px-1.5"
                >
                  Zapisz
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveSmartList(true)}
                className="flex items-center gap-1 rounded-full border border-dashed border-border-custom/60 px-2.5 py-1 text-xs font-bold text-text-muted hover:text-primary hover:border-primary/40 transition-all"
              >
                <Bookmark size={10} /> Zapisz jako Smart Listę
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
