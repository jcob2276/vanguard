import { useEffect, useState, useRef } from 'react';
import { Timer, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import { useHaptics } from '../../../hooks/useHaptics';
import { formatTime } from './morningUtils';

interface MeditationStepProps {
  onNext: () => void;
}

export default function MeditationStep({ onNext }: MeditationStepProps) {
  const haptics = useHaptics();
  const [meditationTime, setMeditationTime] = useState(15 * 60); // 15 minutes default in seconds
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setMeditationTime((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            if (timerRef.current) clearInterval(timerRef.current);
            playGong();
            haptics.success();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, haptics]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Web Audio Gong Synthesizer
  const playGong = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Fundamental deep gong (110Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(110, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 4);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 4);

      // Higher Overtone (220Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3);
      osc2.start(audioCtx.currentTime);
      osc2.stop(audioCtx.currentTime + 3);

      // Metallic shimmer (harmonic frequency around 440Hz)
      const osc3 = audioCtx.createOscillator();
      const gain3 = audioCtx.createGain();
      osc3.connect(gain3);
      gain3.connect(audioCtx.destination);
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain3.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain3.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
      osc3.start(audioCtx.currentTime);
      osc3.stop(audioCtx.currentTime + 2);
    } catch (e) {
      console.warn('Gong sound blocked or unsupported by browser:', e);
    }
  };

  const handleFinish = () => {
    setTimerActive(false);
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
          <Timer size={24} />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-xl font-black tracking-tight uppercase">
            KROK 3: MEDYTACJA
          </h3>
          <p className="text-xs text-text-muted leading-relaxed max-w-[280px] mx-auto">
            15 minut czystej, obiektywnej obserwacji własnych procesów myślowych. Poczuj niepewność i zaakceptuj ją.
          </p>
        </div>

        {/* Circular Timer Display */}
        <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
          <svg className="absolute w-full h-full transform -rotate-90">
            <circle
              cx="88"
              cy="88"
              r="80"
              className="stroke-border-custom fill-none"
              strokeWidth="3.5"
            />
            <circle
              cx="88"
              cy="88"
              r="80"
              className="stroke-primary fill-none transition-all duration-1000"
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 80}
              strokeDashoffset={2 * Math.PI * 80 * (1 - meditationTime / (15 * 60))}
              strokeLinecap="round"
            />
          </svg>
          <div className="z-10 flex flex-col items-center">
            <span className="font-display text-3xl font-black text-text-primary tracking-tight leading-none">
              {formatTime(meditationTime)}
            </span>
            <span className="text-[9px] uppercase font-bold text-text-muted mt-1.5 tracking-widest">
              pozostało
            </span>
          </div>
        </div>

        {/* Timer Controls */}
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => setMeditationTime((p) => Math.max(p - 60, 60))}
            disabled={timerActive}
            className="rounded-full border border-border-custom bg-surface px-3 py-1.5 text-[10px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-40 cursor-pointer"
          >
            -1 min
          </button>
          <button
            onClick={() => setTimerActive(!timerActive)}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
              timerActive ? 'bg-amber-500 shadow-amber-500/20' : 'bg-primary shadow-primary/20'
            }`}
          >
            {timerActive ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button
            onClick={() => {
              setTimerActive(false);
              setMeditationTime(15 * 60);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border-custom bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-solid transition-all cursor-pointer"
            title="Reset"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setMeditationTime((p) => p + 60)}
            disabled={timerActive}
            className="rounded-full border border-border-custom bg-surface px-3 py-1.5 text-[10px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-40 cursor-pointer"
          >
            +1 min
          </button>
        </div>

        <div className="pt-2">
          <button
            onClick={playGong}
            className="mx-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text-secondary cursor-pointer"
          >
            <Volume2 size={13} />
            <span>Testuj Gong 🔔</span>
          </button>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleFinish}
          className="flex-1 py-3.5 rounded-full border border-border-custom bg-surface text-text-secondary font-black text-[11px] uppercase tracking-wider hover:text-text-primary active:scale-98 transition-all cursor-pointer"
        >
          Pomiń timer
        </button>
        <button
          onClick={handleFinish}
          disabled={meditationTime > 0}
          className="flex-1 py-3.5 rounded-full bg-primary text-white font-black text-[11px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 transition-all cursor-pointer"
        >
          Ukończono 🧘
        </button>
      </div>
    </div>
  );
}
