import { describe, expect, it } from 'vitest'
import { estimateCaffeineMg } from '../../supabase/functions/_shared/caffeineEstimate.ts'

describe('estimateCaffeineMg', () => {
  it('uses explicit mg from name', () => {
    expect(estimateCaffeineMg('Kawa domowa (90mg kofeiny)')).toBe(90)
  })

  it('falls back to heuristics', () => {
    expect(estimateCaffeineMg('latte')).toBe(95)
    expect(estimateCaffeineMg('herbata')).toBe(47)
  })
})
