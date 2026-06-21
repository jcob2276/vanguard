import { getTodayWarsaw } from '../../lib/date';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Tables } from '../../lib/database.types';
import { Timer, Play, Pause, RotateCcw, Check, Zap, Coffee, CheckSquare, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';

interface BlockTimerProps {
  session: Session;
  todayWin?: Tables<'daily_wins'> | null;
}

const STORAGE_KEY = 'vanguard_block_timer_v1';

type Saved = {
  mode: 'work' | 'break';
  endTime: number | null;
  pausedTimeLeft: number | null;
  blockDuration: number;
  blockSubject: string;
  overrideSubject: boolean;
};

function saveTimer(s: Saved) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage unavailable/full */ }
}
function clearTimer() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
}
function loadTimer(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function BlockTimer({ session, todayWin }: BlockTimerProps) {
  const haptics = useHaptics();
  const userId = session?.user?.id;

  const [timerMode, setTimerMode] = useState<'idle' | 'work' | 'break'>('idle');
  const [blockDuration, setBlockDuration] = useState(90 * 60);
  const breakDuration = 15 * 60;
  const [timeLeft, setTimeLeft] = useState(90 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [blockSubject, setBlockSubject] = useState('');
  const [overrideSubject, setOverrideSubject] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredFromSave, setRestoredFromSave] = useState(false);

  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const modeRef   = useRef(timerMode);
  const subjectRef = useRef(blockSubject);
  const durationRef = useRef(blockDuration);

  useEffect(() => { modeRef.current = timerMode; }, [timerMode]);
  useEffect(() => { subjectRef.current = blockSubject; }, [blockSubject]);
  useEffect(() => { durationRef.current = blockDuration; }, [blockDuration]);

  const priorityTask = todayWin?.task_1 || null;

  // ── Restore from localStorage on mount ──
  useEffect(() => {
    const saved = loadTimer();
    if (!saved) return;

    setBlockDuration(saved.blockDuration);
    setBlockSubject(saved.blockSubject);
    setOverrideSubject(saved.overrideSubject);
    setRestoredFromSave(true);

    if (saved.endTime !== null) {
      const remaining = Math.round((saved.endTime - Date.now()) / 1000);
      if (remaining > 5) {
        setTimerMode(saved.mode);
        setTimeLeft(remaining);
        setTimerActive(true);
      } else {
        // Expired while phone was off — treat as completed, reset quietly
        clearTimer();
      }
    } else if (saved.pausedTimeLeft !== null) {
      setTimerMode(saved.mode);
      setTimeLeft(saved.pausedTimeLeft);
      setTimerActive(false);
    }
  }, []);

  // Pre-fill from priority task only when idle and no saved state
  useEffect(() => {
    if (priorityTask && !overrideSubject && timerMode === 'idle' && !restoredFromSave) {
      setBlockSubject(priorityTask);
    }
  }, [priorityTask, overrideSubject, timerMode, restoredFromSave]);

  // ── Persist state whenever it changes ──
  useEffect(() => {
    if (timerMode === 'idle') { clearTimer(); return; }
    saveTimer({
      mode: timerMode as 'work' | 'break',
      endTime: timerActive ? Date.now() + timeLeft * 1000 : null,
      pausedTimeLeft: timerActive ? null : timeLeft,
      blockDuration,
      blockSubject,
      overrideSubject,
    });
  }, [timerMode, timerActive, timeLeft, blockDuration, blockSubject, overrideSubject]);

  const fetchTodayBlocks = useCallback(async () => {
    if (!userId) return;
    try {
      const today = getTodayWarsaw();
      const { data } = await supabase
        .from('vanguard_stream').select('id')
        .eq('user_id', userId).eq('source', 'block_timer').eq('category', 'productivity')
        .gte('created_at', today + 'T00:00:00.000Z');
      if (data) setCompletedCount(data.length);
    } catch (err) {
      console.error('Failed to fetch today blocks:', err);
    }
  }, [userId]);

  useEffect(() => { fetchTodayBlocks(); }, [fetchTodayBlocks]);

  const playGong = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [[120, 0.5, 3], [240, 0.2, 2.5]].forEach(([freq, vol, dur]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + dur);
      });
    } catch { /* AudioContext unavailable/blocked */ }
  }, []);

  const handleTimerComplete = useCallback(async () => {
    playGong();
    haptics.success();
    const mode = modeRef.current;
    const subject = subjectRef.current;
    const dur = durationRef.current;

    if (mode === 'work') {
      setIsSubmitting(true);
      try {
        await supabase.from('vanguard_stream').insert({
          user_id: userId,
          content: `[Blok Pracy] Ukończono ${Math.round(dur / 60)}-minutowy blok. Temat: "${subject.trim() || 'Głęboka praca'}"`,
          source: 'block_timer',
          category: 'productivity',
          classification: 'work_block_completion',
          metadata: { subject: subject.trim() || 'Głęboka praca', duration_minutes: Math.round(dur / 60) },
        });
        await fetchTodayBlocks();
        setTimerMode('break');
        setTimeLeft(breakDuration);
        setTimerActive(true);
      } catch (err) {
        console.error('Failed to record completed work block:', err);
      } finally { setIsSubmitting(false); }
    } else {
      clearTimer();
      setTimerMode('idle');
      setTimeLeft(durationRef.current);
    }
  }, [playGong, haptics, userId, breakDuration, fetchTodayBlocks]);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            if (timerRef.current) clearInterval(timerRef.current);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, timerMode, handleTimerComplete]);

  const startTimer = () => {
    if (timerMode === 'idle') { setTimerMode('work'); setTimeLeft(blockDuration); }
    setTimerActive(true);
    haptics.light();
  };

  const resetTimer = () => {
    clearTimer();
    setTimerActive(false);
    setTimerMode('idle');
    setTimeLeft(blockDuration);
    setRestoredFromSave(false);
    if (!overrideSubject) setBlockSubject(priorityTask || '');
    haptics.light();
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentMax = timerMode === 'break' ? breakDuration : blockDuration;
  const progressPercent = Math.min(((currentMax - timeLeft) / currentMax) * 100, 100);
  const usingPriority = priorityTask && blockSubject === priorityTask && !overrideSubject;

  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer size={14} className="text-primary" />
          <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-text-muted">Praca Blokowa</h3>
        </div>
        {completedCount > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-500 text-[10px] font-black uppercase">
            <CheckSquare size={11} />
            <span>Dziś: {completedCount} {completedCount === 1 ? 'blok' : completedCount < 5 ? 'bloki' : 'bloków'}</span>
          </div>
        )}
      </div>

      <div className="my-4 border-t border-border-custom" />

      {timerMode === 'idle' ? (
        <div className="space-y-4">
          {usingPriority ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Blok na priorytet dnia</p>
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.03] px-3.5 py-2.5">
                <Zap size={12} className="shrink-0 text-primary" fill="currentColor" />
                <p className="flex-1 text-[12.5px] font-bold text-text-primary leading-snug truncate">{priorityTask}</p>
                <button
                  onClick={() => { setOverrideSubject(true); setBlockSubject(''); haptics.light(); }}
                  className="shrink-0 text-[9px] font-black uppercase tracking-wider text-text-muted hover:text-text-secondary cursor-pointer"
                >
                  Zmień
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Co robisz w tym bloku?</p>
                {priorityTask && overrideSubject && (
                  <button
                    onClick={() => { setOverrideSubject(false); setBlockSubject(priorityTask); haptics.light(); }}
                    className="flex items-center gap-1 text-[9px] font-bold text-primary hover:text-primary-hover cursor-pointer"
                  >
                    <X size={10} /> Wróć do priorytetu
                  </button>
                )}
              </div>
              <input
                type="text"
                value={blockSubject}
                onChange={e => setBlockSubject(e.target.value)}
                placeholder="np. Refaktoryzacja, pisanie artykułu..."
                className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-primary"
                autoFocus={overrideSubject}
              />
            </div>
          )}

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Długość bloku</span>
            <div className="grid grid-cols-3 gap-2">
              {[50, 90, 120].map(mins => (
                <button
                  key={mins}
                  onClick={() => { setBlockDuration(mins * 60); setTimeLeft(mins * 60); haptics.light(); }}
                  className={`rounded-[16px] border py-3 text-[13px] font-black transition-all cursor-pointer ${
                    blockDuration === mins * 60
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border-custom text-text-muted hover:border-text-secondary hover:text-text-secondary'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startTimer}
            disabled={!blockSubject.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-primary py-4 text-[13px] font-black uppercase tracking-wider text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={13} fill="currentColor" className="shrink-0" /> Uruchom Blok Pracy
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            {timerMode === 'work' ? (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">
                <Zap size={11} fill="currentColor" /> Głęboka Praca
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full">
                <Coffee size={11} /> Przerwa — zresetuj wzrok
              </span>
            )}
          </div>

          {timerMode === 'work' && blockSubject.trim() && (
            <p className="font-display text-xs font-black text-text-primary truncate max-w-xs mx-auto">
              "{blockSubject}"
            </p>
          )}

          {timerMode === 'break' && (
            <p className="text-[11px] text-text-secondary leading-relaxed max-w-xs mx-auto">
              Idź na spacer, zrób pompki, ogranicz reaktywność.
            </p>
          )}

          <div className="relative mx-auto w-36 h-36 flex items-center justify-center">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="72" cy="72" r="64" className="stroke-border-custom fill-none" strokeWidth="3.5" />
              <circle
                cx="72" cy="72" r="64"
                className={`fill-none transition-all duration-1000 ${timerMode === 'work' ? 'stroke-primary' : 'stroke-teal-500'}`}
                strokeWidth="4"
                strokeDasharray={2 * Math.PI * 64}
                strokeDashoffset={2 * Math.PI * 64 * (1 - progressPercent / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="z-10 flex flex-col items-center">
              <span className="font-display text-2xl font-black text-text-primary tracking-tight leading-none">
                {formatTime(timeLeft)}
              </span>
              <span className="text-[8px] uppercase font-bold text-text-muted mt-1 tracking-widest">
                {timerActive ? 'odliczanie' : 'pauza'}
              </span>
            </div>
          </div>

          <div className="flex justify-center items-center gap-2">
            {timerActive ? (
              <button
                onClick={() => { setTimerActive(false); haptics.light(); }}
                className="flex items-center gap-1.5 rounded-xl border border-border-custom bg-surface px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary active:scale-95 cursor-pointer"
              >
                <Pause size={13} /> Pauza
              </button>
            ) : (
              <button
                onClick={startTimer}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-white active:scale-95 cursor-pointer"
              >
                <Play size={13} fill="currentColor" className="ml-0.5" /> Wznów
              </button>
            )}
            <button
              onClick={resetTimer}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-custom bg-surface text-text-secondary hover:text-text-primary cursor-pointer"
              title="Reset"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleTimerComplete}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-40"
            >
              <Check size={13} strokeWidth={2.5} /> Pomiń
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
