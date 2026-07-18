import { useTodoContext } from './context/TodoContext';
import BucketHeader from './BucketHeader';
import TodoCardConnected from './TodoCardConnected';
import EmptyState from './EmptyState';
import TodayRunway from './TodayRunway';
import DayCapacityBar from './DayCapacityBar';

interface TodoTodayZoneProps {
  renderInlineQuickCapture: (sectionId: string) => React.ReactNode;
  renderAddTodoButton: (sectionId: string) => React.ReactNode;
}

export default function TodoTodayZone({ renderInlineQuickCapture, renderAddTodoButton }: TodoTodayZoneProps) {
  const {
    todayItems, draggingItem, dragTarget, todayZoneRef,
    collapsedSections, toggleSectionCollapse, userId, today,
  } = useTodoContext();

  const totalMin = todayItems.reduce((s, i) => s + (i.duration_minutes || 0), 0);

  return (
    <div
      ref={todayZoneRef}
      className={`rounded-2xl p-2 transition-all duration-[var(--motion-medium)] ${
        draggingItem !== null
          ? dragTarget === 'today'
            ? 'border border-warning/40 bg-warning/10 scale-[var(--ds-arbitrary-1-01)] shadow-[var(--shadow-accent-active)]'
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
      <DayCapacityBar userId={userId} today={today} plannedMinutes={totalMin} />
      {!collapsedSections['today'] && (
        <div className="pt-1">
          <TodayRunway />
          {todayItems.length === 0 ? (
            <EmptyState
              icon="🔥"
              label="Upuść tutaj, aby zaplanować na dziś"
              isDragOver={dragTarget === 'today'}
              dragColor="orange"
            />
          ) : (
            <>
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
