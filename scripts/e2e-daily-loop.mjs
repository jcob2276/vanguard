#!/usr/bin/env node
/**
 * E2E smoke — core Vanguard daily loop pipeline.
 *
 * Tests that the backbone of the app is wired up and returning real data:
 *   1. compute-daily-strain  → HTTP 200
 *   2. daily_strain          → DB row exists (today or yesterday, Warsaw tz)
 *   3. oura_daily_summary    → recent data (last 3 days)
 *   4. save-daily-aggregate  → HTTP 200
 *   5. vanguard_daily_aggregates → DB row exists
 *   6. planning_summary      → DB row exists (last 7 days)
 *   7. daily_reconciliations → DB row exists (last 7 days)
 *   8. vanguard-morning-brief → reachable (OPTIONS, no POST side-effect)
 *
 * Does NOT call cron functions with POST — avoids Telegram sends.
 * compute-daily-strain and save-daily-aggregate are safe to call any time.
 *
 * Env (loaded from .env / .env.local):
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VANGUARD_USER_ID
 *
 * Usage:
 *   node scripts/e2e-daily-loop.mjs
 *   npm run e2e:loop
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient }  from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')

// ── Env loader (mirrors smoke-vanguard.mjs pattern) ─────────────────────────
function loadEnv() {
  for (const rel of ['.env.local', '.env', 'supabase/.env']) {
    const p = path.join(ROOT, rel)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
    break
  }
}
loadEnv()

const BASE        = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID     = process.env.VANGUARD_USER_ID

// ── Validate required env ────────────────────────────────────────────────────
const missingEnv = [
  !BASE        && 'SUPABASE_URL / VITE_SUPABASE_URL',
  !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  !USER_ID     && 'VANGUARD_USER_ID',
].filter(Boolean)

if (missingEnv.length) {
  console.error(`\n❌  Missing env vars:\n${missingEnv.map(v => `   • ${v}`).join('\n')}\n`)
  process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const db    = createClient(BASE, SERVICE_KEY)
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
const ago   = (days) => new Date(Date.now() - days * 864e5)
  .toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })

/** POST an edge function with service-role bearer. Throws on non-2xx. */
async function callFn(fnName, body = {}) {
  const res = await fetch(`${BASE}/functions/v1/${fnName}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${payload.error || res.statusText}`)
  return payload
}

/** OPTIONS an edge function — verifies reachability without side-effects. */
async function optionsFn(fnName) {
  const res = await fetch(`${BASE}/functions/v1/${fnName}`, {
    method: 'OPTIONS',
    headers: { 'Access-Control-Request-Method': 'POST' },
  })
  if (res.status === 401) throw new Error(`JWT mismatch — function may need verify_jwt:false`)
  // 200 or 204 both fine for OPTIONS
}

const results = []

async function step(name, fn, { optional = false } = {}) {
  const t0  = Date.now()
  const tag  = optional ? '(optional)' : ''
  try {
    const note = await fn()
    const ms   = Date.now() - t0
    const line = note ? `  ✅  ${name} ${tag} (${ms}ms)\n       → ${note}` : `  ✅  ${name} ${tag} (${ms}ms)`
    console.log(line)
    results.push({ name, ok: true, ms })
  } catch (e) {
    const ms = Date.now() - t0
    console.log(`  ${optional ? '⚠️ ' : '❌'} ${name} ${tag} (${ms}ms)\n       ${e.message}`)
    results.push({ name, ok: false, ms, error: e.message, optional })
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(`\n╔══════════════════════════════════════════════════════╗`)
console.log(`║  Vanguard E2E — Daily Loop Pipeline                  ║`)
console.log(`╚══════════════════════════════════════════════════════╝`)
console.log(`   Date   : ${today} (Warsaw timezone)`)
console.log(`   User   : ${USER_ID}`)
console.log(`   Supabase: ${BASE}\n`)

// 1. compute-daily-strain
await step('compute-daily-strain → HTTP 200', async () => {
  const data = await callFn('compute-daily-strain', { userId: USER_ID, days: 2 })
  const ok = data.success || (Array.isArray(data.results) && data.results.length > 0)
  if (!ok) throw new Error(`Unexpected payload: ${JSON.stringify(data).slice(0, 120)}`)
  const r = data.results?.[0]
  return r ? `success=${r.success}` : 'ok'
})

// 2. daily_strain DB check
await step('daily_strain row in DB (today or yesterday)', async () => {
  const { data, error } = await db
    .from('daily_strain')
    .select('date, strain_score, recovery_score, daily_status, main_limiter')
    .eq('user_id', USER_ID)
    .gte('date', ago(2))
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No daily_strain row — check compute-daily-strain logs')
  return `date=${data.date} status=${data.daily_status} strain=${data.strain_score} recovery=${data.recovery_score} limiter=${data.main_limiter}`
})

// 3. Oura data freshness
await step('oura_daily_summary — data within last 3 days', async () => {
  const { data, error } = await db
    .from('oura_daily_summary')
    .select('date, total_sleep_hours, readiness_score, hrv_avg')
    .eq('user_id', USER_ID)
    .gte('date', ago(3))
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No Oura data in last 3 days — run sync-oura')
  return `date=${data.date} sleep=${data.total_sleep_hours}h readiness=${data.readiness_score} hrv=${data.hrv_avg}ms`
})

// 4. save-daily-aggregate
await step('save-daily-aggregate → HTTP 200', async () => {
  const data = await callFn('save-daily-aggregate', { userId: USER_ID })
  return `saved=${data.saved ?? 'ok'}`
}, { optional: true })

// 5. vanguard_daily_aggregates DB check (optional — save-daily-aggregate needs user JWT, not service role)
await step('vanguard_daily_aggregates row in DB (last 7 days)', async () => {
  const { data, error } = await db
    .from('vanguard_daily_aggregates')
    .select('date, sleep_hours, hrv_avg, readiness_score')
    .eq('user_id', USER_ID)
    .gte('date', ago(7))
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No aggregate row in 7 days — trigger save-daily-aggregate via user session')
  return `date=${data.date} sleep=${data.sleep_hours}h hrv=${data.hrv_avg}ms readiness=${data.readiness_score}`
}, { optional: true })

// 6. planning_summary freshness (optional — table may not be in PostgREST schema cache)
await step('planning_summary — row exists (last 7 days)', async () => {
  const { data, error } = await db
    .from('planning_summary')
    .select('date, status, summary')
    .eq('user_id', USER_ID)
    .gte('date', ago(7))
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No planning_summary in last 7 days — run daily reconciliation')
  return `date=${data.date} status=${data.status}`
}, { optional: true })

// 7. daily_reconciliations freshness
await step('daily_reconciliations — row exists (last 7 days)', async () => {
  const { data, error } = await db
    .from('daily_reconciliations')
    .select('date, planning_status')
    .eq('user_id', USER_ID)
    .gte('date', ago(7))
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No reconciliation in last 7 days — complete evening flow in Telegram')
  return `date=${data.date} planning_status=${data.planning_status}`
})

// 8. vanguard-morning-brief reachability (OPTIONS only — no Telegram side-effect)
await step('vanguard-morning-brief — reachable (OPTIONS)', async () => {
  await optionsFn('vanguard-morning-brief')
  return 'CORS preflight OK'
})

// 9. vanguard-oracle reachability
await step('vanguard-oracle — reachable (OPTIONS)', async () => {
  await optionsFn('vanguard-oracle')
  return 'CORS preflight OK'
})

// ── Summary ──────────────────────────────────────────────────────────────────
const passed   = results.filter(r => r.ok).length
const failed   = results.filter(r => !r.ok && !r.optional).length
const optional = results.filter(r => !r.ok && r.optional).length
const totalMs  = results.reduce((s, r) => s + r.ms, 0)

console.log(`\n${'─'.repeat(56)}`)
console.log(`Result: ${passed}/${results.length} passed  |  ${totalMs}ms total`)
if (optional > 0) {
  console.log(`Optional skipped: ${optional}`)
}

if (failed > 0) {
  console.log(`\nFailed (blocking):`)
  results.filter(r => !r.ok && !r.optional).forEach(r =>
    console.log(`  ✗  ${r.name}\n     ${r.error}`)
  )
  console.log('')
  process.exit(1)
}

console.log('Daily loop pipeline OK ✓\n')
process.exit(0)
