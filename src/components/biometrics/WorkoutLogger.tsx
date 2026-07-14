import { Pressable, ControlInput, ControlTextarea } from '../ui/ControlPrimitives';
import { ChevronLeft, Save, Dumbbell, Clock, Play, Square, Plus } from 'lucide-react';
import { useWorkoutLogger } from './hooks/useWorkoutLogger';
import { Card } from '../ui/Card';
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
    <Card variant="glass" className="border border-border-custom space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-text-muted" />
          <span className="text-xs font-black uppercase tracking-wider text-text-secondary">Wpisz godziny ręcznie</span>
        </div>
        <ControlInput
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
        <div className="grid grid-cols-3 gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-[var(--motion-medium)]">
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase tracking-widest text-text-muted">Data</label>
            <ControlInput
              type="date"
              value={logger.workoutDate}
              onChange={(e) => logger.setWorkoutDate(e.target.value)}
              className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase tracking-widest text-text-muted">Start</label>
            <ControlInput
              type="time"
              value={logger.startTimeManual}
              onChange={(e) => logger.setStartTimeManual(e.target.value)}
              className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-black uppercase tracking-widest text-text-muted">Koniec</label>
            <ControlInput
              type="time"
              value={logger.endTimeManual}
              onChange={(e) => logger.setEndTimeManual(e.target.value)}
              className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
            />
          </div>
        </div>
      )}
    </Card>
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
    <div className="flex-grow bg-background flex flex-col min-h-screen pb-32 transition-colors duration-[var(--motion-slow)]">
      <header className="sticky top-0 z-[var(--z-sticky)] bg-background/80 backdrop-blur-[var(--blur-md)] border-b border-border-custom p-4 flex items-center gap-3">
        <Pressable onClick={logger.handleBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
          <ChevronLeft size={20} />
        </Pressable>
        <h1 className="text-xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-text-primary flex-1 font-display">Zaloguj Trening</h1>
        {logger.timerStart ? (
          <Pressable onClick={() => logger.setTimerStart(null)} className="flex items-center gap-1.5 text-primary hover:text-primary-hover transition-colors cursor-pointer">
            <span className="text-xs font-black tabular-nums">{logger.elapsed}</span>
            <Square size={11} className="fill-current" />
          </Pressable>
        ) : (
          <Pressable onClick={() => logger.setTimerStart(Date.now())} className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <Play size={13} className="fill-current" />
            <span className="text-xs font-black uppercase tracking-widest">Start</span>
          </Pressable>
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
          <label className="text-2xs font-black uppercase tracking-widest text-text-secondary">Nazwa (opcjonalnie)</label>
          <ControlInput type="text" value={logger.workoutName} onChange={e => logger.setWorkoutName(e.target.value)}
            placeholder="np. Push, Nogi, Plecy/Bicep..."
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm font-bold text-text-primary outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-focus transition-all placeholder:text-text-muted/40" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell size={12} className="text-text-muted" />
            <span className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-005)] text-text-muted">Ćwiczenia</span>
          </div>
          {logger.exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onChange={logger.updateExercise} onRemove={() => logger.removeExercise(ex.id)} userId={userId} />
          ))}
          <Pressable onClick={logger.addExercise}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-custom bg-surface hover:bg-surface-solid hover:border-primary/45 p-3.5 text-xs font-black uppercase tracking-widest text-text-secondary transition-all cursor-pointer">
            <Plus size={13} /> Dodaj ćwiczenie
          </Pressable>
          <VolumeBar exercises={logger.exercises} />
        </div>

        <div className="space-y-2">
          <label className="text-2xs font-black uppercase tracking-widest text-text-secondary">Notatki</label>
          <ControlTextarea value={logger.notes} onChange={e => logger.setNotes(e.target.value)} placeholder="Jak poszło?..."
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm text-text-primary min-h-[var(--legacy-h-008)] outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-focus transition-all resize-none placeholder:text-text-muted/40" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-2xs font-black uppercase tracking-widest text-text-secondary">RPE sesji</label>
            {logger.sessionRpe && (
              <Pressable onClick={() => logger.setSessionRpe(null)} className="text-2xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer">wyczyść</Pressable>
            )}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const color = n <= 4 ? 'border-info/30 dark:border-info/40 text-info dark:text-info bg-info/8 dark:bg-info/15 hover:bg-info/20'
                          : n <= 6 ? 'border-warning/35 dark:border-warning/40 text-warning dark:text-warning bg-warning/8 dark:bg-warning/15 hover:bg-warning/20'
                          : n <= 8 ? 'border-warning/35 dark:border-warning/40 text-warning dark:text-warning bg-warning/8 dark:bg-warning/15 hover:bg-warning/20'
                          : 'border-dayB/35 dark:border-dayB/40 text-dayB bg-dayB/8 dark:bg-dayB/15 hover:bg-dayB/20';
              const active = logger.sessionRpe === n ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-[var(--opacity-100)] scale-105 shadow-sm' : 'opacity-[var(--opacity-80)] hover:opacity-[var(--opacity-100)]';
              return (
                <Pressable key={n} onClick={() => logger.setSessionRpe(logger.sessionRpe === n ? null : n)}
                  className={`rounded-lg border py-2 text-xs font-black transition-all cursor-pointer ${color} ${active}`}>
                  {n}
                </Pressable>
              );
            })}
          </div>
          <p className="text-2xs text-text-muted">
            {logger.sessionRpe ? (logger.sessionRpe <= 4 ? 'Łatwa — dużo rezerwy' : logger.sessionRpe <= 6 ? 'Umiarkowana' : logger.sessionRpe <= 8 ? 'Ciężka — mało rezerwy' : 'Maksymalna — do oporu') : 'Jak ciężka była cała sesja?'}
          </p>
        </div>

        {/* Manual Time Picker Row */}
        <ManualTimePicker logger={logger} />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-[var(--blur-sm)] border-t border-border-custom space-y-3 z-[var(--z-sticky)]">
        {(() => {
          const totalVol = logger.exercises.reduce((sum, ex) => {
            if ((ex.tags || []).includes('wellness')) return sum;
            const exVol = (ex.sets || []).reduce((sSum, s) => sSum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0);
            return sum + exVol;
          }, 0);
          if (totalVol === 0) return null;
          return (
            <div className="flex justify-between items-center px-1 max-w-md mx-auto w-full">
              <span className="text-xs font-black uppercase tracking-widest text-text-muted">Suma Objętości:</span>
              <span className="text-sm font-black text-primary tracking-wide font-display">{totalVol.toLocaleString()} kg</span>
            </div>
          );
        })()}
        <div className="max-w-md mx-auto w-full">
          <Pressable onClick={logger.save} disabled={logger.saving}
            className="w-full bg-primary text-on-accent py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-[var(--opacity-50)] active:scale-[var(--legacy-arbitrary-001)] transition-transform hover:bg-primary-hover cursor-pointer">
            <Save size={15} />
            {logger.saving ? 'Zapisywanie...' : 'Zapisz'}
          </Pressable>
        </div>
      </footer>
    </div>
  );
}
