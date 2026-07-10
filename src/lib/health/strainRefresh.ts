import { supabase, invokeEdge } from '../supabase'
import { TIMEOUTS } from '../constants'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

async function runStrainRecompute(userId: string): Promise<void> {
  try {
    await invokeEdge('vanguard-nightly', {
      body: { userId, days: 1, action: 'compute-daily-strain' },
      signal: AbortSignal.timeout(TIMEOUTS.default),
    })
  } catch (e: unknown) {
      console.warn('[strainRefresh] Failed to run strain recompute:', e);
    }
}

/** Debounced strain recompute after food/workout logs — keeps DailyStrainCard honest. */
export function scheduleStrainRecompute(userId: string): void {
  const existing = timers.get(userId)
  if (existing) clearTimeout(existing)
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId)
      void runStrainRecompute(userId)
    }, 5000),
  )
}
