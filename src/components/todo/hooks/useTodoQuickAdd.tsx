import { Pressable } from '../../ui/ControlPrimitives';
import { useEffect, useRef, useState } from 'react';
import { useTodoContext } from '../context/TodoContext';
import TodoQuickCapture from '../TodoQuickCapture';

export function useTodoQuickAdd() {
  const {
    quickCaptureRef, form, setForm, isExpanded, setIsExpanded,
    busy, addItem, sections, parsedInput, today,
  } = useTodoContext();

  const [activeAddSectionId, setActiveAddSectionId] = useState<string | null>(null);
  const [scanTextOpen, setScanTextOpen] = useState(false);

  // Auto-open quick capture when navigated with ?new=1 (PWA shortcut / Telegram)
  const autoNewTaskHandled = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1' && !autoNewTaskHandled.current) {
      autoNewTaskHandled.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      setActiveAddSectionId('today');
      setIsExpanded(true);
      setForm({
        title: '', notes: '', priority: 'normal', tagsText: '',
        due_date: today, recurrence: '', section_id: '',
        scheduled_time: '', reminder_at: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderInlineQuickCapture = (sectionId: string) => {
    if (activeAddSectionId !== sectionId) return null;
    return (
      <div className="pt-2">
        <TodoQuickCapture
          quickCaptureRef={quickCaptureRef}
          form={form}
          setForm={setForm}
          isExpanded={isExpanded}
          setIsExpanded={(val: boolean) => {
            setIsExpanded(val);
            if (!val) setActiveAddSectionId(null);
          }}
          busy={busy}
          addItem={() => {
            addItem();
            setActiveAddSectionId(null);
          }}
          sections={sections}
          parsedInput={parsedInput}
          today={today}
          onOpenScanText={() => setScanTextOpen(true)}
        />
      </div>
    );
  };

  const renderAddTodoButton = (sectionId: string) => {
    if (activeAddSectionId === sectionId) return null;
    return (
      <Pressable
        onClick={() => {
          setActiveAddSectionId(sectionId);
          setIsExpanded(true);
          const defaultDate = sectionId === 'today' ? today : '';
          const defaultSec = sectionId === 'today' || sectionId === 'inbox' ? '' : sectionId;
          setForm({
            title: '', notes: '', priority: 'normal', tagsText: '',
            due_date: defaultDate, recurrence: '', section_id: defaultSec,
            scheduled_time: '', reminder_at: '',
          });
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer group mt-2"
      >
        <span className="text-lg text-primary group-hover:text-primary-hover font-bold">+</span>
        <span>Dodaj zadanie</span>
      </Pressable>
    );
  };

  return {
    activeAddSectionId, setActiveAddSectionId,
    scanTextOpen, setScanTextOpen,
    renderInlineQuickCapture, renderAddTodoButton,
  };
}
