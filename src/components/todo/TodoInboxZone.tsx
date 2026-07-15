import { useTodoContext } from './context/TodoContext';
import BucketHeader from './BucketHeader';
import TodoCardConnected from './TodoCardConnected';
import EmptyState from './EmptyState';

interface TodoInboxZoneProps {
  renderInlineQuickCapture: (sectionId: string) => React.ReactNode;
  renderAddTodoButton: (sectionId: string) => React.ReactNode;
}

export default function TodoInboxZone({ renderInlineQuickCapture, renderAddTodoButton }: TodoInboxZoneProps) {
  const {
    inboxItems, draggingItem, dragTarget, inboxZoneRef,
    collapsedSections, toggleSectionCollapse,
  } = useTodoContext();

  if (inboxItems.length === 0 && draggingItem === null) return null;

  return (
    <div
      ref={inboxZoneRef}
      className={`rounded-2xl p-2 transition-all duration-[var(--motion-medium)] ${
        draggingItem !== null
          ? dragTarget === 'inbox'
            ? 'border border-primary/40 bg-primary/10 scale-[var(--ds-arbitrary-1-01)] shadow-[var(--shadow-accent-active)]'
            : 'border border-dashed border-primary/20 bg-primary/5'
          : 'border border-transparent bg-transparent'
      }`}
    >
      <BucketHeader
        icon="📥"
        title="Skrzynka / Inbox"
        count={inboxItems.length}
        collapsed={!!collapsedSections['inbox']}
        onToggle={() => toggleSectionCollapse('inbox')}
        isDropTarget={dragTarget === 'inbox'}
      />
      {!collapsedSections['inbox'] && (
        <div className="pt-1">
          {inboxItems.length === 0 ? (
            <EmptyState
              icon="📥"
              label="Upuść tutaj, aby przenieść do skrzynki"
              isDragOver={dragTarget === 'inbox'}
              dragColor="primary"
            />
          ) : (
            inboxItems.map((i) => <TodoCardConnected key={i.id} item={i} />)
          )}
          {renderInlineQuickCapture('inbox')}
          {renderAddTodoButton('inbox')}
        </div>
      )}
    </div>
  );
}
