/**
 * @component OuraBreathingBiofeedbackCard
 * @role Interaktywny trening oddechowy Box Breathing (4-4-4-4 / 4-7-8) do stymulacji nerwu błędnego przed snem.
 */
import { useState, useEffect } from 'react';
import { Wind, Play, Square } from 'lucide-react';

export function OuraBreathingBiofeedbackCard() {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'Wdech' | 'Wstrzymaj' | 'Wydech' | 'Pauza'>('Wdech');
  const [seconds, setSeconds] = useState(4);
  const [completedCycles, setCompletedCycles] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev > 1) return prev - 1;
        // Phase transition logic
        if (phase === 'Wdech') { setPhase('Wstrzymaj'); return 4; }
        if (phase === 'Wstrzymaj') { setPhase('Wydech'); return 4; }
        if (phase === 'Wydech') { setPhase('Pauza'); return 4; }
        if (phase === 'Pauza') {
          setPhase('Wdech');
          setCompletedCycles((c) => c + 1);
          return 4;
        }
        return 4;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, phase]);

  const toggleTimer = () => {
    setIsActive(!isActive);
    if (!isActive) {
      setPhase('Wdech');
      setSeconds(4);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/90 p-5 space-y-4 shadow-xl text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind size={18} className="text-sky-400" />
          <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">TRENING ODDECHOWY & BIOFEEDBACK HRV</h4>
        </div>
        <span className="text-3xs font-bold text-sky-400">Box Breathing 4-4-4-4</span>
      </div>

      {/* Pacer Visualizer Circle */}
      <div className="relative my-4 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div
            className={`h-36 w-36 rounded-full border-4 border-sky-400/40 bg-sky-500/10 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${
              isActive && phase === 'Wdech'
                ? 'scale-110 border-sky-400 bg-sky-500/30 shadow-glow'
                : isActive && phase === 'Wydech'
                ? 'scale-90 border-sky-600 bg-sky-950/40'
                : ''
            }`}
          >
            <span className="text-xs font-black uppercase tracking-widest text-sky-300">{phase}</span>
            <span className="text-4xl font-black text-white mt-1">{seconds}s</span>
          </div>
        </div>

        <p className="text-3xs font-bold text-slate-400 mt-3">Ukończone cykle: {completedCycles}</p>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-1">
        <button
          onClick={toggleTimer}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-xs transition-all cursor-pointer shadow-lg ${
            isActive
              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
              : 'bg-sky-500 text-slate-950 hover:bg-sky-400 font-black'
          }`}
        >
          {isActive ? <><Square size={14} /> Zakończ sesję</> : <><Play size={14} /> Rozpocznij oddech (Box Breathing)</>}
        </button>
      </div>
    </div>
  );
}
