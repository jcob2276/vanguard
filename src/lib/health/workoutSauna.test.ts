import { describe, expect, it } from 'vitest'
import { completedSaunaWindow } from './workoutSauna'

describe('completedSaunaWindow', () => {
  it('places a completed sauna before the logging time', () => {
    const window = completedSaunaWindow(25, new Date('2026-07-17T20:30:00.000Z'))

    expect(window).toEqual({
      workoutDate: '2026-07-17',
      startTimeManual: '22:05',
      endTimeManual: '22:30',
    })
  })

  it('keeps the start date when the session crosses midnight', () => {
    const window = completedSaunaWindow(25, new Date('2026-07-17T22:10:00.000Z'))

    expect(window).toEqual({
      workoutDate: '2026-07-17',
      startTimeManual: '23:45',
      endTimeManual: '00:10',
    })
  })
})
