interface SupplementAddFormProps {
  name: string; setName: (v: string) => void;
  emoji: string; setEmoji: (v: string) => void;
  unit: string; setUnit: (v: string) => void;
  skipQty: boolean; setSkipQty: (v: boolean) => void;
  hasCycle: boolean; setHasCycle: (v: boolean) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  hasReminder: boolean; setHasReminder: (v: boolean) => void;
  reminderTime: string; setReminderTime: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SupplementAddForm({
  name, setName, emoji, setEmoji, unit, setUnit, skipQty, setSkipQty,
  hasCycle, setHasCycle, startDate, setStartDate, endDate, setEndDate,
  hasReminder, setHasReminder, reminderTime, setReminderTime,
  submitting, onSubmit,
}: SupplementAddFormProps) {
  return (
    <form onSubmit={onSubmit} className="p-4 rounded-xl border border-border-custom bg-surface-solid/30 space-y-3.5 transition-all">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Nazwa Suplementu</label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="np. Pyłek kwiatowy + Wit. C"
            className="w-full rounded-lg border border-border-custom bg-surface px-3 py-2 text-[11px] focus:outline-none focus:border-emerald-500" />
        </div>
        <div className="space-y-1">
          <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Emoji</label>
          <input type="text" maxLength={2} value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🐝"
            className="w-full rounded-lg border border-border-custom bg-surface px-3 py-2 text-center text-lg focus:outline-none focus:border-emerald-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Jednostka dawki</label>
          <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="np. porcja, kapsułka"
            className="w-full rounded-lg border border-border-custom bg-surface px-3 py-2 text-[11px] focus:outline-none focus:border-emerald-500" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="skipQty" checked={skipQty} onChange={e => setSkipQty(e.target.checked)}
            className="rounded border-border-custom bg-surface text-emerald-500 focus:ring-0 cursor-pointer" />
          <label htmlFor="skipQty" className="text-[10px] font-medium text-text-secondary select-none cursor-pointer">Pomiń wybór ilości</label>
        </div>
      </div>
      <div className="border-t border-border-custom/50 pt-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="hasCycle" checked={hasCycle} onChange={e => setHasCycle(e.target.checked)}
            className="rounded border-border-custom bg-surface text-emerald-500 focus:ring-0 cursor-pointer" />
          <label htmlFor="hasCycle" className="text-[10px] font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer">Określony cykl brania (np. 3 tygodnie)</label>
        </div>
        {hasCycle && (
          <div className="grid grid-cols-2 gap-3 pl-5 transition-all">
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Data rozpoczęcia</label>
              <input type="date" required={hasCycle} value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border-custom bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Data zakończenia</label>
              <input type="date" required={hasCycle} value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border-custom bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border-custom/50 pt-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="hasReminder" checked={hasReminder} onChange={e => setHasReminder(e.target.checked)}
            className="rounded border-border-custom bg-surface text-emerald-500 focus:ring-0 cursor-pointer" />
          <label htmlFor="hasReminder" className="text-[10px] font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer">Ustaw codzienne przypomnienie push/Telegram</label>
        </div>
        {hasReminder && (
          <div className="pl-5 transition-all">
            <div className="w-1/2 space-y-1">
              <label className="text-[8px] font-bold uppercase tracking-wider text-text-muted">Godzina</label>
              <input type="time" required={hasReminder} value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                className="w-full rounded-lg border border-border-custom bg-surface px-3 py-1.5 text-[11px] focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
        )}
      </div>
      <button type="submit" disabled={submitting}
        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800/40 disabled:text-text-muted text-white text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer">
        {submitting ? 'Zapisywanie...' : 'Zapisz Suplement i Rozpocznij Cykl'}
      </button>
    </form>
  );
}
