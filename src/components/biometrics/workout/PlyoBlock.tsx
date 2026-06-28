import { Check, Zap } from 'lucide-react'
import { useHaptics } from '../../../hooks/useHaptics'
import type { PlyoExercisePrescription, PlyoSessionPlan } from '../../../lib/plyoMarathonProgram'
import { formatPlyoPrescription } from '../../../lib/plyoMarathonProgram'

interface PlyoBlockProps {
  session: PlyoSessionPlan
  done: boolean[][]
  onToggleSet: (exIdx: number, setIdx: number) => void
  onSkip: () => void
}

export default function PlyoBlock({ session, done, onToggleSet, onSkip }: PlyoBlockProps) {
  const haptics = useHaptics()
  const totalSets = session.exercises.reduce((s, ex) => s + ex.sets, 0)
  const completedSets = done.reduce((s, row) => s + row.filter(Boolean).length, 0)
  const allDone = totalSets > 0 && completedSets === totalSets

  return (
    <section className="rounded-[24px] border border-lime-500/25 bg-lime-500/[0.06] p-4 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-lime-500 shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-lime-600 dark:text-lime-400">
              Plajometria
            </span>
          </div>
          <h2 className="text-[11px] font-black uppercase tracking-wide text-text-primary leading-snug">
            {session.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="shrink-0 text-[8px] font-black uppercase tracking-widest text-text-muted hover:text-text-secondary cursor-pointer"
        >
          Pomiń
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-surface-solid overflow-hidden">
        <div
          className="h-full bg-lime-500 transition-all duration-300"
          style={{ width: totalSets ? `${(completedSets / totalSets) * 100}%` : '0%' }}
        />
      </div>

      <div className="space-y-3">
        {session.exercises.map((ex, exIdx) => (
          <PlyoExerciseRow
            key={`${ex.name}-${exIdx}`}
            ex={ex}
            setsDone={done[exIdx] ?? []}
            onToggle={(setIdx) => {
              haptics.light()
              onToggleSet(exIdx, setIdx)
            }}
          />
        ))}
      </div>

      {allDone && (
        <p className="text-[10px] font-bold text-lime-600 dark:text-lime-400 text-center">
          Plyo gotowe — przejdź do siłowni poniżej
        </p>
      )}
    </section>
  )
}

function PlyoExerciseRow({
  ex,
  setsDone,
  onToggle,
}: {
  ex: PlyoExercisePrescription
  setsDone: boolean[]
  onToggle: (setIdx: number) => void
}) {
  const allSetsDone = setsDone.length > 0 && setsDone.every(Boolean)

  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 transition-colors ${
        allSetsDone
          ? 'border-lime-500/30 bg-lime-500/10'
          : 'border-border-custom bg-surface/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[12px] font-black tracking-tight ${allSetsDone ? 'text-lime-700 dark:text-lime-300' : 'text-text-primary'}`}>
          {ex.name}
        </span>
        <span className="text-[10px] font-bold text-text-muted tabular-nums">{formatPlyoPrescription(ex)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {setsDone.map((isDone, setIdx) => (
          <button
            key={setIdx}
            type="button"
            onClick={() => onToggle(setIdx)}
            className={`flex h-9 min-w-[2.25rem] items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-black transition-all cursor-pointer ${
              isDone
                ? 'border-lime-500 bg-lime-500 text-white shadow-sm'
                : 'border-border-custom bg-surface-solid text-text-muted hover:border-lime-500/40 hover:text-text-primary'
            }`}
            aria-label={`Seria ${setIdx + 1}`}
          >
            {isDone ? <Check size={12} strokeWidth={3} /> : setIdx + 1}
          </button>
        ))}
      </div>
    </div>
  )
}
