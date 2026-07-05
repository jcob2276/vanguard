import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Repeat, X, CalendarDays, Sun, Sofa } from 'lucide-react';
import { parseTodoQuickInput } from '../../lib/todoParser';

interface TodoDatePickerPopoverProps {
  dueDate: string | null;
  scheduledTime: string | null;
  recurrence: string | null;
  today: string;
  onChange: (patch: { due_date?: string | null; scheduled_time?: string | null; recurrence?: string | null }) => void;
  onClose: () => void;
}

const WEEKDAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const MONTH_LABELS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function toKey(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function nextWeekendKey(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  let diff = (6 - dow + 7) % 7;
  if (diff === 0) diff = 7;
  return addDaysToKey(today, diff);
}

function weekdayShort(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('pl-PL', { weekday: 'short', timeZone: 'UTC' });
}

export default function TodoDatePickerPopover({
  dueDate,
  scheduledTime,
  recurrence,
  today,
  onChange,
  onClose,
}: TodoDatePickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [freeText, setFreeText] = useState('');
  const [showTime, setShowTime] = useState(!!scheduledTime);
  const [showRecurrence, setShowRecurrence] = useState(!!recurrence);

  const anchorKey = dueDate || today;
  const [anchorY, anchorM] = anchorKey.split('-').map(Number);
  const [viewYear, setViewYear] = useState(anchorY);
  const [viewMonth, setViewMonth] = useState(anchorM - 1);

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

  const tomorrowKey = addDaysToKey(today, 1);
  const weekendKey = nextWeekendKey(today);

  const pickDate = (key: string | null) => {
    onChange({ due_date: key });
    if (!key) { setShowTime(false); setShowRecurrence(false); onChange({ scheduled_time: null, recurrence: null }); }
  };

  const handleFreeText = (text: string) => {
    setFreeText(text);
    const parsed = parseTodoQuickInput(text);
    if (parsed.due_date) {
      pickDate(parsed.due_date);
      const [y, m] = parsed.due_date.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  };

  const firstDayIndex = (new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay() + 6) % 7;
  const totalDays = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const prevMonthTotalDays = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

  const cells: { key: string; dayNum: number; inMonth: boolean }[] = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dNum = prevMonthTotalDays - i;
    const [y, m] = viewMonth === 0 ? [viewYear - 1, 11] : [viewYear, viewMonth - 1];
    cells.push({ key: toKey(y, m, dNum), dayNum: dNum, inMonth: false });
  }
  for (let i = 1; i <= totalDays; i++) {
    cells.push({ key: toKey(viewYear, viewMonth, i), dayNum: i, inMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const [y, m] = viewMonth === 11 ? [viewYear + 1, 0] : [viewYear, viewMonth + 1];
    cells.push({ key: toKey(y, m, i), dayNum: i, inMonth: false });
  }

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-50 top-full left-0 mt-2 w-[280px] rounded-2xl border border-border-custom bg-surface-solid shadow-2xl flex flex-col gap-2.5 p-3 animate-in fade-in zoom-in-95 duration-150"
    >
      <input
        autoFocus
        value={freeText}
        onChange={(e) => handleFreeText(e.target.value)}
        placeholder="Wpisz termin"
        className="w-full rounded-xl border border-border-custom/60 bg-surface/60 px-3 py-1.5 text-[12.5px] font-medium text-text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/40"
      />

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => pickDate(today)}
          className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${dueDate === today ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface/60'}`}
        >
          <CalendarDays size={14} className="text-emerald-500" />
          <span className="flex-1 text-left">Dziś</span>
          <span className="text-[10px] font-medium text-text-muted/50">{weekdayShort(today)}.</span>
        </button>
        <button
          type="button"
          onClick={() => pickDate(tomorrowKey)}
          className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${dueDate === tomorrowKey ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface/60'}`}
        >
          <Sun size={14} className="text-amber-500" />
          <span className="flex-1 text-left">Jutro</span>
          <span className="text-[10px] font-medium text-text-muted/50">{weekdayShort(tomorrowKey)}.</span>
        </button>
        <button
          type="button"
          onClick={() => pickDate(weekendKey)}
          className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${dueDate === weekendKey ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface/60'}`}
        >
          <Sofa size={14} className="text-sky-500" />
          <span className="flex-1 text-left">Następny weekend</span>
          <span className="text-[10px] font-medium text-text-muted/50">{weekdayShort(weekendKey)}.</span>
        </button>
      </div>

      <div className="border-t border-border-custom/40 pt-2">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[12px] font-black text-text-primary">{MONTH_LABELS[viewMonth]} {viewYear}</span>
          <div className="flex gap-1">
            <button type="button" onClick={goPrevMonth} className="p-1 rounded-lg hover:bg-surface/60 transition-colors">
              <ChevronLeft size={13} className="text-text-muted" />
            </button>
            <button type="button" onClick={goNextMonth} className="p-1 rounded-lg hover:bg-surface/60 transition-colors">
              <ChevronRight size={13} className="text-text-muted" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center mb-1">
          {WEEKDAY_LABELS.map((d) => (
            <span key={d} className="text-[9px] font-bold text-text-muted/50 uppercase">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {cells.map((c) => {
            const isSelected = c.key === dueDate;
            const isToday = c.key === today;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => pickDate(c.key)}
                className={`mx-auto h-6.5 w-6.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  !c.inMonth ? 'text-text-muted/25' :
                  isSelected ? 'bg-primary text-white' :
                  isToday ? 'text-primary border border-primary/40' :
                  'text-text-primary hover:bg-surface/60'
                }`}
              >
                {c.dayNum}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border-custom/40 pt-2 flex flex-col gap-1.5">
        {!showTime ? (
          <button
            type="button"
            onClick={() => setShowTime(true)}
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-surface/60 hover:text-text-primary transition-colors"
          >
            <Clock3 size={13} /> Czas
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-border-custom/50 px-2.5 py-1">
            <Clock3 size={13} className="text-primary shrink-0" />
            <input
              type="time"
              value={scheduledTime || ''}
              onChange={(e) => onChange({ scheduled_time: e.target.value || null })}
              className="flex-1 bg-transparent text-[12px] font-semibold text-text-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <button
              type="button"
              onClick={() => { setShowTime(false); onChange({ scheduled_time: null }); }}
              className="shrink-0 text-text-muted/50 hover:text-rose-400 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {dueDate && (
        <button
          type="button"
          onClick={() => pickDate(null)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border-custom/50 py-1.5 text-[11px] font-semibold text-text-muted hover:text-rose-400 transition-colors"
        >
          <X size={11} /> Usuń termin
        </button>
      )}
    </div>
  );
}
