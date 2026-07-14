import Button from '../../ui/Button';
import { Check, Zap } from 'lucide-react'
import { useHaptics } from '../../../hooks/useHaptics'
import { Card } from '../../ui/Card'
import type { PlyoExercisePrescription, PlyoSessionPlan } from '../../../lib/health/plyoMarathonProgram'
import { formatPlyoPrescription } from '../../../lib/health/plyoMarathonProgram'

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
  return (
    <Card variant="glass" className="border border-success/25 space-y-4" style={{ background: 'var(--legacy-color-070)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-success shrink-0" />
            <span className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-012)] text-success dark:text-success">
              Plajometria
            </span>
          </div>
          <h2 className="text-xs font-black uppercase tracking-wide text-text-primary leading-snug">
            {session.label}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="shrink-0 px-0 py-0 text-2xs font-black uppercase tracking-widest text-text-muted hover:bg-transparent hover:text-text-secondary"
        >
          Pomiń
        </Button>
      </div>

      <div className="h-1.5 rounded-full bg-surface-solid overflow-hidden">
        <div
          className="h-full bg-success transition-all duration-[var(--motion-slow)]"
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
    </Card>
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
          ? 'border-success/30 bg-success/10'
          : 'border-border-custom bg-surface/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-sm font-black tracking-tight ${allSetsDone ? 'text-success dark:text-success' : 'text-text-primary'}`}>
          {ex.name}
        </span>
        <span className="text-xs font-bold text-text-muted tabular-nums">{formatPlyoPrescription(ex)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {setsDone.map((isDone, setIdx) => (
          <Button
            key={setIdx}
            type="button"
            variant="ghost"
            onClick={() => onToggle(setIdx)}
            className={`h-9 min-w-[var(--legacy-w-080)] gap-1 rounded-xl border px-2 text-xs font-black ${
              isDone
                ? 'border-success bg-success text-on-accent shadow-sm'
                : 'border-border-custom bg-surface-solid text-text-muted hover:border-success/40 hover:text-text-primary'
            }`}
            aria-label={`Seria ${setIdx + 1}`}
          >
            {isDone ? <Check size={12} strokeWidth={3} /> : setIdx + 1}
          </Button>
        ))}
      </div>
    </div>
  )
}
