import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getTodayWarsaw } from '../../../lib/date'
import {
  fetchNutritionDayContext,
  isFoodLogClosed,
  setFoodLogClosed,
  type NutritionDayContext,
} from '../../../lib/health/nutritionContext'
import NutritionTrainingBar from './NutritionTrainingBar'

export default function NutritionTrainingBarCard({
  session,
  refreshSignal = 0,
}: {
  session: Session
  refreshSignal?: number
}) {
  const userId = session.user.id
  const today = getTodayWarsaw()
  const [ctx, setCtx] = useState<NutritionDayContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [logClosed, setLogClosed] = useState(() => isFoodLogClosed(userId, today))

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setCtx(await fetchNutritionDayContext(userId, today, session.access_token))
    } finally {
      setLoading(false)
    }
  }, [userId, today, session.access_token])

  useEffect(() => { void (async () => { await refresh() })() }, [refresh, refreshSignal])

  return (
    <NutritionTrainingBar
      ctx={ctx}
      loading={loading}
      logClosed={logClosed}
      onToggleLogClosed={() => {
        const next = !logClosed
        setLogClosed(next)
        setFoodLogClosed(userId, today, next)
      }}
    />
  )
}
