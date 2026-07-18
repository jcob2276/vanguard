import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { Bookmark, Search, X } from 'lucide-react';
import { confirmDialog } from '../../lib/notify';
import { useTodoContext } from './context/TodoContext';

export default function TodoSearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    activeSmartListId,
    setActiveSmartListId,
    smartLists,
    saveCurrentAsSmartList,
    removeSmartList,
  } = useTodoContext();
  const [showSaveSmartList, setShowSaveSmartList] = useState(false);
  const [newSmartListName, setNewSmartListName] = useState('');

  const saveSmartList = () => {
    if (!newSmartListName.trim()) return;
    saveCurrentAsSmartList(newSmartListName);
    setNewSmartListName('');
    setShowSaveSmartList(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1 pt-3">
      <div className="flex min-h-10 min-w-64 flex-1 items-center gap-2 rounded-xl border border-border-custom/70 bg-surface-solid/50 px-3 focus-within:border-primary/40">
        <Search size={14} className="shrink-0 text-text-muted" />
        <ControlInput
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setActiveSmartListId(null);
          }}
          placeholder="Szukaj lub filtruj, np. due:week duration:short"
          aria-label="Szukaj i filtruj zadania"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted/50"
        />
        {searchQuery && (
          <Pressable onClick={() => setSearchQuery('')} aria-label="Wyczyść wyszukiwanie" className="text-text-muted hover:text-text-primary">
            <X size={13} />
          </Pressable>
        )}
      </div>
      {smartLists.map((smartList) => (
        <Pressable
          key={smartList.id}
          onClick={() => { setSearchQuery(''); setActiveSmartListId((current) => current === smartList.id ? null : smartList.id); }}
          onContextMenu={(event) => {
            event.preventDefault();
            void confirmDialog(`Czy na pewno chcesz usunąć Smart Listę "${smartList.name}"?`).then((ok) => {
              if (ok) removeSmartList(smartList.id);
            });
          }}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-all ${
            activeSmartListId === smartList.id
              ? 'border-primary/30 bg-primary/15 text-primary'
              : 'border-border-custom/50 text-text-muted hover:bg-surface-solid/40 hover:text-text-primary'
          }`}
          title="Kliknij prawym, aby usunąć"
        >
          <span>{smartList.icon}</span>
          {smartList.name}
        </Pressable>
      ))}
      {searchQuery.trim() && !activeSmartListId && (
        showSaveSmartList ? (
          <div className="flex items-center gap-1">
            <ControlInput
              autoFocus
              value={newSmartListName}
              onChange={(event) => setNewSmartListName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveSmartList();
                if (event.key === 'Escape') setShowSaveSmartList(false);
              }}
              placeholder="Nazwa Smart Listy…"
              className="w-32 rounded-full border border-primary/30 bg-surface-solid/60 px-2.5 py-1 text-xs font-semibold text-text-primary outline-none"
            />
            <Pressable onClick={saveSmartList} className="px-1.5 text-xs font-black text-primary">Zapisz</Pressable>
          </div>
        ) : (
          <Pressable
            onClick={() => setShowSaveSmartList(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-border-custom/60 px-2.5 py-1 text-xs font-bold text-text-muted transition-all hover:border-primary/40 hover:text-primary"
          >
            <Bookmark size={10} /> Zapisz jako Smart Listę
          </Pressable>
        )
      )}
    </div>
  );
}
