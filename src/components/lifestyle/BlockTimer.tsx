import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Check,
  Zap,
  Coffee,
  CheckSquare
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';

interface BlockTimerProps {
  session: Session;
}

export default function BlockTimer({ session }: BlockTimerProps) {
  const haptics = useHaptics();
  const userId = session?.user?.id;

  // States: 'idle' | 'work' | 'break'
  const [timerMode, setTimerMode] = useState<'idle' | 'work' | 'break'>('idle');
  const [blockDuration, setBlockDuration] = useState(90 * 60); // Default 90 minutes in seconds
  const [breakDuration, setBreakDuration] = useState(15 * 60); // Default 15 minutes in seconds

  const [timeLeft, setTimeLeft] = useState(blockDuration);
  const [timerActive, setTimerActive] = useState(false);
  const [blockSubject, setBlockSubject] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load today's completed blocks from vanguard_stream
  const fetchTodayBlocks = async () => {
    if (!userId) return;
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      const { data } = await supabase
        .from('vanguard_stream')
        .select('id')
        .eq('user_id', userId)
        .eq('source', 'block_timer')
        .eq('category', 'productivity')
        .gte('created_at', today + 'T00:00:00.000Z');

      if (data) {
        setCompletedCount(data.length);
      }
    } catch (err) {
      console.error('Failed to load completed blocks:', err);
    }
  };

  useEffect(() => {
    fetchTodayBlocks();
  }, [userId]);

  // Timer tick logic
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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timerMode]);

  // Web Audio Gong
  const playGong = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(120, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 3);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(240, audioCtx.currentTime);
      gain2.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5);
      osc2.start(audioCtx.currentTime);
      osc2.stop(audioCtx.currentTime + 2.5);
    } catch (e) {
      console.warn('Gong sound blocked or unsupported by browser:', e);
    }
  };

  const handleTimerComplete = async () => {
    playGong();
    haptics.success();

    if (timerMode === 'work') {
      // Complete work block
      setIsSubmitting(true);
      try {
        const streamText = `[Blok Pracy] Ukończono 90-minutowy blok głębokiej pracy. Temat: "${blockSubject.trim() || 'Ogólna głęboka praca'}"`;
        await supabase.from('vanguard_stream').insert({
          user_id: userId,
          content: streamText,
          source: 'block_timer',
          category: 'productivity',
          classification: 'work_block_completion',
          metadata: {
            subject: blockSubject.trim() || 'Ogólna głęboka praca',
            duration_minutes: Math.round(blockDuration / 60)
          }
        });

        await fetchTodayBlocks();
        
        // Transition to Break Mode
        setTimerMode('break');
        setTimeLeft(breakDuration);
        setTimerActive(true); // Auto-start break
      } catch (err) {
        console.error('Error logging completed block:', err);
      } finally {
        setIsSubmitting(false);
      }
    } else if (timerMode === 'break') {
      // Complete break
      setTimerMode('idle');
      setTimeLeft(blockDuration);
      setBlockSubject('');
    }
  };

  const startTimer = () => {
    if (timerMode === 'idle') {
      setTimerMode('work');
      setTimeLeft(blockDuration);
    }
    setTimerActive(true);
    haptics.light();
  };

  const pauseTimer = () => {
    setTimerActive(false);
    haptics.light();
  };

  const resetTimer = () => {
    setTimerActive(false);
    setTimerMode('idle');
    setTimeLeft(blockDuration);
    setBlockSubject('');
    haptics.light();
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentMax = timerMode === 'break' ? breakDuration : blockDuration;
  const progressPercent = Math.min(((currentMax - timeLeft) / currentMax) * 100, 100);

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
          <div className="space-y-2">
            <p className="text-xs text-text-secondary leading-relaxed">
              Zdefiniuj cel dla najbliższego 90-minutowego bloku głębokiej pracy:
            </p>
            <input
              type="text"
              value={blockSubject}
              onChange={e => setBlockSubject(e.target.value)}
              placeholder="np. Refaktoryzacja bazy danych, pisanie artykułu..."
              className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-primary"
            />
          </div>

          {/* Duration Selectors */}
          <div className="flex justify-between items-center text-[10px] text-text-muted">
            <span>Długość bloku:</span>
            <div className="flex gap-2">
              {[50, 90, 120].map(mins => (
                <button
                  key={mins}
                  onClick={() => {
                    setBlockDuration(mins * 60);
                    setTimeLeft(mins * 60);
                    haptics.light();
                  }}
                  className={`rounded-lg border px-2.5 py-1 font-bold transition-all cursor-pointer ${
                    blockDuration === mins * 60
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border-custom hover:border-text-secondary'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startTimer}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
          >
            <Play size={11} fill="currentColor" className="ml-0.5 shrink-0" /> Uruchom Blok Pracy 🚀
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          {/* Active Mode Banner */}
          <div className="flex justify-center">
            {timerMode === 'work' ? (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">
                <Zap size={11} fill="currentColor" /> Głęboka Praca
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full">
                <Coffee size={11} /> Zmiana Kanału (Przerwa)
              </span>
            )}
          </div>

          {/* Subject Display */}
          {timerMode === 'work' && blockSubject.trim() && (
            <p className="font-display text-xs font-black text-text-primary truncate max-w-xs mx-auto">
              "{blockSubject}"
            </p>
          )}

          {timerMode === 'break' && (
            <p className="text-[11px] text-text-secondary leading-relaxed max-w-xs mx-auto">
              Idź na spacer, zrób pompki, zresetuj wzrok. Ogranicz reaktywność.
            </p>
          )}

          {/* Time & Progress */}
          <div className="relative mx-auto w-36 h-36 flex items-center justify-center">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="72" cy="72" r="64" className="stroke-border-custom fill-none" strokeWidth="3.5" />
              <circle
                cx="72"
                cy="72"
                r="64"
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

          {/* Controls */}
          <div className="flex justify-center items-center gap-2">
            {timerActive ? (
              <button
                onClick={pauseTimer}
                className="flex items-center gap-1.5 rounded-xl border border-border-custom bg-surface px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary active:scale-95 cursor-pointer"
              >
                <Pause size={13} /> Pauza
              </button>
            ) : (
              <button
                onClick={startTimer}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-white active:scale-95 cursor-pointer"
              >
                <Play size={13} fill="currentColor" className="ml-0.5 shrink-0" /> Wznów
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
