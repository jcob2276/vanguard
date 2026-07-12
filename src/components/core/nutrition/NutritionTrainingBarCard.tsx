import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { getTodayWarsaw } from '../../../lib/date'
import {
  fetchNutritionDayContext,
  isFoodLogClosed,
  setFoodLogClosed,
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
  const [logClosed, setLogClosed] = useState(() => isFoodLogClosed(userId, today))

  const ctxQuery = useQuery({
    queryKey: ['nutrition-day-context', userId, today, refreshSignal],
    queryFn: () => fetchNutritionDayContext(userId, today, session.access_token),
    enabled: !!userId,
  })

  return (
    <NutritionTrainingBar
      ctx={ctxQuery.data ?? null}
      loading={ctxQuery.isLoading}
      logClosed={logClosed}
      onToggleLogClosed={() => {
        const next = !logClosed
        setLogClosed(next)
        setFoodLogClosed(userId, today, next)
      }}
    />
  )
}
