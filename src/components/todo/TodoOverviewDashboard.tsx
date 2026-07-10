import TodoTodayZone from './TodoTodayZone';
import TodoInboxZone from './TodoInboxZone';
import TodoSectionsList from './TodoSectionsList';

interface TodoOverviewDashboardProps {
  renderInlineQuickCapture: (sectionId: string) => React.ReactNode;
  renderAddTodoButton: (sectionId: string) => React.ReactNode;
}

export default function TodoOverviewDashboard({ renderInlineQuickCapture, renderAddTodoButton }: TodoOverviewDashboardProps) {
  return (
    <>
      <TodoTodayZone renderInlineQuickCapture={renderInlineQuickCapture} renderAddTodoButton={renderAddTodoButton} />
      <TodoInboxZone renderInlineQuickCapture={renderInlineQuickCapture} renderAddTodoButton={renderAddTodoButton} />
      <TodoSectionsList renderInlineQuickCapture={renderInlineQuickCapture} renderAddTodoButton={renderAddTodoButton} />
    </>
  );
}
