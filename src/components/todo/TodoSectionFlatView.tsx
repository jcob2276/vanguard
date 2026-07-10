import { useTodoContext } from './context/TodoContext';
import TodoCardConnected from './TodoCardConnected';
import EmptyState from './EmptyState';

interface TodoSectionFlatViewProps {
  sectionId: string;
  renderInlineQuickCapture: (sectionId: string) => React.ReactNode;
  renderAddTodoButton: (sectionId: string) => React.ReactNode;
}

export default function TodoSectionFlatView({ sectionId, renderInlineQuickCapture, renderAddTodoButton }: TodoSectionFlatViewProps) {
  const { sectionsWithItems, sectionRefs } = useTodoContext();
  const sec = sectionsWithItems.find(s => s.id === sectionId);
  if (!sec) return null;

  return (
    // eslint-disable-next-line react-hooks/immutability -- ref-callback writes to sectionRefs.current, a plain scroll-target cache, not a reactive render value
    <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }}>
      <div className="flex items-center gap-2 px-1 pt-6 pb-4">
        <span className="text-[20px] leading-none">📂</span>
        <span className="text-[24px] font-extrabold text-text-primary tracking-tight">{sec.name}</span>
        <span className="text-[13px] font-medium text-text-muted/50 ml-1">{sec.items.length}</span>
      </div>
      <div className="pt-1">
        {sec.items.length === 0 ? (
          <EmptyState icon="📂" label="Brak otwartych zadań w tej sekcji." />
        ) : (
          sec.items.map((i) => <TodoCardConnected key={i.id} item={i} hideSectionChip />)
        )}
        {renderInlineQuickCapture(sec.id)}
        {renderAddTodoButton(sec.id)}
      </div>
    </div>
  );
}
