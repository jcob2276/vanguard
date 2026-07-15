import Button from '../ui/Button';
import { notify } from '../../lib/notify';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { format, parseISO, startOfWeek } from 'date-fns';
import { getTodayWarsaw, shiftDateStr } from '../../lib/date';
import { supabase } from '../../lib/supabase';
import { listTodoSections, listTodoItems, updateTodoItem, logTaskReviewCompleted, TodoItemRow, TodoItemUpdate, TodoSectionRow } from '../../lib/todo/todo';
import { listRecentStreamEntries, updateStreamEntryContent, deleteStreamEntry, type StreamEntry } from '../../lib/behavior/streamReview';
import { listWeeklyPredictions, resolveCustomPrediction, createCustomPrediction, type Prediction } from '../../lib/predictionsApi';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useUserId } from '../../store/useStore';

import { WeeklyReviewContext, WeeklyReviewContextType, type WeeklyAiRecap } from './weekly/context/WeeklyReviewContext';
import WeeklyReviewInboxTriage from './weekly/WeeklyReviewInboxTriage';
import WeeklyReviewSectionAudit from './weekly/WeeklyReviewSectionAudit';
import WeeklyReviewStreamReview from './weekly/WeeklyReviewStreamReview';
import WeeklyReviewPredictions from './weekly/WeeklyReviewPredictions';
import WeeklyReviewSynthesis from './weekly/WeeklyReviewSynthesis';
import WeeklyReviewSuccess from './weekly/WeeklyReviewSuccess';

import WeeklyReviewFooter from './weekly/components/WeeklyReviewFooter';

interface Props {
  onClose: () => void;
  onFinished?: () => void;
}

export default function WeeklyReviewModal({ onClose, onFinished }: Props) {
  const userId = useUserId();
  const today = getTodayWarsaw();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  const [sections, setSections] = useState<TodoSectionRow[]>([]);
  const [inboxItems, setInboxItems] = useState<TodoItemRow[]>([]);
  const [sectionItems, setSectionItems] = useState<TodoItemRow[]>([]);

  const [streamEntries, setStreamEntries] = useState<StreamEntry[]>([]);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [editingStreamText, setEditingStreamText] = useState('');

  const [pendingUpdates, setPendingUpdates] = useState<Record<string, TodoItemUpdate>>({});
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);

  const [weeklyNote, setWeeklyNote] = useState('');
  const [aiRecap, setAiRecap] = useState<WeeklyAiRecap>(null);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [newPredictionText, setNewPredictionText] = useState('');
  const [newPredictionConfidence, setNewPredictionConfidence] = useState(0.8);
  const [stagedPredictions, setStagedPredictions] = useState<{ metric: string; value: number }[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const secData = await listTodoSections(userId);
        setSections(secData);

        const allItems = (await listTodoItems(userId)).filter((item) => item.status === 'open');
        setInboxItems(allItems.filter((item) => !item.section_id));
        setSectionItems(allItems.filter((item) => !!item.section_id));

        setStreamEntries(await listRecentStreamEntries(userId));

        const weekStart = format(startOfWeek(parseISO(today), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const { data: review } = await supabase
          .from('weekly_reviews')
          .select('ai_recap')
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .maybeSingle();
        if (review?.ai_recap) {
          setAiRecap(review.ai_recap as WeeklyAiRecap);
        }

        const preds = await listWeeklyPredictions(userId, weekStart);
        setPredictions(preds);
      } catch (err: unknown) { console.warn('[WeeklyReviewModal] Failed to load weekly review or predictions:', err); } finally {
        setLoading(false);
      }
    })();
  }, [userId, today]);

  const stageUpdate = (itemId: string, patch: TodoItemUpdate) => {
    setPendingUpdates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  };

  const getStagedItem = (item: TodoItemRow): TodoItemRow => {
    const patch = pendingUpdates[item.id] || {};
    return { ...item, ...patch };
  };

  const activeSections = sections.filter((sec) => {
    const items = sectionItems.filter((item) => getStagedItem(item).section_id === sec.id);
    return items.some((item) => getStagedItem(item).status === 'open');
  });

  const startEditStream = (entry: StreamEntry) => {
    setEditingStreamId(entry.id);
    setEditingStreamText(entry.content || '');
  };

  const saveEditStream = async () => {
    if (!editingStreamId) return;
    const id = editingStreamId;
    const content = editingStreamText.trim();
    setEditingStreamId(null);
    if (!content) return;
    setStreamEntries((prev) => prev.map((e) => (e.id === id ? { ...e, content } : e)));
    try {
      await updateStreamEntryContent(id, content);
    } catch (err: unknown) { notify('Nie udało się zapisać edycji wpisu.', 'error'); console.warn('[WeeklyReviewModal] Failed to update stream entry content:', err); }
  };

  const handleDeleteStream = async (id: string) => {
    setStreamEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteStreamEntry(id);
    } catch (err: unknown) { notify('Nie udało się usunąć wpisu z osi.', 'error'); console.warn('[WeeklyReviewModal] Failed to delete stream entry:', err); }
  };

  const handleResolveCustom = async (id: string, value: number) => {
    try {
      await resolveCustomPrediction(id, value);
      setPredictions((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: 'resolved',
                actual_value: value,
                error_value: Math.pow(p.predicted_value - value, 2),
              }
            : p
        )
      );
    } catch (err: unknown) { notify('Nie udało się rozstrzygnąć prognozy.', 'error'); console.warn('[WeeklyReviewModal] Failed to resolve custom prediction:', err); }
  };

  const handleCreateCustomPred = async () => {
    if (!userId || !newPredictionText.trim()) return;
    const nextSundayStr = shiftDateStr(today, 7);
    try {
      await createCustomPrediction(userId, nextSundayStr, newPredictionText.trim(), newPredictionConfidence);
      const weekStart = format(startOfWeek(parseISO(today), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      setPredictions(await listWeeklyPredictions(userId, weekStart));
      setNewPredictionText('');
      setNewPredictionConfidence(0.8);
    } catch (err: unknown) { notify('Nie udało się utworzyć prognozy.', 'error'); console.warn('[WeeklyReviewModal] Failed to create custom prediction:', err); }
  };

  const handleFinishReview = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(pendingUpdates).map(([id, patch]) => updateTodoItem(id, patch))
      );

      await logTaskReviewCompleted(userId, weeklyNote.trim());

      const nextSundayStr = shiftDateStr(today, 7);

      await Promise.all(
        stagedPredictions.map((pred) =>
          createCustomPrediction(userId, nextSundayStr, pred.metric, pred.value)
        )
      );

      if (onFinished) onFinished();
      setStep(6);
    } catch (err: unknown) { notify('Nie udało się zapisać i zakończyć podsumowania.', 'error'); console.warn('[WeeklyReviewModal] Failed to finish review:', err); } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal isOpen={true} onClose={onClose} showCloseButton={false} padding="p-6" size="xs" overlayClassName="z-[var(--ds-arbitrary-60)]" closeOnBackdropClick={false}>
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm font-bold text-text-muted">Wczytywanie Tygodniowego Przeglądu...</span>
        </div>
      </Modal>
    );
  }

  const contextValue: WeeklyReviewContextType = {
    userId,
    today,
    saving,
    setSaving,
    step,
    setStep,
    sections,
    setSections,
    inboxItems,
    setInboxItems,
    sectionItems,
    setSectionItems,
    streamEntries,
    setStreamEntries,
    editingStreamId,
    setEditingStreamId,
    editingStreamText,
    setEditingStreamText,
    pendingUpdates,
    setPendingUpdates,
    currentSectionIdx,
    setCurrentSectionIdx,
    weeklyNote,
    setWeeklyNote,
    aiRecap,
    predictions,
    setPredictions,
    newPredictionText,
    setNewPredictionText,
    newPredictionConfidence,
    setNewPredictionConfidence,
    stagedPredictions,
    setStagedPredictions,
    stageUpdate,
    getStagedItem,
    activeSections,
    startEditStream,
    saveEditStream,
    handleDeleteStream,
    handleResolveCustom,
    handleCreateCustomPred,
    handleFinishReview,
  };

  return (
    <WeeklyReviewContext.Provider value={contextValue}>
      <Modal
        isOpen={true}
        onClose={onClose}
        showCloseButton={false}
        padding="p-0"
        overflowY={false}
        size="lg"
        overlayClassName="z-[var(--ds-arbitrary-60)] p-0 flex-col justify-end sm:justify-center sm:p-4"
        className="rounded-t-3xl sm:rounded-2xl bg-background border border-border-custom/60 shadow-2xl flex flex-col max-h-[var(--ds-h-85vh)] sm:max-h-[var(--ds-h-640px)] overflow-hidden"
      >
        <div className="p-4 border-b border-border-custom/20 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black text-text-primary uppercase tracking-wider">Tygodniowy Przegląd Zadań</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-semibold text-text-muted">Niedziela, {today}</span>
              {step < 6 && <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Krok {step} z 5</span>}
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" icon={<X size={18} />} className="p-1.5" />
        </div>

        {step < 6 && (
          <div className="grid grid-cols-5 h-1 bg-border-custom/20 shrink-0">
            <div className={`h-full transition-all duration-[var(--motion-slow)] ${step >= 1 ? 'bg-primary' : 'bg-transparent'}`} />
            <div className={`h-full transition-all duration-[var(--motion-slow)] ${step >= 2 ? 'bg-primary' : 'bg-transparent'}`} />
            <div className={`h-full transition-all duration-[var(--motion-slow)] ${step >= 3 ? 'bg-primary' : 'bg-transparent'}`} />
            <div className={`h-full transition-all duration-[var(--motion-slow)] ${step >= 4 ? 'bg-primary' : 'bg-transparent'}`} />
            <div className={`h-full transition-all duration-[var(--motion-slow)] ${step >= 5 ? 'bg-primary' : 'bg-transparent'}`} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && <WeeklyReviewInboxTriage />}
          {step === 2 && <WeeklyReviewSectionAudit />}
          {step === 3 && <WeeklyReviewStreamReview />}
          {step === 4 && <WeeklyReviewPredictions />}
          {step === 5 && <WeeklyReviewSynthesis />}
          {step === 6 && <WeeklyReviewSuccess />}
        </div>

        <WeeklyReviewFooter onClose={onClose} />
      </Modal>
    </WeeklyReviewContext.Provider>
  );
}
