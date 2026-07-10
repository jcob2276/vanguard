import { useState, useEffect, useCallback } from 'react';
import { Pill, Calendar, Bell, Plus, Check, Trash2, X, AlertCircle } from 'lucide-react';
import {
  fetchSupplements,
  fetchSupplementLogsSince,
  toggleSupplementLog,
  addSupplementLog,
  saveSupplement,
  type Supplement,
  type SupplementLog,
} from '../../../lib/health/supplementsClient';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date'; import { notify } from '../../../lib/notify';

interface SupplementsPanelProps {
  userId: string;
}

export default function SupplementsPanel({ userId }: SupplementsPanelProps) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
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

  // Get date range for the past 7 days (Warsaw local dates)
  const last7Days = (() => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      dates.push(shiftDateStr(today, -i));
    }
    return dates;
  })();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sups = await fetchSupplements(userId);
      // Fetch logs for the past 14 days to cover history grid and active check
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
    void (async () => { await loadData(); })();
  }, [loadData]);

  // Toggle supplement intake today
  async function handleToggle(sup: Supplement) {
    try {
      const isLoggedNow = await toggleSupplementLog(userId, sup.id, today, 1);
      // Refresh logs
      const sinceDate = shiftDateStr(today, -14);
      const logRows = await fetchSupplementLogsSince(userId, sinceDate);
      setLogs(logRows);
    } catch (err: unknown) { notify('Nie udało się zapisać zażycia suplementu.', 'error'); console.warn('[SupplementsPanel] Failed to toggle supplement log:', err); }
  }

  // Deactivate/Archive supplement
  async function handleDeactivate(sup: Supplement) {
    if (!confirm(`Czy na pewno chcesz zarchiwizować suplement "${sup.name}"?`)) return;
    try {
      await saveSupplement(userId, {
        ...sup,
        active: false,
      });
      await loadData();
    } catch (err: unknown) { notify('Nie udało się zarchiwizować suplementu.', 'error'); console.warn('[SupplementsPanel] Failed to deactivate supplement:', err); }
  }

  // Add new supplement schedule
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      // Auto-generate unique slug
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'sup_' + Date.now();

      await saveSupplement(userId, {
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
      });

      setName('');
      setEmoji('💊');
      setUnit('porcja');
      setSkipQty(false);
      setHasCycle(false);
      setStartDate('');
      setEndDate('');
      setHasReminder(false);
      setReminderTime('08:00');
      setShowAddForm(false);

      await loadData();
    } catch (err: unknown) {
      console.error('[supplements] Save failed:', err);
      notify('Wystąpił błąd podczas zapisywania suplementu.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Check if a supplement was logged on a specific date
  function isLogged(supplementId: string, date: string): boolean {
    return logs.some(l => l.supplement_id === supplementId && l.date === date);
  }

  // Helper: format date to short DD.MM format
  function formatShortDate(dateStr: string) {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}.${parts[1]}`;
  }

  // Helper: check if a date is within supplement cycle
  function isWithinCycle(sup: Supplement, dateStr: string): boolean {
    if (sup.start_date && dateStr < sup.start_date) return false;
    if (sup.end_date && dateStr > sup.end_date) return false;
    return true;
  }

  const activeSups = supplements.filter(s => s.active);

  return (
    <div className="rounded-[20px] border border-border-custom bg-surface/60 px-5 py-4 space-y-4 text-text-primary">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill size={14} className="text-emerald-500 shrink-0" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-text-muted">
            Suplementy & Cykle
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(!showAddForm);
            // Default dates to today & 3 weeks from today
            if (!startDate) {
              setStartDate(shiftDateStr(getTodayWarsaw(), 0));
              setEndDate(shiftDateStr(getTodayWarsaw(), 21));
            }
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border-custom hover:border-emerald-500/50 bg-surface-solid/40 text-[9px] font-black uppercase tracking-wider text-text-muted hover:text-emerald-500 transition-colors cursor-pointer"
        >
          {showAddForm ? <X size={10} /> : <Plus size={10} />}
          <span>{showAddForm ? 'Anuluj' : 'Dodaj Cykl'}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 text-[10px]">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      {/* Add New Supplement Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-border-custom bg-surface-solid/30 space-y-3.5 transition-all">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Nazwa Suplementu</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="np. Pyłek kwiatowy + Wit. C"
                className="w-full rounded-lg border border-border-custom bg-surface px-3 py-2 text-[11px] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Emoji</label>
              <input
                type="text"
                maxLength={2}
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                placeholder="🐝"
                className="w-full rounded-lg border border-border-custom bg-surface px-3 py-2 text-center text-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Jednostka dawki</label>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="np. porcja, kapsułka"
                className="w-full rounded-lg border border-border-custom bg-surface px-3 py-2 text-[11px] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="skipQty"
                checked={skipQty}
                onChange={e => setSkipQty(e.target.checked)}
                className="rounded border-border-custom bg-surface text-emerald-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="skipQty" className="text-[10px] font-medium text-text-secondary select-none cursor-pointer">
                Pomiń wybór ilości
              </label>
            </div>
          </div>

          {/* Cycle setup */}
          <div className="border-t border-border-custom/50 pt-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasCycle"
                checked={hasCycle}
                onChange={e => setHasCycle(e.target.checked)}
                className="rounded border-border-custom bg-surface text-emerald-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="hasCycle" className="text-[10px] font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer">
                Określony cykl brania (np. 3 tygodnie)
              </label>
            </div>

            {hasCycle && (
              <div className="grid grid-cols-2 gap-3 pl-5 transition-all">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Data rozpoczęcia</label>
                  <input
                    type="date"
                    required={hasCycle}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-border-custom bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Data zakończenia</label>
                  <input
                    type="date"
                    required={hasCycle}
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-border-custom bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reminder setup */}
          <div className="border-t border-border-custom/50 pt-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasReminder"
                checked={hasReminder}
                onChange={e => setHasReminder(e.target.checked)}
                className="rounded border-border-custom bg-surface text-emerald-500 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="hasReminder" className="text-[10px] font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer">
                Ustaw codzienne przypomnienie push/Telegram
              </label>
            </div>

            {hasReminder && (
              <div className="pl-5 transition-all">
                <div className="w-1/2 space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Godzina</label>
                  <input
                    type="time"
                    required={hasReminder}
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    className="w-full rounded-lg border border-border-custom bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800/40 disabled:text-text-muted text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            {submitting ? 'Zapisywanie...' : 'Zapisz Suplement i Rozpocznij Cykl'}
          </button>
        </form>
      )}

      {/* Supplements List */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : activeSups.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-border-custom rounded-xl text-text-muted text-[11px]">
          Brak aktywnych suplementów. Kliknij "Dodaj Cykl" powyżej.
        </div>
      ) : (
        <div className="space-y-3">
          {activeSups.map(sup => {
            const takenToday = isLogged(sup.id, today);

            // Calculate cycle progress if dates are specified
            let cycleProgress = null;
            let cycleDaysText = null;
            if (sup.start_date) {
              const start = new Date(sup.start_date + 'T00:00:00Z');
              const nowWarsaw = new Date(today + 'T00:00:00Z');
              const elapsedDays = Math.max(0, Math.floor((nowWarsaw.getTime() - start.getTime()) / 86400000) + 1);

              if (sup.end_date) {
                const end = new Date(sup.end_date + 'T00:00:00Z');
                const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
                cycleProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
                cycleDaysText = `Dzień ${elapsedDays} z ${totalDays}`;
              } else {
                cycleDaysText = `Od ${elapsedDays} dni`;
              }
            }

            return (
              <div
                key={sup.id}
                className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                  takenToday
                    ? 'border-emerald-500/20 bg-emerald-500/[0.02]'
                    : 'border-border-custom bg-surface/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0" role="img" aria-label={sup.name}>
                      {sup.emoji || '💊'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase text-text-primary leading-tight truncate">
                        {sup.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[9px] text-text-muted">
                        <span>1x {sup.unit}</span>
                        {sup.reminder_time && (
                          <span className="flex items-center gap-0.5 text-indigo-400">
                            <Bell size={10} /> {sup.reminder_time.slice(0, 5)}
                          </span>
                        )}
                        {cycleDaysText && (
                          <span className="flex items-center gap-0.5 text-amber-500 font-bold uppercase tracking-wider">
                            <Calendar size={10} /> {cycleDaysText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggle(sup)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                        takenToday
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                          : 'border-border-custom bg-surface hover:text-text-primary hover:border-border-custom/80'
                      }`}
                    >
                      <Check size={11} className={takenToday ? 'stroke-[3px]' : 'opacity-30'} />
                      <span>{takenToday ? 'Zalogowano' : 'Zaloguj'}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => void handleDeactivate(sup)}
                      className="p-2 text-text-muted hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/5 rounded-lg transition-all cursor-pointer"
                      title="Zarchiwizuj"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Progress bar for cycle */}
                {cycleProgress !== null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[8px] text-text-muted font-bold">
                      <span>Rozpoczęcie: {formatShortDate(sup.start_date!)}</span>
                      <span>Zakończenie: {formatShortDate(sup.end_date!)}</span>
                    </div>
                    <div className="h-1 w-full bg-border-custom rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${cycleProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 7-day checklist history */}
                <div className="border-t border-border-custom/50 pt-2 flex items-center justify-between gap-1.5">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted">
                    Historia 7 dni:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {last7Days.map(date => {
                      const logged = isLogged(sup.id, date);
                      const isToday = date === today;
                      const inCycle = isWithinCycle(sup, date);

                      return (
                        <div
                          key={date}
                          className="flex flex-col items-center gap-0.5"
                          title={`${date}${!inCycle ? ' (poza cyklem)' : ''}`}
                        >
                          <div
                            className={`h-4.5 w-4.5 rounded-md flex items-center justify-center text-[8px] transition-all border ${
                              logged
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 font-bold'
                                : !inCycle
                                ? 'bg-surface/20 border-border-custom/20 text-text-muted/30 line-through'
                                : isToday
                                ? 'bg-surface border-indigo-500/40 text-indigo-400'
                                : 'bg-surface/40 border-border-custom/50 text-text-muted'
                            }`}
                          >
                            {logged ? '✓' : ''}
                          </div>
                          <span className={`text-[7px] font-mono leading-none ${isToday ? 'text-indigo-400 font-bold' : 'text-text-muted'}`}>
                            {formatShortDate(date).split('.')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
