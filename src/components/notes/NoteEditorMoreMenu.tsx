import { useState } from 'react';
import { Archive, Download, ListTodo, Lock, MoreHorizontal, Pin, Sparkles, Trash2 } from 'lucide-react';
import { Pressable } from '../ui/ControlPrimitives';
import { COLORS } from './keepUtils';

interface Props {
  pinned: boolean;
  color: string;
  onPin: () => void;
  onArchive: () => void;
  onExport?: () => void;
  onLock?: () => void;
  onDelete: () => void;
  onSummarize: () => void;
  onExtractTasks: () => void;
  onColor: (color: string) => void;
}

export default function NoteEditorMoreMenu(props: Props) {
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="relative">
      <Pressable variant="ghost" size="sm" onClick={() => setOpen(value => !value)} aria-label="Więcej czynności">
        <MoreHorizontal size={18} />
      </Pressable>
      {open && (
        <>
          <Pressable className="ios-popover-dismiss-layer" onClick={() => setOpen(false)} aria-label="Zamknij menu" />
          <div className="ios-anchored-popover absolute right-0 top-9 z-[var(--z-overlay)] w-56 overflow-hidden rounded-xl border border-border-custom bg-surface-solid p-1 shadow-xl">
            <MenuItem icon={<Pin size={14} />} label={props.pinned ? 'Odepnij' : 'Przypnij'} onClick={() => run(props.onPin)} />
            <MenuItem icon={<Archive size={14} />} label="Archiwizuj" onClick={() => run(props.onArchive)} />
            <MenuItem icon={<Sparkles size={14} />} label="Podsumuj przez AI" onClick={() => run(props.onSummarize)} />
            <MenuItem icon={<ListTodo size={14} />} label="Wyciągnij zadania" onClick={() => run(props.onExtractTasks)} />
            {props.onExport && <MenuItem icon={<Download size={14} />} label="Eksportuj" onClick={() => run(props.onExport!)} />}
            {props.onLock && <MenuItem icon={<Lock size={14} />} label="Zablokuj" onClick={() => run(props.onLock!)} />}
            <div className="flex gap-1 border-y border-border-custom/20 p-2">
              {COLORS.map(color => (
                <Pressable
                  key={color.id}
                  className={`h-6 w-6 rounded-full border ${props.color === color.id ? 'ring-2 ring-primary' : ''}`}
                  style={{ backgroundColor: color.dot }}
                  onClick={() => run(() => props.onColor(color.id))}
                  title={color.label}
                />
              ))}
            </div>
            <MenuItem danger icon={<Trash2 size={14} />} label="Przenieś do Kosza" onClick={() => run(props.onDelete)} />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      variant="ghost"
      className={`flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-xs ${danger ? 'text-danger' : ''}`}
      onClick={onClick}
    >
      {icon}{label}
    </Pressable>
  );
}
