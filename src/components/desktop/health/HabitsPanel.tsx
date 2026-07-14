import { Plus, X, CheckSquare, Square, Trash2 } from 'lucide-react';
import { subDays } from 'date-fns';
import { getTodayWarsaw, formatWarsawDate } from '../../../lib/date';
import type { HabitRow, HabitLogRow } from '../../../lib/health/habitsApi';
import { Card } from '../../ui/Card';
import Button from '../../ui/Button';

interface NewHabit {
  name: string;
  icon: string;
  is_positive: boolean;
}

interface HabitsPanelProps {
  habits: HabitRow[];
  habitLogs: HabitLogRow[];
  isAddingHabit: boolean;
  setIsAddingHabit: React.Dispatch<React.SetStateAction<boolean>>;
  newHabit: NewHabit;
  setNewHabit: React.Dispatch<React.SetStateAction<NewHabit>>;
  addHabit: () => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (habitId: string) => void;
}

export default function HabitsPanel({
  habits,
  habitLogs,
  isAddingHabit,
  setIsAddingHabit,
  newHabit,
  setNewHabit,
  addHabit,
  deleteHabit,
  toggleHabit,
}: HabitsPanelProps) {
  return (
    <Card padding="1rem 1.25rem" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Nawyki</p>
          <p className="text-[8px] text-text-muted/70 mt-0.5">Kanoniczny log → habit_logs (Lenie = ten sam mechanizm co /lenie)</p>
        </div>
        <Button onClick={() => setIsAddingHabit(p => !p)} variant="tonal" size="sm" icon={<Plus size={10} />} className="uppercase tracking-widest">
          Dodaj
        </Button>
      </div>
      {isAddingHabit && (
        <Card variant="accent" padding="0.75rem" className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-primary">Nowy sygnał</p>
            <Button onClick={() => setIsAddingHabit(false)} variant="ghost" size="sm" className="!p-1 text-text-muted"><X size={13} /></Button>
          </div>
          <div className="grid grid-cols-[44px_1fr] gap-2">
            <input value={newHabit.icon} onChange={e => setNewHabit(p => ({ ...p, icon: e.target.value }))} className="rounded-lg border border-border-custom bg-surface p-2 text-center text-[13px] font-black text-text-primary outline-none focus:border-primary/50" placeholder="✅" />
            <input value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addHabit()} className="rounded-lg border border-border-custom bg-surface px-3 py-2 text-[11px] font-bold text-text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/50" placeholder="Nazwa" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setNewHabit(p => ({ ...p, is_positive: true }))} className={`rounded-lg border py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer ${newHabit.is_positive ? 'border-success/35 bg-success/10 text-success' : 'border-border-custom text-text-muted'}`}>Wzmacniać</button>
            <button onClick={() => setNewHabit(p => ({ ...p, is_positive: false }))} className={`rounded-lg border py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer ${!newHabit.is_positive ? 'border-danger/35 bg-danger/10 text-danger' : 'border-border-custom text-text-muted'}`}>Unikać</button>
          </div>
          <Button onClick={addHabit} variant="primary" size="sm" className="w-full uppercase tracking-widest">Dodaj</Button>
        </Card>
      )}
      <div className="space-y-2">
        {habits.map(habit => {
          const today = getTodayWarsaw();
          const doneToday = habitLogs.some(l => l.habit_id === habit.id && l.date === today);
          return (
            <div key={habit.id} className="group rounded-[14px] border border-border-custom bg-surface p-3 hover:border-primary/25 hover:shadow-sm transition-all duration-150">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14px] shrink-0">{habit.icon || '✅'}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black uppercase text-text-primary">{habit.name}</p>
                    <p className="text-[7px] font-bold uppercase tracking-widest text-text-muted">{habit.is_positive ? 'wzmacniać' : 'unikać'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleHabit(habit.id)} className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors cursor-pointer ${doneToday ? (habit.is_positive ? 'border-success bg-success text-white' : 'border-danger bg-danger text-white') : 'border-border-custom text-text-muted hover:text-text-primary'}`}>
                    {doneToday ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <button onClick={() => deleteHabit(habit.id)} className="p-1.5 text-text-muted/40 hover:text-danger rounded-lg cursor-pointer"><Trash2 size={11} /></button>
                </div>
              </div>
              <div className="flex h-2 gap-0.5 overflow-hidden">
                {Array.from({ length: 30 }).map((_, i) => {
                  const d = formatWarsawDate(subDays(new Date(), 29 - i));
                  const has = habitLogs.some(l => l.habit_id === habit.id && l.date === d);
                  const ok = habit.is_positive ? has : !has;
                  return <div key={d} className={`flex-1 rounded-sm ${d === today && !has ? 'border border-border-custom' : ok ? 'bg-success' : 'bg-danger'}`} />;
                })}
              </div>
            </div>
          );
        })}
        {habits.length === 0 && <p className="text-[9px] text-text-muted/50 text-center py-3">Brak nawyków — dodaj pierwszy</p>}
      </div>
    </Card>
  );
}
