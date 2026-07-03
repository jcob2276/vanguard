import { useEffect, useMemo, useState } from 'react';
import { X, Clock, CheckCircle2, Send, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCalendarWrite } from '../../hooks/useCalendarWrite';

interface Props {
  session: any;
  onClose: () => void;
}

interface TodoSlot {
  id: string;
  title: string;
  priority: string;
  duration_minutes: number | null;
  due_date: string | null;
  scheduled_time: string | null;
  status: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-rose-500',
  high: 'text-orange-400',
  normal: 'text-primary',
  low: 'text-text-muted',
};

const CAPACITY_HOURS = 8;

function todayStr() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function warsawIso(date: string, timeStr: string) {
  return `${date}T${timeStr}:00+02:00`;
}

function addMinutes(timeStr: string, minutes: number) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function MorningPlanModal({ session, onClose }: Props) {
  const userId = session?.user?.id as string | undefined;
  const accessToken = session?.access_token as string | undefined;
  const today = todayStr();

  const [tasks, setTasks] = useState<TodoSlot[]>([]);
  const [times, setTimes] = useState<Record<string, string>>({}); // taskId → "HH:MM"
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const { createEvent } = useCalendarWrite({ userId, accessToken });

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('todo_items')
          .select('id, title, priority, duration_minutes, due_date, scheduled_time, status')
          .eq('user_id', userId)
          .eq('status', 'open')
          .or(`due_date.eq.${today},ai_bucket.eq.today`)
          .order('priority', { ascending: true });
        setTasks((data as TodoSlot[]) || []);
        const preset: Record<string, string> = {};
        ((data as TodoSlot[]) || []).forEach((t) => {
          if (t.scheduled_time) {
            preset[t.id] = t.scheduled_time.split('T')[1]?.slice(0, 5) || '';
          }
        });
        setTimes(preset);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, today]);

  const totalMinutesPlanned = useMemo(() => {
    return tasks.reduce((sum, t) => {
      if (!times[t.id]) return sum;
      return sum + (t.duration_minutes || 30);
    }, 0);
  }, [tasks, times]);

  const capacityPct = Math.min(100, Math.round((totalMinutesPlanned / (CAPACITY_HOURS * 60)) * 100));

  const scheduledCount = Object.values(times).filter(Boolean).length;

  async function sendToCalendar() {
    setSending(true);
    const toSend = tasks.filter((t) => times[t.id]);
    const newSent = new Set(sent);
    for (const task of toSend) {
      if (sent.has(task.id)) continue;
      const startTime = times[task.id];
      const dur = task.duration_minutes || 30;
      const endTime = addMinutes(startTime, dur);
      try {
        await createEvent({
          summary: task.title,
          start: warsawIso(today, startTime),
          end: warsawIso(today, endTime),
          category: 'work',
        });
        // Update scheduled_time in DB
        await supabase
          .from('todo_items')
          .update({ scheduled_time: warsawIso(today, startTime) })
          .eq('id', task.id);
        newSent.add(task.id);
        setSent(new Set(newSent));
      } catch (e) {
        console.error('Failed to schedule task', task.id, e);
      }
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative mt-auto w-full max-w-md mx-auto rounded-t-3xl bg-background border-t border-border-custom shadow-2xl flex flex-col max-h-[90vh]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border-custom/60" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-custom/20">
          <div>
            <h2 className="text-[16px] font-black text-text-primary">Zaplanuj dzień</h2>
            <p className="text-[10px] text-text-muted mt-0.5">
              {today} · {scheduledCount}/{tasks.length} zaplanowanych
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Capacity bar */}
        <div className="px-5 py-3 border-b border-border-custom/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Pojemność dnia</span>
            <span className={`text-[10px] font-black ${capacityPct > 100 ? 'text-rose-500' : 'text-primary'}`}>
              {Math.round(totalMinutesPlanned / 60 * 10) / 10}h / {CAPACITY_HOURS}h
            </span>
          </div>
          <div className="h-2 rounded-full bg-border-custom/30 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${capacityPct > 90 ? 'bg-rose-500' : capacityPct > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <CheckCircle2 size={28} className="text-emerald-400" />
              <p className="text-[13px] font-bold text-text-muted">Brak zadań na dziś</p>
            </div>
          ) : (
            tasks.map((task) => {
              const isSent = sent.has(task.id);
              const hasTime = !!times[task.id];
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all ${
                    isSent
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : hasTime
                      ? 'border-primary/20 bg-primary/5'
                      : 'border-border-custom/40 bg-surface-solid/30'
                  }`}
                >
                  {/* Priority dot */}
                  <span className={`text-[9px] font-black ${PRIORITY_COLORS[task.priority] || 'text-text-muted'}`}>
                    {task.priority === 'urgent' ? '!!' : task.priority === 'high' ? '!' : '·'}
                  </span>

                  {/* Title + duration */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-text-primary line-clamp-1">{task.title}</p>
                    {task.duration_minutes && (
                      <p className="text-[9px] text-amber-500 font-semibold mt-0.5">
                        <Clock size={8} className="inline mr-0.5" />
                        {task.duration_minutes < 60
                          ? `${task.duration_minutes}min`
                          : `${Math.floor(task.duration_minutes / 60)}h${task.duration_minutes % 60 ? task.duration_minutes % 60 + 'min' : ''}`}
                      </p>
                    )}
                  </div>

                  {/* Time picker */}
                  {isSent ? (
                    <span className="text-[10px] font-black text-emerald-500">✓ Wysłano</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        value={times[task.id] || ''}
                        onChange={(e) => setTimes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        className="rounded-xl border border-border-custom/60 bg-surface-solid/50 px-2 py-1.5 text-[11px] font-bold text-text-primary outline-none focus:border-primary/40 cursor-pointer"
                        style={{ width: 90 }}
                      />
                      {times[task.id] && (
                        <button
                          onClick={() => setTimes((prev) => { const n = { ...prev }; delete n[task.id]; return n; })}
                          className="p-1 text-text-muted/60 hover:text-rose-400 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {tasks.length > 0 && (
          <div className="px-5 py-4 border-t border-border-custom/20">
            <button
              onClick={sendToCalendar}
              disabled={sending || scheduledCount === 0}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-white py-3.5 text-[13px] font-black disabled:opacity-40 transition-all hover:bg-primary/90 active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              <Send size={16} />
              {sending
                ? 'Wysyłam do kalendarza...'
                : `Wyślij ${scheduledCount} zadań do kalendarza`}
            </button>
            <button onClick={onClose} className="w-full mt-2 py-2 text-[12px] font-semibold text-text-muted hover:text-text-primary transition-colors">
              Zamknij bez wysyłania
            </button>
          </div>
        )}
        {tasks.length === 0 && (
          <div className="px-5 py-4">
            <button onClick={onClose} className="w-full py-3 text-[12px] font-semibold text-text-muted hover:text-text-primary transition-colors">
              Zamknij
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
