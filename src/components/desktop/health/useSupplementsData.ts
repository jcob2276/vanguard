import { useState } from 'react';
import {
  type Supplement,
} from '../../../lib/health/supplementsClient';
import {
  useSupplements,
  useSupplementLogs,
  useToggleSupplement,
  useSaveSupplement,
} from '../../../lib/health/supplementsApi';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { notify } from '../../../lib/notify';

export function useSupplementsData(userId: string) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💊');
  const [unit, setUnit] = useState('porcja');
  const [skipQty, setSkipQty] = useState(false);
  const [hasCycle, setHasCycle] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [submitting, setSubmitting] = useState(false);

  const today = getTodayWarsaw();
  const sinceDate = shiftDateStr(today, -14);

  const last7Days = (() => {
    const dates = [];
    for (let i = 6; i >= 0; i--) dates.push(shiftDateStr(today, -i));
    return dates;
  })();

  const { data: supplements = [], isLoading: supplementsLoading, error: supplementsError } = useSupplements(userId);
  const { data: logs = [], isLoading: logsLoading, error: logsError } = useSupplementLogs(userId, sinceDate);

  const loading = supplementsLoading || logsLoading;
  const error = supplementsError || logsError ? 'Nie udało się załadować suplementów.' : null;

  const toggleMutation = useToggleSupplement();
  const saveMutation = useSaveSupplement();

  async function handleToggle(sup: Supplement) {
    const existingLog = logs.find(l => l.supplement_id === sup.id && l.date === today);
    try {
      await toggleMutation.mutateAsync({
        userId,
        supplementId: sup.id,
        date: today,
        sinceDate,
        existingLog,
      });
    } catch (err: unknown) {
      notify('Nie udało się zapisać zażycia suplementu.', 'error');
      console.warn('[SupplementsPanel] Failed to toggle supplement log:', err);
    }
  }

  async function handleDeactivate(sup: Supplement) {
    if (!confirm(`Czy na pewno chcesz zarchiwizować suplement "${sup.name}"?`)) return;
    try {
      await saveMutation.mutateAsync({
        userId,
        supplement: { ...sup, active: false },
      });
    } catch (err: unknown) {
      notify('Nie udało się zarchiwizować suplementu.', 'error');
      console.warn('[SupplementsPanel] Failed to deactivate supplement:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sup_' + Date.now();
      await saveMutation.mutateAsync({
        userId,
        supplement: {
          slug,
          name: name.trim(),
          emoji: emoji.trim() || '💊',
          unit: unit.trim() || 'kapsułka',
          dose_per_unit: {},
          sort_order: supplements.length + 1,
          active: true,
          start_date: hasCycle && startDate ? startDate : null,
          end_date: hasCycle && endDate ? endDate : null,
          reminder_time: hasReminder && reminderTime ? reminderTime : null,
          skip_qty: skipQty,
        },
      });
      setName(''); setEmoji('💊'); setUnit('porcja'); setSkipQty(false);
      setHasCycle(false); setStartDate(''); setEndDate('');
      setHasReminder(false); setReminderTime('08:00'); setShowAddForm(false);
    } catch (err: unknown) {
      console.error('[supplements] Save failed:', err);
      notify('Wystąpił błąd podczas zapisywania suplementu.', 'error');
    } finally { setSubmitting(false); }
  }

  function isLogged(supplementId: string, date: string): boolean {
    return logs.some(l => l.supplement_id === supplementId && l.date === date);
  }

  const activeSups = supplements.filter(s => s.active);

  return {
    supplements, logs, loading, error, activeSups,
    showAddForm, setShowAddForm,
    name, setName, emoji, setEmoji, unit, setUnit, skipQty, setSkipQty,
    hasCycle, setHasCycle, startDate, setStartDate, endDate, setEndDate,
    hasReminder, setHasReminder, reminderTime, setReminderTime,
    submitting, today, last7Days,
    handleToggle, handleDeactivate, handleSubmit, isLogged,
  };
}
