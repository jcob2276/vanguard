import { useTodoContext } from './context/TodoContext';
import BucketHeader from './BucketHeader';
import TodoCardConnected from './TodoCardConnected';
import EmptyState from './EmptyState';

interface TodoTodayZoneProps {
  renderInlineQuickCapture: (sectionId: string) => React.ReactNode;
  renderAddTodoButton: (sectionId: string) => React.ReactNode;
}

export default function TodoTodayZone({ renderInlineQuickCapture, renderAddTodoButton }: TodoTodayZoneProps) {
  const {
    todayItems, draggingItem, dragTarget, todayZoneRef,
    collapsedSections, toggleSectionCollapse, toggleExpand,
  } = useTodoContext();

  if (todayItems.length === 0 && draggingItem === null) return null;

  const totalMin = todayItems.reduce((s, i) => s + (i.duration_minutes || 0), 0);
  const capMin = 480;
  const pct = Math.min(100, Math.round((totalMin / capMin) * 100));
  const over = totalMin > capMin;
  const label = totalMin >= 60
    ? `${Math.floor(totalMin / 60)}h${totalMin % 60 > 0 ? ` ${totalMin % 60}m` : ''}`
    : `${totalMin}m`;

  const pending = todayItems.filter((i) => i.status !== 'done' && i.status !== 'dropped');
  const focus = pending.length >= 2 ? pending[0] : null;
  const [focusEmoji] = focus ? (focus.title.match(/^\p{Emoji}/u) ?? ['']) : [''];
  const focusLabel = focus ? (focusEmoji ? focus.title.slice([...focusEmoji].length).trim() : focus.title) : '';

  return (
    <div
      ref={todayZoneRef}
      className={`rounded-2xl p-2 transition-all duration-200 ${
        draggingItem !== null
          ? dragTarget === 'today'
            ? 'border border-warning/40 bg-warning/10 scale-[1.01] shadow-[var(--shadow-accent-active)]'
            : 'border border-dashed border-warning/20 bg-warning/5'
          : 'border border-transparent bg-transparent'
      }`}
    >
      <BucketHeader
        icon="🔥"
        title="Na dziś / Aktywne"
        count={todayItems.length}
        collapsed={!!collapsedSections['today']}
        onToggle={() => toggleSectionCollapse('today')}
        isDropTarget={dragTarget === 'today'}
      />
      {totalMin > 0 && (
        <div className="mb-2 -mt-1 px-0.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted/40">Zaplanowane</span>
            <span className={`text-2xs font-bold tabular-nums ${over ? 'text-danger' : 'text-text-muted/50'}`}>{label} / 8h</span>
          </div>
          <div className="h-[3px] rounded-full bg-surface-solid overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-danger/70' : 'bg-warning/60'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      {!collapsedSections['today'] && (
        <div className="pt-1">
          {todayItems.length === 0 ? (
            <EmptyState
              icon="🔥"
              label="Upuść tutaj, aby zaplanować na dziś"
              isDragOver={dragTarget === 'today'}
              dragColor="orange"
            />
          ) : (
            <>
              {focus && (
                <button
                  onClick={() => toggleExpand(focus.id)}
                  className="w-full mb-2 flex items-center gap-2.5 rounded-xl border border-warning/20 bg-warning/6 px-3 py-2.5 text-left hover:bg-warning/10 transition-all btn-press"
                >
                  <span className="text-lg leading-none shrink-0">{focusEmoji || '🎯'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-black uppercase tracking-widest text-warning/70 mb-0.5">Co teraz?</p>
                    <p className="text-sm font-semibold text-text-primary leading-snug truncate">{focusLabel}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-warning/15 px-2 py-1 text-xs font-bold text-warning">Zacznij →</span>
                </button>
              )}
              {todayItems.map((i) => (
                <TodoCardConnected key={i.id} item={i} inToday />
              ))}
            </>
          )}
          {renderInlineQuickCapture('today')}
          {renderAddTodoButton('today')}
        </div>
      )}
    </div>
  );
}
