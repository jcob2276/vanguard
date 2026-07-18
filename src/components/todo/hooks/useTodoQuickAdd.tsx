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

  const openQuickAdd = (sectionId: string) => {
    setActiveAddSectionId(sectionId);
    setIsExpanded(true);
    const defaultDate = sectionId === 'today' ? today : '';
    const defaultSec = sectionId === 'today' || sectionId === 'inbox' ? '' : sectionId;
    setForm({
      title: '', notes: '', priority: 'normal', tagsText: '',
      due_date: defaultDate, deadline_date: '', recurrence: '', section_id: defaultSec,
      scheduled_time: '', reminder_at: '',
    });
    window.setTimeout(() => {
      quickCaptureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      quickCaptureRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }, 50);
  };

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
        due_date: today, deadline_date: '', recurrence: '', section_id: '',
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
        onClick={() => openQuickAdd(sectionId)}
        className="group mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-custom bg-surface-solid/60 px-4 text-sm font-bold text-text-secondary hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary group-hover:bg-primary group-hover:text-on-accent">+</span>
        <span>Dodaj zadanie</span>
      </Pressable>
    );
  };

  return {
    activeAddSectionId, setActiveAddSectionId,
    scanTextOpen, setScanTextOpen,
    openQuickAdd,
    renderInlineQuickCapture, renderAddTodoButton,
  };
}
