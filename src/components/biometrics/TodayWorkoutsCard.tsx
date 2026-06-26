import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Footprints, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getTodayWarsaw } from '../../lib/date'
import { useHaptics } from '../../hooks/useHaptics'
import { fetchTodayWorkoutSnapshot, type TodayStravaActivity, type TodayWorkoutSession } from '../../lib/workoutLogging'

function fmtDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`
}

function fmtDistance(m: number | null): string {
  if (!m) return ''
  return `${(m / 1000).toFixed(1)} km`
}

export default function TodayWorkoutsCard({
  session,
  refreshSignal,
  onOpenLogger,
}: {
  session: Session
  refreshSignal?: number
  onOpenLogger?: () => void
}) {
  const userId = session.user.id
  const today = getTodayWarsaw()
  const haptics = useHaptics()
  const [sessions, setSessions] = useState<TodayWorkoutSession[]>([])
  const [strava, setStrava] = useState<TodayStravaActivity[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const snap = await fetchTodayWorkoutSnapshot(userId, today)
    setSessions(snap.sessions)
    setStrava(snap.strava)
  }, [userId, today])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  const deleteSession = async (id: string) => {
    if (deletingId) return
    haptics.light()
    setDeletingId(id)
    try {
      await supabase.from('exercise_logs').delete().eq('session_id', id).eq('user_id', userId)
      const { error } = await supabase.from('workout_sessions').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  if (!sessions.length && !strava.length) return null

  return (
    <div className="rounded-[20px] border border-border-custom bg-surface/40 p-4 space-y-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">Dzisiaj w ruchu</p>

      {sessions.map((s) => (
        <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border-custom/50 bg-background/30 px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold truncate">{s.workout_day}</p>
            <p className="text-[10px] text-text-muted">
              {s.volume_kg > 0 ? `${s.volume_kg.toLocaleString()} kg` : 'wellness'}
              {s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}
              {s.session_rpe ? ` · RPE ${s.session_rpe}` : ''}
              {s.hr_avg_bpm ? ` · HR ${s.hr_avg_bpm}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={deletingId === s.id}
            onClick={() => deleteSession(s.id)}
            className="p-1 text-text-muted hover:text-rose-500"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {strava.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] px-2.5 py-2">
          <Footprints size={14} className="text-orange-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold truncate">{a.name || a.sport_type || 'Strava'}</p>
            <p className="text-[10px] text-text-muted">
              {[fmtDistance(a.distance), fmtDuration(a.moving_time)].filter(Boolean).join(' · ')}
              {' · '}Strava
            </p>
          </div>
        </div>
      ))}

      {onOpenLogger && (
        <button type="button" onClick={onOpenLogger} className="text-[10px] font-semibold text-primary/80 hover:text-primary">
          Dodaj / edytuj w loggerze →
        </button>
      )}
    </div>
  )
}
