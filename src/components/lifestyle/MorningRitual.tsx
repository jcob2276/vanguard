import { useEffect, useState, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Flame,
  Zap,
  User,
  Timer,
  BookOpen,
  Target,
  Check,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Edit,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';

const DEFAULT_DECLARATIONS = [
  "Mój głos tworzy mój świat – w mojej mowie nie ma nic przypadkowego.",
  "Jestem tym, który ufa sobie. Wybieram intencję i intuicję ponad reaktywność.",
  "Moje życie jest odbiciem tego, na co nakierowuję swoje neurony lustrzane.",
  "Nie muszę być gotowy. Po prostu robię to, co ma być zrobione w tej chwili.",
  "Stanę się dokładnie tym, czego od siebie oczekuję.",
  "Zachowuję się tak, jakby nie było żadnych ograniczeń dla moich możliwości."
];

interface MorningRitualProps {
  session: Session;
  onBack: () => void;
}

export default function MorningRitual({ session, onBack }: MorningRitualProps) {
  const haptics = useHaptics();
  const userId = session?.user?.id;

  // Step state: 'intro' | 'wakeup' | 'mirror' | 'meditation' | 'declarations' | 'intentions' | 'lights' | 'summary'
  const [step, setStep] = useState<'intro' | 'wakeup' | 'mirror' | 'meditation' | 'declarations' | 'intentions' | 'lights' | 'summary'>('intro');

  // Database settings loaded from vanguard_preferences
  const [declarations, setDeclarations] = useState<string[]>(DEFAULT_DECLARATIONS);
  const [ritualDates, setRitualDates] = useState<string[]>([]);
  const [intentions, setIntentions] = useState<string[]>(['', '', '', '', '', '', '']);
  const [idealDay, setIdealDay] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  // Meditation timer state
  const [meditationTime, setMeditationTime] = useState(15 * 60); // 15 minutes default in seconds
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Edit states
  const [editingDeclarations, setEditingDeclarations] = useState(false);
  const [newDeclarationText, setNewDeclarationText] = useState('');

  // Lights change exercise state
  const [dopamineIntentionIdx, setDopamineIntentionIdx] = useState<number>(0);
  const [lightsAnswer, setLightsAnswer] = useState('');

  // Load preferences from database
  useEffect(() => {
    if (!userId) return;

    const loadPrefs = async () => {
      try {
        const { data, error } = await supabase
          .from('vanguard_preferences')
          .select('key, value')
          .eq('user_id', userId);

        if (error) throw error;

        if (data) {
          const decsPref = data.find(p => p.key === 'morning_declarations');
          if (decsPref) {
            try { setDeclarations(JSON.parse(decsPref.value)); } catch {}
          }

          const datesPref = data.find(p => p.key === 'morning_ritual_dates');
          if (datesPref) {
            try { setRitualDates(JSON.parse(datesPref.value)); } catch {}
          }

          const intentPref = data.find(p => p.key === 'morning_current_intentions');
          if (intentPref) {
            try {
              const parsed = JSON.parse(intentPref.value);
              if (Array.isArray(parsed)) {
                // Ensure array has exactly 7 elements
                const filled = [...parsed, '', '', '', '', '', ''].slice(0, 7);
                setIntentions(filled);
              }
            } catch {}
          }

          const idealPref = data.find(p => p.key === 'morning_ideal_day');
          if (idealPref) {
            setIdealDay(idealPref.value);
          }
        }
      } catch (err) {
        console.error('Failed to load morning ritual preferences:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadPrefs();
  }, [userId]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer logic
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setMeditationTime(prev => {
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
  }, [timerActive]);

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

  // Save specific preference key
  const savePreference = async (key: string, value: string) => {
    if (!userId) return;
    try {
      await supabase
        .from('vanguard_preferences')
        .upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
    } catch (err) {
      console.error(`Error saving preference ${key}:`, err);
    }
  };

  // Complete Zwycięski Poranek
  const handleCompleteRitual = async () => {
    haptics.success();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    
    // Add today if not already completed
    let newDates = [...ritualDates];
    if (!newDates.includes(today)) {
      newDates.push(today);
    }
    
    setRitualDates(newDates);
    
    // Save dates & intentions & answers to db
    await Promise.all([
      savePreference('morning_ritual_dates', JSON.stringify(newDates)),
      savePreference('morning_current_intentions', JSON.stringify(intentions.filter(i => i.trim() !== ''))),
      savePreference('morning_last_lights_answer', JSON.stringify({
        date: today,
        intention: intentions[dopamineIntentionIdx],
        answer: lightsAnswer
      }))
    ]);

    setStep('summary');
  };

  // Calculate streak helper
  const calculateStreak = () => {
    if (ritualDates.length === 0) return 0;
    const sorted = [...ritualDates]
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime()); // Descending

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    
    // Check if streak is still valid (must contain today or yesterday)
    const formattedDates = sorted.map(d => d.toISOString().split('T')[0]);
    if (!formattedDates.includes(todayStr) && !formattedDates.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    let checkDate = new Date(formattedDates[0]); // Start from latest completed

    // If latest was yesterday and not today, start counting from yesterday
    if (formattedDates[0] === yesterdayStr && !formattedDates.includes(todayStr)) {
      checkDate = new Date(yesterdayStr);
    }

    for (let i = 0; i < formattedDates.length; i++) {
      const expectedStr = checkDate.toISOString().split('T')[0];
      if (formattedDates.includes(expectedStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  // Handle step updates with light haptics
  const goToStep = (next: typeof step) => {
    haptics.light();
    setStep(next);
  };

  // Declaration management handlers
  const saveEditedDeclarations = async () => {
    setEditingDeclarations(false);
    await savePreference('morning_declarations', JSON.stringify(declarations));
    haptics.success();
  };

  const removeDeclaration = (idx: number) => {
    setDeclarations(prev => prev.filter((_, i) => i !== idx));
  };

  const addDeclaration = () => {
    if (newDeclarationText.trim() === '') return;
    setDeclarations(prev => [...prev, newDeclarationText.trim()]);
    setNewDeclarationText('');
    haptics.light();
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loadingData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-text-muted">Inicjowanie bloku egoizmu...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border-custom bg-background/80 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={onBack}
            className="rounded-full p-2 text-text-secondary hover:bg-surface hover:text-text-primary active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="font-display text-xs font-black uppercase tracking-[0.2em] text-primary">Oświecony Egoizm</h2>
            <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">Poranne programowanie umysłu</p>
          </div>
        </div>
        {currentStreak > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary text-[10px] font-black uppercase tracking-wider">
            <Flame size={12} fill="currentColor" />
            <span>Passa: {currentStreak} dni</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 px-5 py-6 flex flex-col justify-between max-w-md mx-auto w-full pb-20">
        
        {/* STEP: INTRO */}
        {step === 'intro' && (
          <div className="flex-1 flex flex-col justify-center text-center space-y-7 my-auto">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/[0.06] border border-primary/10 text-primary shadow-[0_12px_24px_rgba(79,70,229,0.08)]">
              <Zap size={32} className="text-primary" fill="currentColor" />
            </div>
            <div className="space-y-2.5">
              <h3 className="font-display text-2xl font-black tracking-tight leading-none text-text-primary">ZWYCIĘSKI PORANEK</h3>
              <p className="text-[13px] text-text-secondary leading-relaxed max-w-[280px] mx-auto">
                Pierwsze 10 minut dnia należy wyłącznie do Ciebie. Zaprogramuj tożsamość, stwórz intencję i wygraj ten dzień.
              </p>
            </div>
            <div className="rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-4 max-w-xs mx-auto text-left space-y-1.5 text-xs text-text-secondary">
              <p className="font-bold uppercase text-[9px] tracking-widest text-text-muted mb-2">Instrukcja bloku:</p>
              <p className="flex gap-2"><span>1.</span> Wyskakujesz z łóżka (Pobudka)</p>
              <p className="flex gap-2"><span>2.</span> Deklaracja przed lustrem (Tożsamość)</p>
              <p className="flex gap-2"><span>3.</span> Medytacja & Obserwacja (15 min)</p>
              <p className="flex gap-2"><span>4.</span> Odczytanie deklaracji tożsamości</p>
              <p className="flex gap-2"><span>5.</span> Przepisanie intencji & Zmiana Świateł</p>
            </div>
            <button
              onClick={() => goToStep('wakeup')}
              className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/25 hover:bg-primary-hover active:scale-98 transition-all cursor-pointer"
            >
              Rozpocznij Rytuał ⚡
            </button>
          </div>
        )}

        {/* STEP: WAKEUPS */}
        {step === 'wakeup' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex-1 flex flex-col justify-center text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
                <Flame size={24} fill="currentColor" />
              </div>
              <div className="space-y-3">
                <h3 className="font-display text-xl font-black tracking-tight uppercase">KROK 1: POBUDKA</h3>
                <p className="text-[20px] font-black text-text-primary leading-tight font-display max-w-[280px] mx-auto">
                  Entuzjastycznie wyskakujesz z łóżka!
                </p>
                <p className="text-xs text-text-muted leading-relaxed max-w-[260px] mx-auto">
                  Nie analizuj. Nie sprawdzaj telefonu. Poczuj natychmiastową decyzję o działaniu. Twoja fizjologia dyktuje Twój stan.
                </p>
              </div>
            </div>
            <button
              onClick={() => goToStep('mirror')}
              className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest active:scale-98 transition-all cursor-pointer"
            >
              Wyskoczyłem! ⚡
            </button>
          </div>
        )}

        {/* STEP: MIRROR */}
        {step === 'mirror' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex-1 flex flex-col justify-center text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <User size={24} />
              </div>
              <div className="space-y-3">
                <h3 className="font-display text-xl font-black tracking-tight uppercase">KROK 2: IDŹ DO LUSTRA</h3>
                <p className="text-[14px] text-text-secondary leading-relaxed max-w-[280px] mx-auto">
                  Spójrz na siebie i powiedz na głos najważniejsze zdanie z Twojej deklaracji tożsamości:
                </p>
                <div className="py-4.5 px-5 border-l-4 border-primary/50 bg-primary/[0.03] dark:bg-primary/[0.05] rounded-r-2xl max-w-sm mx-auto my-4 text-left shadow-sm">
                  <p className="font-display text-[15px] font-black text-text-primary leading-relaxed italic">
                    "{declarations[0] || 'Jestem twórcą swojego życia.'}"
                  </p>
                </div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">
                  Wypowiedz to z pewnością, bez szukania dowodów.
                </p>
              </div>
            </div>
            <button
              onClick={() => goToStep('meditation')}
              className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest active:scale-98 transition-all cursor-pointer"
            >
              Wypowiedziane! 🗣️
            </button>
          </div>
        )}

        {/* STEP: MEDITATION */}
        {step === 'meditation' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex-1 flex flex-col justify-center text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                <Timer size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-xl font-black tracking-tight uppercase">KROK 3: MEDYTACJA</h3>
                <p className="text-xs text-text-muted leading-relaxed max-w-[280px] mx-auto">
                  15 minut czystej, obiektywnej obserwacji własnych procesów myślowych. Poczuj niepewność i zaakceptuj ją.
                </p>
              </div>

              {/* Circular Timer Display */}
              <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
                {/* SVG background circle & animated countdown */}
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
                  onClick={() => setMeditationTime(p => Math.max(p - 60, 60))}
                  disabled={timerActive}
                  className="rounded-full border border-border-custom bg-surface px-3 py-1.5 text-[10px] font-bold text-text-secondary hover:text-text-primary disabled:opacity-40 cursor-pointer"
                >
                  -1 min
                </button>
                <button
                  onClick={() => setTimerActive(!timerActive)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
                    timerActive 
                      ? 'bg-amber-500 shadow-amber-500/20' 
                      : 'bg-primary shadow-primary/20'
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
                  onClick={() => setMeditationTime(p => p + 60)}
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
                onClick={() => {
                  setTimerActive(false);
                  goToStep('declarations');
                }}
                className="flex-1 py-3.5 rounded-full border border-border-custom bg-surface text-text-secondary font-black text-[11px] uppercase tracking-wider hover:text-text-primary active:scale-98 transition-all cursor-pointer"
              >
                Pomiń timer
              </button>
              <button
                onClick={() => {
                  setTimerActive(false);
                  goToStep('declarations');
                }}
                disabled={meditationTime > 0}
                className="flex-1 py-3.5 rounded-full bg-primary text-white font-black text-[11px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 transition-all cursor-pointer"
              >
                Ukończono 🧘
              </button>
            </div>
          </div>
        )}

        {/* STEP: DECLARATIONS */}
        {step === 'declarations' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-5 flex-1 flex flex-col overflow-hidden">
              <header className="text-center space-y-1.5 shrink-0">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <BookOpen size={20} />
                </div>
                <h3 className="font-display text-lg font-black tracking-tight uppercase mt-2">KROK 4: DEKLARACJE TOŻSAMOŚCI</h3>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                  Odczytaj na głos z pełnym zaangażowaniem
                </p>
              </header>

              {/* Declarations Scrollable List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[300px]">
                {editingDeclarations ? (
                  <div className="space-y-3">
                    {declarations.map((dec, idx) => (
                      <div key={idx} className="flex gap-2 items-start bg-surface p-2.5 rounded-xl border border-border-custom">
                        <textarea
                          value={dec}
                          onChange={e => {
                            const val = e.target.value;
                            setDeclarations(prev => prev.map((d, i) => i === idx ? val : d));
                          }}
                          className="flex-1 bg-transparent text-xs text-text-primary outline-none resize-none"
                          rows={2}
                        />
                        <button
                          onClick={() => removeDeclaration(idx)}
                          className="text-red-400 hover:text-red-500 p-1 cursor-pointer"
                          title="Usuń"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="border-t border-border-custom/50 pt-3 space-y-2">
                      <p className="text-[9px] uppercase font-bold text-text-muted">Dodaj nową deklarację:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDeclarationText}
                          onChange={e => setNewDeclarationText(e.target.value)}
                          placeholder="Jestem..."
                          className="flex-1 rounded-xl border border-border-custom bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
                        />
                        <button
                          onClick={addDeclaration}
                          className="rounded-xl bg-primary px-3 text-white cursor-pointer"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {declarations.map((dec, idx) => (
                      <div key={idx} className="flex gap-3 items-start p-3 bg-surface border border-border-custom/50 rounded-2xl shadow-sm hover:border-border-custom transition-all">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-black font-display mt-0.5">
                          {idx + 1}
                        </div>
                        <p className="text-xs leading-relaxed text-text-primary font-medium">{dec}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit Trigger Button */}
              <div className="shrink-0 flex justify-end">
                {editingDeclarations ? (
                  <button
                    onClick={saveEditedDeclarations}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-500 hover:text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full cursor-pointer"
                  >
                    <Check size={12} />
                    <span>Zapisz zmiany</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setEditingDeclarations(true); haptics.light(); }}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-secondary bg-surface p-2 rounded-full border border-border-custom/80 cursor-pointer"
                  >
                    <Edit size={11} />
                    <span>Edytuj deklaracje</span>
                  </button>
                )}
              </div>
            </div>
            
            <button
              onClick={() => goToStep('intentions')}
              disabled={editingDeclarations}
              className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed mt-4 active:scale-98 transition-all cursor-pointer"
            >
              Odczytane! 📖
            </button>
          </div>
        )}

        {/* STEP: INTENTIONS */}
        {step === 'intentions' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-5 flex-1 flex flex-col overflow-hidden">
              <header className="text-center space-y-1 shrink-0">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Target size={20} />
                </div>
                <h3 className="font-display text-lg font-black tracking-tight uppercase mt-2">KROK 5: 7 PORANNYCH INTENCJI</h3>
                <p className="text-[10px] text-text-muted leading-relaxed max-w-[280px] mx-auto">
                  Przepisz je odręcznie na kartce w czasie teraźniejszym. Wpisz je tutaj i wybierz jedną do dopaminizacji.
                </p>
              </header>

              {/* Digital Inputs */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[320px]">
                {intentions.map((intent, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    {/* Index or Dopamine Target Selector */}
                    <button
                      onClick={() => { setDopamineIntentionIdx(idx); haptics.light(); }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black font-display transition-all cursor-pointer ${
                        dopamineIntentionIdx === idx
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 scale-110'
                          : 'bg-surface border border-border-custom text-text-muted hover:border-amber-500/40 hover:text-amber-500'
                      }`}
                      title={dopamineIntentionIdx === idx ? 'Główna intencja dnia (Dopaminowana)' : 'Oznacz jako główną'}
                    >
                      {dopamineIntentionIdx === idx ? <Sparkles size={11} fill="currentColor" /> : idx + 1}
                    </button>
                    {/* Input Field */}
                    <input
                      type="text"
                      value={intent}
                      onChange={e => {
                        const val = e.target.value;
                        setIntentions(prev => prev.map((item, i) => i === idx ? val : item));
                      }}
                      placeholder={`Intencja #${idx + 1}`}
                      className={`flex-1 rounded-xl border bg-surface px-3.5 py-2.5 text-xs text-text-primary outline-none transition-all ${
                        dopamineIntentionIdx === idx
                          ? 'border-amber-500/40 bg-amber-500/[0.02] focus:border-amber-500'
                          : 'border-border-custom/80 focus:border-primary'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                // Find chosen intention text
                const activeText = intentions[dopamineIntentionIdx]?.trim();
                if (!activeText) {
                  alert('Wpisz tekst dla wybranej intencji głównej, aby przejść do Zmiany Świateł.');
                  return;
                }
                goToStep('lights');
              }}
              className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest mt-4 active:scale-98 transition-all cursor-pointer"
            >
              Przepisane! Przejdź do Zmiany Świateł ⚡
            </button>
          </div>
        )}

        {/* STEP: LIGHTS */}
        {step === 'lights' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex-1 flex flex-col justify-center text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-[0_8px_20px_rgba(245,158,11,0.1)] animate-pulse">
                <Sparkles size={26} fill="currentColor" />
              </div>
              <div className="space-y-3">
                <h3 className="font-display text-xl font-black tracking-tight uppercase">ĆWICZENIE: ZMIANA ŚWIATEŁ</h3>
                <div className="bg-surface border border-amber-500/20 rounded-2xl p-4.5 max-w-sm mx-auto text-left shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Intencja główna:</p>
                  <p className="mt-1 font-display text-[15px] font-black text-text-primary leading-snug">
                    {intentions[dopamineIntentionIdx]}
                  </p>
                </div>
                
                <p className="text-xs text-text-secondary leading-relaxed max-w-[280px] mx-auto pt-2">
                  Zadaj sobie pytanie i wpisz odpowiedź:
                </p>
                <p className="font-display text-[13.5px] font-black text-text-primary italic leading-snug max-w-[280px] mx-auto">
                  "Jakie nowe ekscytujące możliwości otworzą się przede mną, gdy to zrealizuję?"
                </p>

                <textarea
                  value={lightsAnswer}
                  onChange={e => setLightsAnswer(e.target.value)}
                  placeholder="Wyobraź to sobie tak, jakby to JUŻ BYŁO WYKONANE. Poczuj to fizycznie na ciele (gęsia skórka, motyle w brzuchu). Wpisz co czujesz..."
                  rows={4}
                  className="w-full max-w-sm mx-auto rounded-xl border border-border-custom bg-surface p-4 text-xs text-text-primary outline-none focus:border-amber-500 resize-none leading-relaxed mt-2"
                />
                
                <p className="text-[9px] uppercase font-bold text-text-muted leading-relaxed max-w-[240px] mx-auto mt-2">
                  Celem jest połączenie neuro-aktywacji z wyrzutem dopaminy w Twoim ciele.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleCompleteRitual}
              disabled={lightsAnswer.trim().length < 5}
              className="w-full py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm uppercase tracking-widest disabled:opacity-40 disabled:from-gray-500 disabled:to-gray-500 mt-4 shadow-lg shadow-amber-500/10 active:scale-98 transition-all cursor-pointer"
            >
              Zakończ i Zwyciężaj! 🏆
            </button>
          </div>
        )}

        {/* STEP: SUMMARY */}
        {step === 'summary' && (
          <div className="flex-1 flex flex-col justify-center text-center space-y-7 my-auto">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_12px_24px_rgba(16,185,129,0.12)]">
              <Check size={36} strokeWidth={3} />
            </div>
            <div className="space-y-2.5">
              <h3 className="font-display text-2xl font-black tracking-tight leading-none text-emerald-500">PORANEK WYGRANY!</h3>
              <p className="text-[13px] text-text-secondary leading-relaxed max-w-[280px] mx-auto">
                Wykonałeś pełny blok egoizmu. Ustawiłeś intencję główną i przełączyłeś neurologię w tryb tworzenia.
              </p>
            </div>
            
            <div className="rounded-2xl border border-border-custom bg-surface backdrop-blur-md p-5 max-w-sm mx-auto text-left space-y-3.5 shadow-sm">
              <div className="flex justify-between items-center border-b border-border-custom/50 pb-2">
                <span className="text-[10px] uppercase font-bold text-text-muted">Status Dnia:</span>
                <span className="text-[11px] font-black text-emerald-500 uppercase">AKTYWNY / TWÓRCZY</span>
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-text-muted">Twoja intencja na dziś:</p>
                <p className="font-display text-[13px] font-bold text-text-primary mt-1">
                  {intentions[dopamineIntentionIdx]}
                </p>
              </div>
              {currentStreak > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 border border-orange-500/10 p-2.5 text-orange-500 text-[11px] font-bold">
                  <Flame size={14} fill="currentColor" />
                  <span>Passa wygranych poranków: {currentStreak} dni z rzędu! 🔥</span>
                </div>
              )}
            </div>

            <button
              onClick={onBack}
              className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/10 active:scale-98 transition-all cursor-pointer"
            >
              Powrót do Dashboardu
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
