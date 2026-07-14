import { useTodoContext } from './context/TodoContext';
import DataStateNotice from '../core/DataStateNotice';
import TodoBatchClassifyChip from './TodoBatchClassifyChip';
import TodoOverviewDashboard from './TodoOverviewDashboard';
import TodoSmartListView from './TodoSmartListView';
import TodoDoneHistory from './TodoDoneHistory';
import type { TodoNavDest } from './TodoSidebar';

interface TodoListViewProps {
  navDest: TodoNavDest;
  renderInlineQuickCapture: (sectionId: string) => React.ReactNode;
  renderAddTodoButton: (sectionId: string) => React.ReactNode;
}

export default function TodoListView({ navDest, renderInlineQuickCapture, renderAddTodoButton }: TodoListViewProps) {
  const { error, setExpandedId, activeFilterSection } = useTodoContext();
  const isSmartView = navDest === 'today' || navDest === 'inbox' || navDest === 'upcoming' || !!activeFilterSection;

  return (
    <main className="flex-1 overflow-y-auto" onClick={() => setExpandedId(null)}>
      <div className="mx-auto max-w-[var(--content-default)] space-y-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)] pb-24 lg:px-[var(--space-10)]">
        {error && <DataStateNotice tone="warning" title="Błąd" detail={error} />}

        <TodoBatchClassifyChip />

        <div className="space-y-8">
          {isSmartView ? (
            <TodoSmartListView
              navDest={navDest}
              renderInlineQuickCapture={renderInlineQuickCapture}
              renderAddTodoButton={renderAddTodoButton}
            />
          ) : (
            <TodoOverviewDashboard
              renderInlineQuickCapture={renderInlineQuickCapture}
              renderAddTodoButton={renderAddTodoButton}
            />
          )}

          <TodoDoneHistory />
        </div>
      </div>
    </main>
  );
}
