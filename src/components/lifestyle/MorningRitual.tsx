import { useEffect, useState, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Flame, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useHaptics } from '../../hooks/useHaptics';
import { getTodayWarsaw } from '../../lib/date';
import {
  DEFAULT_DECLARATIONS,
  calculateStreak,
} from './morning/morningUtils';
import IntroStep from './morning/IntroStep';
import WakeupStep from './morning/WakeupStep';
import MirrorStep from './morning/MirrorStep';
import MeditationStep from './morning/MeditationStep';
import DeclarationsStep from './morning/DeclarationsStep';
import IntentionsStep from './morning/IntentionsStep';
import LightsStep from './morning/LightsStep';
import SummaryStep from './morning/SummaryStep';

interface MorningRitualProps {
  session: Session;
  onBack: () => void;
}

export default function MorningRitual({ session, onBack }: MorningRitualProps) {
  const haptics = useHaptics();
  const userId = session?.user?.id;

  // Step state: 'intro' | 'wakeup' | 'mirror' | 'meditation' | 'declarations' | 'intentions' | 'lights' | 'summary'
  const [step, setStep] = useState<
    'intro' | 'wakeup' | 'mirror' | 'meditation' | 'declarations' | 'intentions' | 'lights' | 'summary'
  >('intro');

  // Database settings loaded from vanguard_preferences
  const [declarations, setDeclarations] = useState<string[]>(DEFAULT_DECLARATIONS);
  const [ritualDates, setRitualDates] = useState<string[]>([]);
  const [intentions, setIntentions] = useState<string[]>(['', '', '', '', '', '', '']);
  const [, setIdealDay] = useState('');
  const [loadingData, setLoadingData] = useState(true);

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
          const decsPref = data.find((p) => p.key === 'morning_declarations');
          if (decsPref) {
            try {
              setDeclarations(JSON.parse(decsPref.value));
            } catch {
              /* malformed pref, ignore */
            }
          }

          const datesPref = data.find((p) => p.key === 'morning_ritual_dates');
          if (datesPref) {
            try {
              setRitualDates(JSON.parse(datesPref.value));
            } catch {
              /* malformed pref, ignore */
            }
          }

          const intentPref = data.find((p) => p.key === 'morning_current_intentions');
          if (intentPref) {
            try {
              const parsed = JSON.parse(intentPref.value);
              if (Array.isArray(parsed)) {
                // Ensure array has exactly 7 elements
                const filled = [...parsed, '', '', '', '', '', ''].slice(0, 7);
                setIntentions(filled);
              }
            } catch {
              /* malformed pref, ignore */
            }
          }

          const idealPref = data.find((p) => p.key === 'morning_ideal_day');
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

  // Save specific preference key
  const savePreference = async (key: string, value: string) => {
    if (!userId) return;
    try {
      await supabase.from('vanguard_preferences').upsert(
        { user_id: userId, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    } catch (err) {
      console.error(`Error saving preference ${key}:`, err);
    }
  };

  const handleUpdateDeclarations = async (newDecs: string[]) => {
    setDeclarations(newDecs);
    await savePreference('morning_declarations', JSON.stringify(newDecs));
  };

  // Complete Zwycięski Poranek
  const handleCompleteRitual = async () => {
    haptics.success();
    const today = getTodayWarsaw();

    // Add today if not already completed
    const newDates = [...ritualDates];
    if (!newDates.includes(today)) {
      newDates.push(today);
    }

    setRitualDates(newDates);

    // Save dates & intentions & answers to db
    await Promise.all([
      savePreference('morning_ritual_dates', JSON.stringify(newDates)),
      savePreference('morning_current_intentions', JSON.stringify(intentions.filter((i) => i.trim() !== ''))),
      savePreference(
        'morning_last_lights_answer',
        JSON.stringify({
          date: today,
          intention: intentions[dopamineIntentionIdx],
          answer: lightsAnswer,
        })
      ),
    ]);

    setStep('summary');
  };

  const currentStreak = useMemo(() => calculateStreak(ritualDates), [ritualDates]);

  // Handle step updates with light haptics
  const goToStep = (next: typeof step) => {
    haptics.light();
    setStep(next);
  };

  if (loadingData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-text-muted">
          Inicjowanie bloku egoizmu...
        </p>
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
            <h2 className="font-display text-xs font-black uppercase tracking-[0.2em] text-primary">
              Oświecony Egoizm
            </h2>
            <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">
              Poranne programowanie umysłu
            </p>
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
        {step === 'intro' && <IntroStep onStart={() => goToStep('wakeup')} />}

        {step === 'wakeup' && <WakeupStep onNext={() => goToStep('mirror')} />}

        {step === 'mirror' && (
          <MirrorStep
            declaration={declarations[0] || 'Jestem twórcą swojego życia.'}
            onNext={() => goToStep('meditation')}
          />
        )}

        {step === 'meditation' && <MeditationStep onNext={() => goToStep('declarations')} />}

        {step === 'declarations' && (
          <DeclarationsStep
            declarations={declarations}
            onUpdateDeclarations={handleUpdateDeclarations}
            onNext={() => goToStep('intentions')}
          />
        )}

        {step === 'intentions' && (
          <IntentionsStep
            intentions={intentions}
            setIntentions={setIntentions}
            dopamineIntentionIdx={dopamineIntentionIdx}
            setDopamineIntentionIdx={setDopamineIntentionIdx}
            onNext={() => goToStep('lights')}
          />
        )}

        {step === 'lights' && (
          <LightsStep
            mainIntention={intentions[dopamineIntentionIdx]}
            lightsAnswer={lightsAnswer}
            setLightsAnswer={setLightsAnswer}
            onComplete={handleCompleteRitual}
          />
        )}

        {step === 'summary' && (
          <SummaryStep
            mainIntention={intentions[dopamineIntentionIdx]}
            currentStreak={currentStreak}
            onBack={onBack}
          />
        )}
      </main>
    </div>
  );
}
