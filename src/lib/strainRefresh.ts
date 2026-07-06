import { supabase } from './supabase'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

async function runStrainRecompute(userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compute-daily-strain`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, days: 1 }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.warn('[strainRefresh] compute-daily-strain:', json.error || res.status)
    }
  } catch (e: unknown) {
      console.error('[Background Error]', e);
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
