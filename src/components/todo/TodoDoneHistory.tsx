import { useState } from 'react';
import { useTodoContext } from './context/TodoContext';
import BucketHeader from './BucketHeader';
import TodoCardConnected from './TodoCardConnected';

export default function TodoDoneHistory() {
  const { showDone, setShowDone, doneItems } = useTodoContext();
  const [visibleDoneCount, setVisibleDoneCount] = useState(30);

  if (!showDone || doneItems.length === 0) return null;

  return (
    <div className="border-t border-border-custom/20 pt-2">
      <BucketHeader
        icon="✅"
        title="Historia"
        count={doneItems.length}
        collapsed={false}
        onToggle={() => setShowDone(false)}
        isDropTarget={false}
      />
      <div className="pt-1 space-y-1">
        {doneItems.slice(0, visibleDoneCount).map((i) => (
          <TodoCardConnected key={i.id} item={i} />
        ))}
      </div>
      {doneItems.length > visibleDoneCount && (
        <div className="flex justify-center mt-3 mb-2">
          <button
            type="button"
            onClick={() => setVisibleDoneCount(prev => prev + 30)}
            className="px-4 py-2 rounded-xl border border-border-custom bg-surface hover:bg-surface-solid text-xs font-bold uppercase tracking-wider text-text-secondary transition-all active:scale-95 cursor-pointer flex items-center justify-center"
          >
            Pokaż więcej ukończonych ({doneItems.length - visibleDoneCount} pozostało)
          </button>
        </div>
      )}
    </div>
  );
}
