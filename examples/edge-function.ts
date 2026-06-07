/**
 * Canonical Vanguard Edge Function pattern.
 *
 * Copy this skeleton for any new Supabase Edge Function.
 * Key invariants:
 *   - Auth via resolveUserScope() — never raw JWT parsing
 *   - Warsaw timezone for all date strings
 *   - corsHeaders on every response including errors
 *   - Structured JSON error on every non-200 path
 *   - Per-user results wrapped in try/catch, never abort the whole batch
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createServiceClient, resolveUserScope } from "../_shared/supabase.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Warsaw date helpers ────────────────────────────────────────────────────────
// CRITICAL: never use new Date().toISOString().split('T')[0] — that's UTC and
// wrong in Warsaw after midnight until ~02:00 in summer / ~01:00 in winter.
const toWarsaw = (d: Date) =>
  d.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })

const todayWarsaw = () => toWarsaw(new Date())

Deno.serve(async (req) => {
  // 1. CORS preflight — always first, before any await
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 2. Parse body — .catch(() => ({})) so malformed JSON returns 400 not 500
    const body = await req.json().catch(() => ({}))

    // 3. Auth — resolveUserScope validates JWT vs service role key.
    //    - JWT user: returns { userId: user.id, isServiceRole: false }
    //    - Service role key: returns { userId: body.userId ?? null, isServiceRole: true }
    //    - Mismatch (JWT user requesting another userId): throws "Forbidden userId mismatch"
    //    - Missing token: throws "Missing Authorization bearer token"
    const { userId: scopedUserId, isServiceRole } = await resolveUserScope(
      req,
      body.userId ?? null,
    )

    // 4. Supabase client — always createServiceClient() from _shared, never inline createClient()
    const supabase = createServiceClient()

    // 5. Multi-user loop — filter by scopedUserId when set (scoped call), else all users
    let q = supabase.from('user_settings').select('user_id').not('some_token', 'is', null)
    if (scopedUserId) q = q.eq('user_id', scopedUserId)
    const { data: users, error: usersErr } = await q
    if (usersErr) throw usersErr

    // 6. Process users in parallel — each wrapped in try/catch so one failure
    //    doesn't abort the others. Return { userId, success, error } per user.
    const results = await Promise.all(
      (users || []).map(async (u) => {
        const uid = u.user_id
        try {
          const today = todayWarsaw()
          // ... actual per-user logic here
          await supabase.from('some_table').upsert({ user_id: uid, date: today, value: 42 })
          return { userId: uid, success: true }
        } catch (e: any) {
          console.error(`[fn-name] user ${uid}:`, e.message)
          return { userId: uid, success: false, error: e.message }
        }
      })
    )

    // 7. Scoped error path — if called for a single user and it failed, return 400
    const scopedError = scopedUserId && results.length === 1 && results[0]?.error
    return new Response(
      JSON.stringify({ success: !scopedError, results, error: scopedError || undefined }),
      {
        status: scopedError ? 400 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (e: any) {
    // 8. Top-level catch — auth failures, parse errors, DB errors
    console.error('[fn-name] fatal:', e.message)
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
