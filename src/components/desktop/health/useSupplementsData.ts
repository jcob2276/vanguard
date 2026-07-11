import { useState, useEffect, useCallback } from 'react';
import {
  fetchSupplements,
  fetchSupplementLogsSince,
  toggleSupplementLog,
  saveSupplement,
  type Supplement,
  type SupplementLog,
} from '../../../lib/health/supplementsClient';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { notify } from '../../../lib/notify';

export function useSupplementsData(userId: string) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const last7Days = (() => {
    const dates = [];
    for (let i = 6; i >= 0; i--) dates.push(shiftDateStr(today, -i));
    return dates;
  })();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sups = await fetchSupplements(userId);
      const sinceDate = shiftDateStr(today, -14);
      const logRows = await fetchSupplementLogsSince(userId, sinceDate);
      setSupplements(sups);
      setLogs(logRows);
    } catch (err: unknown) {
      console.error('[supplements] Load failed:', err);
      setError('Nie udało się załadować suplementów.');
    } finally {
      setLoading(false);
    }
  }, [userId, today]);

  useEffect(() => {
    const t = setTimeout(() => { void loadData(); }, 0);
    return () => clearTimeout(t);
  }, [loadData]);

  async function handleToggle(sup: Supplement) {
    try {
      await toggleSupplementLog(userId, sup.id, today, 1);
      const sinceDate = shiftDateStr(today, -14);
      const logRows = await fetchSupplementLogsSince(userId, sinceDate);
      setLogs(logRows);
    } catch (err: unknown) { notify('Nie udało się zapisać zażycia suplementu.', 'error'); console.warn('[SupplementsPanel] Failed to toggle supplement log:', err); }
  }

  async function handleDeactivate(sup: Supplement) {
    if (!confirm(`Czy na pewno chcesz zarchiwizować suplement "${sup.name}"?`)) return;
    try {
      await saveSupplement(userId, { ...sup, active: false });
      await loadData();
    } catch (err: unknown) { notify('Nie udało się zarchiwizować suplementu.', 'error'); console.warn('[SupplementsPanel] Failed to deactivate supplement:', err); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'sup_' + Date.now();
      await saveSupplement(userId, {
        slug, name: name.trim(), emoji: emoji.trim() || '💊',
        unit: unit.trim() || 'kapsułka', dose_per_unit: {},
        sort_order: supplements.length + 1, active: true,
        start_date: hasCycle && startDate ? startDate : null,
        end_date: hasCycle && endDate ? endDate : null,
        reminder_time: hasReminder && reminderTime ? reminderTime : null,
        skip_qty: skipQty,
      });
      setName(''); setEmoji('💊'); setUnit('porcja'); setSkipQty(false);
      setHasCycle(false); setStartDate(''); setEndDate('');
      setHasReminder(false); setReminderTime('08:00'); setShowAddForm(false);
      await loadData();
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
