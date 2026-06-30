import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { getStreamCutoffs, getWarsawDateString, getWarsawDayBoundaries } from './time.ts'

// 2026 Europe/Warsaw DST transitions (verified via Intl): spring-forward 2026-03-29
// (GMT+1 -> GMT+2), fall-back 2026-10-25 (GMT+2 -> GMT+1). Several bugs in this repo
// have come from date math that assumed a flat 24h/86400000ms day across these boundaries.

Deno.test('getWarsawDateString — regular day matches UTC date at noon', () => {
  assertEquals(getWarsawDateString(new Date('2026-06-15T12:00:00Z')), '2026-06-15')
})

Deno.test('getWarsawDateString — near-midnight UTC still resolves to correct Warsaw day (summer, +2)', () => {
  // 2026-06-15 23:30 UTC = 2026-06-16 01:30 Warsaw (summer offset +2)
  assertEquals(getWarsawDateString(new Date('2026-06-15T23:30:00Z')), '2026-06-16')
})

Deno.test('getWarsawDateString — near-midnight UTC in winter offset (+1)', () => {
  // 2026-01-15 23:30 UTC = 2026-01-16 00:30 Warsaw (winter offset +1)
  assertEquals(getWarsawDateString(new Date('2026-01-15T23:30:00Z')), '2026-01-16')
})

Deno.test('getWarsawDayBoundaries — winter day (UTC+1) spans 23:00 to 23:00 UTC', () => {
  const { start, end } = getWarsawDayBoundaries('2026-01-15')
  assertEquals(start, '2026-01-14T23:00:00.000Z')
  assertEquals(end, '2026-01-15T23:00:00.000Z')
})

Deno.test('getWarsawDayBoundaries — summer day (UTC+2) spans 22:00 to 22:00 UTC', () => {
  const { start, end } = getWarsawDayBoundaries('2026-06-15')
  assertEquals(start, '2026-06-14T22:00:00.000Z')
  assertEquals(end, '2026-06-15T22:00:00.000Z')
})

Deno.test('getWarsawDayBoundaries — spring-forward day (2026-03-29) is only 23h Warsaw-local but boundaries still resolve correctly', () => {
  const { start, end } = getWarsawDayBoundaries('2026-03-29')
  // Pre-transition: still +1 (23:00 UTC prev day). Post-transition: already +2 (22:00 UTC same day).
  assertEquals(start, '2026-03-28T23:00:00.000Z')
  assertEquals(end, '2026-03-29T22:00:00.000Z')
})

Deno.test('getWarsawDayBoundaries — fall-back day (2026-10-25) is 25h Warsaw-local but boundaries still resolve correctly', () => {
  const { start, end } = getWarsawDayBoundaries('2026-10-25')
  // Pre-transition: still +2 (22:00 UTC prev day). Post-transition: already +1 (23:00 UTC same day).
  assertEquals(start, '2026-10-24T22:00:00.000Z')
  assertEquals(end, '2026-10-25T23:00:00.000Z')
})

Deno.test('getWarsawDayBoundaries — consecutive days tile exactly (no gap, no overlap) across spring-forward', () => {
  const day1 = getWarsawDayBoundaries('2026-03-29')
  const day2 = getWarsawDayBoundaries('2026-03-30')
  assertEquals(day1.end, day2.start)
})

Deno.test('getWarsawDayBoundaries — consecutive days tile exactly across fall-back', () => {
  const day1 = getWarsawDayBoundaries('2026-10-25')
  const day2 = getWarsawDayBoundaries('2026-10-26')
  assertEquals(day1.end, day2.start)
})

Deno.test('getStreamCutoffs — returns 24h/72h/21d windows before now', () => {
  const now = new Date('2026-06-15T12:00:00Z')
  const cutoffs = getStreamCutoffs(now)
  assertEquals(cutoffs.cut24h, '2026-06-14T12:00:00.000Z')
  assertEquals(cutoffs.cut72h, '2026-06-12T12:00:00.000Z')
  assertEquals(cutoffs.cut21d, '2026-05-25T12:00:00.000Z')
})
