import { useEffect, useRef, useState } from 'react';
import { Bell, HelpCircle } from 'lucide-react';

interface TodoReminderPopoverProps {
  dueDate: string | null;
  scheduledTime: string | null;
  onSetReminder: (isoDatetime: string) => void;
  onClose: () => void;
}

const OFFSET_OPTIONS = [
  { value: 0, label: 'O wskazanej godzinie' },
  { value: 15, label: '15 minut przed' },
  { value: 30, label: '30 minut przed' },
  { value: 60, label: '1 godzinę przed' },
  { value: 60 * 24, label: '1 dzień przed' },
];

export default function TodoReminderPopover({
  dueDate,
  scheduledTime,
  onSetReminder,
  onClose,
}: TodoReminderPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'datetime' | 'before'>(dueDate ? 'before' : 'datetime');
  const [datetimeVal, setDatetimeVal] = useState('');
  const [offsetMinutes, setOffsetMinutes] = useState(0);

  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const closeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', close);
      document.addEventListener('touchstart', close);
      document.addEventListener('keydown', closeKey);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', closeKey);
    };
  }, [onClose]);

  const dueTimestamp = dueDate ? new Date(`${dueDate}T${scheduledTime || '09:00'}:00`) : null;

  const commitDatetime = () => {
    if (!datetimeVal) return;
    onSetReminder(new Date(datetimeVal).toISOString());
    onClose();
  };

  const commitBefore = () => {
    if (!dueTimestamp) return;
    const at = new Date(dueTimestamp.getTime() - offsetMinutes * 60000);
    onSetReminder(at.toISOString());
    onClose();
  };

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-50 top-full left-0 mt-2 w-[290px] rounded-2xl border border-border-custom bg-surface-solid shadow-2xl flex flex-col gap-3 p-4 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
    >
      <p className="text-sm font-black text-text-primary">Przypomnienia</p>

      <div className="flex items-center gap-4 border-b border-border-custom/40">
        <button
          type="button"
          onClick={() => setTab('datetime')}
          className={`pb-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
            tab === 'datetime' ? 'text-text-primary border-primary' : 'text-text-muted/50 border-transparent hover:text-text-primary'
          }`}
        >
          Data i godzina
        </button>
        <button
          type="button"
          onClick={() => setTab('before')}
          className={`pb-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
            tab === 'before' ? 'text-text-primary border-primary' : 'text-text-muted/50 border-transparent hover:text-text-primary'
          }`}
        >
          Przed zadaniem
        </button>
      </div>

      {tab === 'datetime' ? (
        <input
          type="datetime-local"
          value={datetimeVal}
          onChange={(e) => setDatetimeVal(e.target.value)}
          className="w-full rounded-xl border border-border-custom/60 bg-surface/60 px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-primary/40 [color-scheme:light] dark:[color-scheme:dark]"
        />
      ) : dueTimestamp ? (
        <select
          value={offsetMinutes}
          onChange={(e) => setOffsetMinutes(Number(e.target.value))}
          className="w-full rounded-xl border border-border-custom/60 bg-surface/60 px-3 py-2 text-sm font-semibold text-text-primary outline-none focus:border-primary/40 cursor-pointer"
        >
          {OFFSET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-text-muted/60 leading-relaxed">
          Ustaw najpierw termin zadania, aby dodać przypomnienie względem niego.
        </p>
      )}

      <p className="text-xs text-text-muted/60 leading-relaxed">
        Otrzymaj powiadomienie, kiedy nadejdzie czas wykonania zadania.
      </p>

      <div className="flex items-center justify-between">
        <HelpCircle size={16} className="text-text-muted/40" />
        <button
          type="button"
          onClick={tab === 'datetime' ? commitDatetime : commitBefore}
          disabled={tab === 'datetime' ? !datetimeVal : !dueTimestamp}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-black text-white disabled:opacity-30 hover:bg-primary/90 transition-colors"
        >
          <Bell size={12} /> Dodaj przypomnienie
        </button>
      </div>
    </div>
  );
}
