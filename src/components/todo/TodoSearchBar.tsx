import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { confirmDialog } from '../../lib/notify';
import { useTodoContext } from './context/TodoContext';

export default function TodoSearchBar() {
  const {
    searchQuery,
    setSearchQuery,
    activeSmartListId,
    setActiveSmartListId,
    smartLists,
    activeSmartQuery,
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

  if (smartLists.length === 0 && !activeSmartQuery) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-1 pt-3">
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
