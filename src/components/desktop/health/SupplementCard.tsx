import { useState } from 'react';
import Button from '../../ui/Button';
import { ControlInput, Pressable } from '../../ui/ControlPrimitives';
import { Calendar, Bell, Check, Trash2 } from 'lucide-react';
import { Card } from '../../ui/Card';
import type { Supplement } from '../../../lib/health/supplementsClient';

function formatShortDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}.${parts[1]}`;
}

function isWithinCycle(sup: Supplement, dateStr: string): boolean {
  if (sup.start_date && dateStr < sup.start_date) return false;
  if (sup.end_date && dateStr > sup.end_date) return false;
  return true;
}

function formatReminderInputValue(raw: string | null): string {
  if (!raw) return '21:30';
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '21:30';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

interface SupplementCardProps {
  sup: Supplement;
  takenToday: boolean;
  last7Days: string[];
  today: string;
  onToggle: () => void;
  onDeactivate: () => void;
  onUpdateReminder: (reminderTime: string | null) => void;
  isLogged: (id: string, date: string) => boolean;
}

export default function SupplementCard({
  sup, takenToday, last7Days, today, onToggle, onDeactivate, onUpdateReminder, isLogged,
}: SupplementCardProps) {
  const [editingReminder, setEditingReminder] = useState(false);
  const [draftReminder, setDraftReminder] = useState(formatReminderInputValue(sup.reminder_time));
  const isReverse = sup.name.toLowerCase().includes('pyłek') || sup.name.toLowerCase().includes('pollen') || sup.dose_per_unit?.['reverse_logic'] === true;

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
    <Card variant="outline" padding="0.875rem" className="space-y-2.5 transition-all"
      style={takenToday ? { border: '1px solid var(--color-theme-hex-ba1618512902)', background: 'var(--color-theme-hex-ba16185129002)' } : { background: 'var(--color-theme-hex-ba26264603)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0" role="img" aria-label={sup.name}>{sup.emoji || '💊'}</span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-text-primary leading-tight truncate">{sup.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-2xs text-text-muted">
              <span>1x {sup.unit}</span>
              {sup.reminder_time && !editingReminder && (
                <Pressable
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-0.5 p-0 h-auto text-primary hover:underline"
                  onClick={() => {
                    setDraftReminder(formatReminderInputValue(sup.reminder_time));
                    setEditingReminder(true);
                  }}
                >
                  <Bell size={10} /> {sup.reminder_time.slice(0, 5)}
                </Pressable>
              )}
              {!sup.reminder_time && !editingReminder && (
                <Pressable variant="ghost" size="sm" className="flex items-center gap-0.5 p-0 h-auto text-text-muted hover:text-primary" onClick={() => setEditingReminder(true)}>
                  <Bell size={10} /> Ustaw przypomnienie
                </Pressable>
              )}
              {cycleDaysText && <span className="flex items-center gap-0.5 text-warning font-bold uppercase tracking-wider"><Calendar size={10} /> {cycleDaysText}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={takenToday ? 'tonal' : 'outline'} size="sm" type="button" onClick={onToggle}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${takenToday ? 'border-success/40 bg-success/10 text-success hover:bg-success/20' : 'border-border-custom bg-surface hover:text-text-primary hover:border-border-custom/80'}`}
            icon={<Check size={11} className={takenToday ? 'stroke-[var(--ds-arbitrary-3px)]' : 'opacity-[var(--opacity-30)]'} />}
          >
            <span>{isReverse ? (takenToday ? 'Wzięty' : 'Pominięty') : (takenToday ? 'Zalogowano' : 'Zaloguj')}</span>
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={onDeactivate}
            className="p-2 text-text-muted hover:text-danger border border-transparent hover:border-danger/20 hover:bg-danger/5 rounded-lg transition-all cursor-pointer" title="Zarchiwizuj"
            icon={<Trash2 size={11} />}
          />
        </div>
      </div>

      {editingReminder && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border-custom/50 bg-surface-solid/30 p-2.5">
          <div className="space-y-1">
            <label className="text-2xs font-bold uppercase tracking-wider text-text-muted">Push o godz.</label>
            <ControlInput
              type="time"
              value={draftReminder}
              onChange={(e) => setDraftReminder(e.target.value)}
              className="rounded-lg border border-border-custom bg-surface px-2 py-1 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              onUpdateReminder(draftReminder || null);
              setEditingReminder(false);
            }}
          >
            Zapisz
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onUpdateReminder(null);
              setEditingReminder(false);
            }}
          >
            Wyłącz
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingReminder(false)}>
            Anuluj
          </Button>
        </div>
      )}

      {cycleProgress !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-2xs text-text-muted font-bold">
            <span>Rozpoczęcie: {formatShortDate(sup.start_date!)}</span>
            <span>Zakończenie: {formatShortDate(sup.end_date!)}</span>
          </div>
          <div className="h-1 w-full bg-border-custom rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full transition-all" style={{ width: `${cycleProgress}%` }} />
          </div>
        </div>
      )}

      <div className="border-t border-border-custom/50 pt-2 flex items-center justify-between gap-1.5">
        <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">Historia 7 dni:</span>
        <div className="flex items-center gap-1.5">
          {last7Days.map(date => {
            const logged = isLogged(sup.id, date);
            const isToday = date === today;
            const inCycle = isWithinCycle(sup, date);
            const taken = isReverse ? (inCycle ? !logged : false) : logged;
            return (
              <div key={date} className="flex flex-col items-center gap-0.5" title={`${date}${!inCycle ? ' (poza cyklem)' : ''}`}>
                <div className={`h-4.5 w-4.5 rounded-md flex items-center justify-center text-2xs transition-all border ${taken ? 'bg-success/20 border-success/50 text-success font-bold' : !inCycle ? 'bg-surface/20 border-border-custom/20 text-text-muted/30 line-through' : isToday ? 'bg-surface border-primary/40 text-primary' : 'bg-surface/40 border-border-custom/50 text-text-muted'}`}>
                  {taken ? '✓' : ''}
                </div>
                <span className={`text-3xs font-mono leading-none ${isToday ? 'text-primary font-bold' : 'text-text-muted'}`}>{formatShortDate(date).split('.')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
