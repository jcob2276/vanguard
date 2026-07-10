import { Fragment } from 'react';
import { useTodoContext } from './context/TodoContext';
import TodoCardConnected from './TodoCardConnected';
import EmptyState from './EmptyState';
import TodoSectionFlatView from './TodoSectionFlatView';
import type { TodoNavDest } from './TodoSidebar';
import { formatUpcomingDateHeader } from './todoUtils';

interface TodoSmartListViewProps {
  navDest: TodoNavDest;
  renderInlineQuickCapture: (sectionId: string) => React.ReactNode;
  renderAddTodoButton: (sectionId: string) => React.ReactNode;
}

export default function TodoSmartListView({ navDest, renderInlineQuickCapture, renderAddTodoButton }: TodoSmartListViewProps) {
  const { todayItems, inboxItems, upcomingItems, activeFilterSection } = useTodoContext();

  if (navDest === 'today') {
    return (
      <div>
        <div className="flex items-center gap-2 px-1 pt-6 pb-4">
          <span className="text-[20px] leading-none">📅</span>
          <span className="text-[24px] font-extrabold text-text-primary tracking-tight">Dziś</span>
          <span className="text-[13px] font-medium text-text-muted/50 ml-1">{todayItems.length}</span>
        </div>
        <div className="pt-1">
          {todayItems.length === 0 ? (
            <EmptyState icon="📅" label="Brak zadań na dziś." />
          ) : (
            todayItems.map((i) => <TodoCardConnected key={i.id} item={i} inToday />)
          )}
          {renderInlineQuickCapture('today')}
          {renderAddTodoButton('today')}
        </div>
      </div>
    );
  }

  if (navDest === 'inbox') {
    return (
      <div>
        <div className="flex items-center gap-2 px-1 pt-6 pb-4">
          <span className="text-[20px] leading-none">📥</span>
          <span className="text-[24px] font-extrabold text-text-primary tracking-tight">Skrzynka</span>
          <span className="text-[13px] font-medium text-text-muted/50 ml-1">{inboxItems.length}</span>
        </div>
        <div className="pt-1">
          {inboxItems.length === 0 ? (
            <EmptyState icon="📥" label="Skrzynka pusta." />
          ) : (
            inboxItems.map((i) => <TodoCardConnected key={i.id} item={i} />)
          )}
          {renderInlineQuickCapture('inbox')}
          {renderAddTodoButton('inbox')}
        </div>
      </div>
    );
  }

  if (navDest === 'upcoming') {
    let lastDate: string | null = null;
    return (
      <div>
        <div className="flex items-center gap-2 px-1 pt-6 pb-4">
          <span className="text-[20px] leading-none">🗓️</span>
          <span className="text-[24px] font-extrabold text-text-primary tracking-tight">Nadchodzące</span>
          <span className="text-[13px] font-medium text-text-muted/50 ml-1">{upcomingItems.length}</span>
        </div>
        <div className="pt-1">
          {upcomingItems.length === 0 ? (
            <EmptyState icon="🗓️" label="Brak zadań w najbliższych 7 dniach." />
          ) : (
            upcomingItems.map((i) => {
              const showDateHeader = i.due_date !== lastDate;
              lastDate = i.due_date;
              return (
                <Fragment key={i.id}>
                  {showDateHeader && i.due_date && (
                    <div className="px-3 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-text-muted/50">
                      {formatUpcomingDateHeader(i.due_date)}
                    </div>
                  )}
                  <TodoCardConnected item={i} />
                </Fragment>
              );
            })
          )}
          {renderInlineQuickCapture('upcoming')}
          {renderAddTodoButton('upcoming')}
        </div>
      </div>
    );
  }

  if (activeFilterSection) {
    return (
      <TodoSectionFlatView
        sectionId={activeFilterSection}
        renderInlineQuickCapture={renderInlineQuickCapture}
        renderAddTodoButton={renderAddTodoButton}
      />
    );
  }

  return null;
}
