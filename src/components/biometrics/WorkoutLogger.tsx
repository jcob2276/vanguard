import { ChevronLeft, Save, Dumbbell, Clock, Play, Square, Plus } from 'lucide-react';
import { useWorkoutLogger } from './hooks/useWorkoutLogger';
import { type WorkoutLoggerInitial } from '../../lib/health/workoutLogging';
import ExerciseCard from './workout/ExerciseCard';
import VolumeBar from './workout/VolumeBar';
import PlyoBlock from './workout/PlyoBlock';
import { useUserId } from '../../store/useStore';
import { isPlyoSessionComplete } from '../../lib/health/plyoMarathonProgram';

interface ManualTimePickerProps {
  logger: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function ManualTimePicker({ logger }: ManualTimePickerProps) {
  return (
    <div className="rounded-[24px] border border-border-custom bg-surface p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-text-muted" />
          <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary">Wpisz godziny ręcznie</span>
        </div>
        <input
          type="checkbox"
          checked={logger.manualTime}
          onChange={(event) => {
            logger.setManualTime(event.target.checked);
            if (event.target.checked && logger.timerStart) {
              logger.setTimerStart(null);
            }
          }}
          className="accent-primary h-4 w-4 rounded border-border-custom bg-surface-solid cursor-pointer"
        />
      </div>

      {logger.manualTime && (
        <div className="grid grid-cols-3 gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Data</label>
            <input
              type="date"
              value={logger.workoutDate}
              onChange={(e) => logger.setWorkoutDate(e.target.value)}
              className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Start</label>
            <input
              type="time"
              value={logger.startTimeManual}
              onChange={(e) => logger.setStartTimeManual(e.target.value)}
              className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Koniec</label>
            <input
              type="time"
              value={logger.endTimeManual}
              onChange={(e) => logger.setEndTimeManual(e.target.value)}
              className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkoutLogger({
  onBack,
  initial,
  onSaved,
}: {
  onBack: () => void;
  initial?: WorkoutLoggerInitial | null;
  onSaved?: () => void;
}) {
  const userId = useUserId();
  const logger = useWorkoutLogger({ initial, onSaved, onBack });

  return (
    <div className="flex-grow bg-background flex flex-col min-h-screen pb-32 transition-colors duration-300">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border-custom p-4 flex items-center gap-3">
        <button onClick={logger.handleBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary flex-1 font-display">Zaloguj Trening</h1>
        {logger.timerStart ? (
          <button onClick={() => logger.setTimerStart(null)} className="flex items-center gap-1.5 text-primary hover:text-primary-hover transition-colors cursor-pointer">
            <span className="text-[11px] font-black tabular-nums">{logger.elapsed}</span>
            <Square size={11} className="fill-current" />
          </button>
        ) : (
          <button onClick={() => logger.setTimerStart(Date.now())} className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <Play size={13} className="fill-current" />
            <span className="text-[10px] font-black uppercase tracking-widest">Start</span>
          </button>
        )}
      </header>

      <main className="flex-1 p-5 space-y-8 max-w-md mx-auto w-full">
        {!logger.plyoSkipped && logger.plyoSession && logger.plyoDone.length > 0 && !isPlyoSessionComplete(logger.plyoDone) && (
          <PlyoBlock
            session={logger.plyoSession}
            done={logger.plyoDone}
            onToggleSet={logger.togglePlyoSet}
            onSkip={() => {
              logger.setPlyoSkipped(true);
            }}
          />
        )}

        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Nazwa (opcjonalnie)</label>
          <input type="text" value={logger.workoutName} onChange={e => logger.setWorkoutName(e.target.value)}
            placeholder="np. Push, Nogi, Plecy/Bicep..."
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm font-bold text-text-primary outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all placeholder:text-text-muted/40" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell size={12} className="text-text-muted" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Ćwiczenia</span>
          </div>
          {logger.exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onChange={logger.updateExercise} onRemove={() => logger.removeExercise(ex.id)} userId={userId} />
          ))}
          <button onClick={logger.addExercise}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-custom bg-surface hover:bg-surface-solid hover:border-primary/45 p-3.5 text-[10px] font-black uppercase tracking-widest text-text-secondary transition-all cursor-pointer">
            <Plus size={13} /> Dodaj ćwiczenie
          </button>
          <VolumeBar exercises={logger.exercises} />
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Notatki</label>
          <textarea value={logger.notes} onChange={e => logger.setNotes(e.target.value)} placeholder="Jak poszło?..."
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm text-text-primary min-h-[100px] outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all resize-none placeholder:text-text-muted/40" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">RPE sesji</label>
            {logger.sessionRpe && (
              <button onClick={() => logger.setSessionRpe(null)} className="text-[9px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer">wyczyść</button>
            )}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const color = n <= 4 ? 'border-sky-500/30 dark:border-sky-500/40 text-sky-650 dark:text-sky-400 bg-sky-500/8 dark:bg-sky-500/15 hover:bg-sky-500/20'
                          : n <= 6 ? 'border-yellow-500/35 dark:border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/8 dark:bg-yellow-500/15 hover:bg-yellow-500/20'
                          : n <= 8 ? 'border-orange-500/35 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/8 dark:bg-orange-500/15 hover:bg-orange-500/20'
                          : 'border-dayB/35 dark:border-dayB/40 text-dayB bg-dayB/8 dark:bg-dayB/15 hover:bg-dayB/20';
              const active = logger.sessionRpe === n ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100 scale-105 shadow-sm' : 'opacity-80 hover:opacity-100';
              return (
                <button key={n} onClick={() => logger.setSessionRpe(logger.sessionRpe === n ? null : n)}
                  className={`rounded-lg border py-2 text-[11px] font-black transition-all cursor-pointer ${color} ${active}`}>
                  {n}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-text-muted">
            {logger.sessionRpe ? (logger.sessionRpe <= 4 ? 'Łatwa — dużo rezerwy' : logger.sessionRpe <= 6 ? 'Umiarkowana' : logger.sessionRpe <= 8 ? 'Ciężka — mało rezerwy' : 'Maksymalna — do oporu') : 'Jak ciężka była cała sesja?'}
          </p>
        </div>

        {/* Manual Time Picker Row */}
        <ManualTimePicker logger={logger} />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border-custom space-y-3 z-30">
        {(() => {
          const totalVol = logger.exercises.reduce((sum, ex) => {
            if ((ex.tags || []).includes('wellness')) return sum;
            const exVol = (ex.sets || []).reduce((sSum, s) => sSum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0);
            return sum + exVol;
          }, 0);
          if (totalVol === 0) return null;
          return (
            <div className="flex justify-between items-center px-1 max-w-md mx-auto w-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Suma Objętości:</span>
              <span className="text-[12px] font-black text-primary tracking-wide font-display">{totalVol.toLocaleString()} kg</span>
            </div>
          );
        })()}
        <div className="max-w-md mx-auto w-full">
          <button onClick={logger.save} disabled={logger.saving}
            className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform hover:bg-primary-hover cursor-pointer">
            <Save size={15} />
            {logger.saving ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
      </footer>
    </div>
  );
}
