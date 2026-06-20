import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface SectionTabsProps {
  sections: any[];
  active: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function SectionTabs({
  sections,
  active,
  onSelect,
  onAdd,
  onRename,
  onDelete
}: SectionTabsProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const commitAdd = () => {
    const n = newName.trim();
    if (n) onAdd(n);
    setNewName('');
    setAdding(false);
  };

  const commitRename = (id: string) => {
    const n = renameVal.trim();
    if (n) onRename(id, n);
    setRenamingId(null);
  };

  return (
    <div className="overflow-x-auto border-b border-border-custom/15">
      <div className="flex min-w-max items-stretch px-5">
        {/* "Wszystkie" tab */}
        <button
          onClick={() => onSelect(null)}
          className={`border-b-2 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-all ${
            active === null
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Wszystkie
        </button>

        {/* Section tabs */}
        {sections.map(s => (
          <div key={s.id} className="relative flex items-stretch">
            {renamingId === s.id ? (
              <input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(s.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="border-b-2 border-primary bg-transparent py-2.5 text-[12px] font-semibold text-primary outline-none w-[110px] px-3"
              />
            ) : (
              <button
                onClick={() => {
                  if (active === s.id) {
                    setRenamingId(s.id);
                    setRenameVal(s.name);
                  } else {
                    onSelect(s.id);
                  }
                }}
                className={`border-b-2 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap transition-all ${
                  active === s.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                {s.name}
              </button>
            )}

            {/* Delete — always visible on active tab */}
            {active === s.id && renamingId !== s.id && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                className="self-center pr-1 text-text-muted/25 hover:text-rose-400 active:text-rose-400 transition-colors"
                title="Usuń sekcję"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        {/* Add section */}
        {adding ? (
          <div className="flex items-stretch">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={e => {
                if (e.key === 'Enter') commitAdd();
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewName('');
                }
              }}
              placeholder="Nazwa listy..."
              className="border-b-2 border-primary bg-transparent py-2.5 px-3 text-[12px] font-semibold text-primary outline-none placeholder:text-primary/40 w-[120px]"
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="border-b-2 border-transparent px-3 py-2.5 text-[12px] font-medium text-text-muted/40 hover:text-text-primary transition-colors whitespace-nowrap"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
