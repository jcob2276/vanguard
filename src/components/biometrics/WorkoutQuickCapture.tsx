import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { getTodayWarsaw } from '../../lib/date'
import { notify } from '../../lib/notify'
import {
  computeVolumeKg,
  fetchRecentWorkoutDays,
  fetchTodayWorkoutSnapshot,
  loadWorkoutTemplate,
  needsWorkoutReview,
  parseWorkoutNL,
  parsedToLoggerState,
  saveWorkoutSession,
  type ParsedWorkout,
  type WorkoutDayChip,
  type WorkoutLoggerInitial,
} from '../../lib/workoutLogging'

export default function WorkoutQuickCapture({
  session,
  refreshSignal = 0,
  onSaved,
  onOpenLogger,
}: {
  session: Session
  refreshSignal?: number
  onSaved?: () => void
  onOpenLogger: (initial?: WorkoutLoggerInitial) => void
}) {
  const userId = session.user.id
  const today = getTodayWarsaw()
  const [chips, setChips] = useState<WorkoutDayChip[]>([])
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<ParsedWorkout | null>(null)
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof fetchTodayWorkoutSnapshot>> | null>(null)
  const [insightPending, setInsightPending] = useState(false)

  const refresh = useCallback(async () => {
    const [days, snap] = await Promise.all([
      fetchRecentWorkoutDays(userId, 4),
      fetchTodayWorkoutSnapshot(userId, today),
    ])
    setChips(days)
    setSnapshot(snap)
  }, [userId, today])

  useEffect(() => {
    refresh()
  }, [refresh, refreshSignal])

  const bumpInsightRefresh = useCallback(() => {
    setInsightPending(true)
    window.setTimeout(() => {
      void fetchTodayWorkoutSnapshot(userId, today).then((snap) => {
        setSnapshot(snap)
        setInsightPending(false)
      })
    }, 9000)
  }, [userId, today])

  const openTemplate = async (workoutDay?: string) => {
    if (saving) return
    setSaving(true)
    try {
      const tpl = await loadWorkoutTemplate(userId, workoutDay)
      if (!tpl) {
        notify('Brak historii — otwieram pusty logger', 'error')
        onOpenLogger()
        return
      }
      onOpenLogger(tpl)
    } finally {
      setSaving(false)
    }
  }

  const handleRepeatLast = () => openTemplate()

  const handleParse = async () => {
    if (!text.trim() || parsing) return
    setParsing(true)
    setPreview(null)
    try {
      const parsed = await parseWorkoutNL(text, userId, session.access_token)
      if (!parsed.exercises.length && !parsed.activities.length) {
        notify('Nie rozpoznano treningu', 'error')
        return
      }
      if (!needsWorkoutReview(parsed)) {
        const state = parsedToLoggerState(parsed)
        await saveWorkoutSession(userId, {
          ...state,
          workoutDate: today,
          timerStart: Date.now(),
          manualTime: false,
          startTimeManual: '18:00',
          endTimeManual: '19:00',
        })
        setText('')
        await refresh()
        bumpInsightRefresh()
        onSaved?.()
        notify('Trening zapisany', 'success')
        return
      }
      setPreview(parsed)
    } catch (e: any) {
      notify(e.message || 'Parsowanie nie powiodło się', 'error')
    } finally {
      setParsing(false)
    }
  }

  const handleSavePreview = async () => {
    if (!preview || saving) return
    setSaving(true)
    try {
      const state = parsedToLoggerState(preview)
      await saveWorkoutSession(userId, {
        ...state,
        workoutDate: today,
        timerStart: Date.now(),
        manualTime: false,
        startTimeManual: '18:00',
        endTimeManual: '19:00',
      })
      setText('')
      setPreview(null)
      await refresh()
      bumpInsightRefresh()
      onSaved?.()
      notify('Trening zapisany', 'success')
    } catch (e: any) {
      notify(e.message || 'Zapis nie powiódł się', 'error')
    } finally {
      setSaving(false)
    }
  }

  const previewState = preview ? parsedToLoggerState(preview) : null
  const previewVol = previewState ? computeVolumeKg(previewState.exercises) : 0

  return (
    <div className="rounded-[20px] border border-border-custom bg-surface/60 p-4 space-y-3">
      {(snapshot?.totalVolumeKg ?? 0) > 0 || snapshot?.strainScore != null ? (
        <p className="text-[10px] text-text-muted">
          {snapshot?.totalVolumeKg ? (
            <span className="font-black text-text-secondary">{snapshot.totalVolumeKg.toLocaleString()} kg</span>
          ) : null}
          {snapshot?.totalVolumeKg && snapshot?.strengthLoad != null ? ' · ' : null}
          {snapshot?.strengthLoad != null ? (
            <span>siłownia {Math.round(snapshot.strengthLoad)}</span>
          ) : null}
          {snapshot?.strainScore != null ? (
            <span>{snapshot?.totalVolumeKg || snapshot?.strengthLoad != null ? ' · ' : ''}strain {Math.round(snapshot.strainScore)}</span>
          ) : null}
        </p>
      ) : null}

      {(insightPending || snapshot?.trainingInsight) && (
        <p className="text-[10px] leading-snug text-text-muted">
          {insightPending && !snapshot?.trainingInsight ? (
            <span className="italic">Analiza obciążenia…</span>
          ) : snapshot?.trainingInsight ? (
            <span>{snapshot.trainingInsight}</span>
          ) : null}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.workout_day}
            type="button"
            disabled={saving}
            onClick={() => openTemplate(c.workout_day)}
            className="rounded-full border border-border-custom bg-background/40 px-2.5 py-1 text-[10px] font-semibold text-text-secondary hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            {c.workout_day.length > 18 ? `${c.workout_day.slice(0, 16)}…` : c.workout_day}
          </button>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={handleRepeatLast}
          className="rounded-full border border-border-custom px-2.5 py-1 text-[10px] font-semibold text-text-muted hover:text-text-primary disabled:opacity-50 flex items-center gap-1"
        >
          <RotateCcw size={10} /> Ostatni
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); if (preview) setPreview(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleParse() } }}
          placeholder="np. wycisk 80x5x3, sauna 15min"
          className="min-w-0 flex-1 rounded-xl border border-border-custom bg-background/50 px-3 py-2.5 text-[13px] outline-none focus:border-primary/40 placeholder:text-text-muted/40"
        />
        <button
          type="button"
          onClick={handleParse}
          disabled={!text.trim() || parsing || saving}
          className="shrink-0 rounded-xl bg-primary px-3 py-2.5 text-white disabled:opacity-40"
        >
          {parsing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        </button>
      </div>

      {preview && previewState && (
        <div className="space-y-2 border-t border-border-custom/50 pt-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Sprawdź przed zapisem</p>
          {previewState.exercises.filter((e) => e.name.trim()).map((ex, i) => (
            <div key={i} className="rounded-xl border border-border-custom/60 px-2.5 py-2 text-[11px]">
              <p className="font-semibold truncate">{ex.name}</p>
              <p className="text-[10px] text-text-muted">
                {(ex.sets ?? []).map((s) => `${s.kg}×${s.reps}`).join(' · ')}
              </p>
            </div>
          ))}
          {previewVol > 0 && (
            <p className="text-[10px] text-text-muted">Objętość ~{previewVol.toLocaleString()} kg</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setPreview(null)} className="flex-1 rounded-xl border border-border-custom py-2 text-[11px] font-bold text-text-muted">Anuluj</button>
            <button type="button" onClick={handleSavePreview} disabled={saving} className="flex-1 rounded-xl bg-primary py-2 text-[11px] font-bold text-white disabled:opacity-50">
              {saving ? 'Zapisuję…' : 'Zapisz'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
