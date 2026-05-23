import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const VANGUARD_USER_ID = '165ae341-670c-46ce-82dc-434c4dbfcdfd'

const RESET_SYSTEM_PROMPT = `Generate one very short attention reset message in Polish.

GOAL: Help the user return attention to today's anchor and reduce drift.

USE ONLY these concepts (controlled vocabulary):
- intencja (intention)
- slajd procesu (process slide — concrete action scene, not outcome)
- obniżenie ważności (lowering importance)
- kierunek (direction)
- anchor (today's declared focus)
- uwaga (attention)
- dryf (drift)

DO NOT:
- coach or give advice
- interpret personality or behavior
- mention manifestacja, wszechświat, energia, linie życia, znaki
- sound mystical, motivational, or therapeutic
- use "powinieneś", "musisz", "warto"

FORMAT:
- Under 20 words
- Concrete and operational only
- One sentence or one short question
- No greeting, no sign-off

GOOD EXAMPLES:
"Obniż ważność. Zrób pierwsze 10 minut anchora."
"Czy to działanie wspiera dzisiejszy kierunek?"
"Wróć do jednego konkretnego ruchu."
"Nie rozwiązuj całego życia. Wróć do procesu."

BAD EXAMPLES (DO NOT generate):
"Wszechświat odpowiada dziś na Twoją energię."
"Wchodzisz na linię życia odwagi."
"To wahadło przejęło Twoją uwagę."
`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date()

    const warsawOffset = (() => {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'short' })
      const parts = fmt.formatToParts(now)
      const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2'
      return tzName.includes('+2') ? 2 : 1
    })()
    const warsawNow = new Date(now.getTime() + warsawOffset * 60 * 60 * 1000)
    const warsawDateStr = warsawNow.toISOString().split('T')[0]
    const warsawHour = warsawNow.getUTCHours()

    const slotsRemaining = Math.max(1, 22 - warsawHour + 1)
    const dayStart = new Date(`${warsawDateStr}T00:00:00+0${warsawOffset}:00`).toISOString()
    const dayEnd   = new Date(`${warsawDateStr}T23:59:59+0${warsawOffset}:00`).toISOString()

    const { data: alreadySent } = await supabase
      .from('vanguard_stream')
      .select('id')
      .eq('user_id', VANGUARD_USER_ID)
      .eq('category', 'system:reset')
      .gte('timestamp', dayStart)
      .lt('timestamp', dayEnd)
      .limit(1)
      .maybeSingle()

    if (alreadySent) {
      console.log('[reset] already sent today — skip')
      return new Response(JSON.stringify({ skipped: 'already_sent_today' }), { status: 200 })
    }

    const cut90min = new Date(now.getTime() - 90 * 60 * 1000).toISOString()
    const { data: recentActivity } = await supabase
      .from('vanguard_stream')
      .select('id')
      .eq('user_id', VANGUARD_USER_ID)
      .gte('timestamp', cut90min)
      .not('category', 'eq', 'system:reset')
      .limit(1)
      .maybeSingle()

    if (recentActivity) {
      console.log('[reset] user active recently — skip')
      return new Response(JSON.stringify({ skipped: 'user_active' }), { status: 200 })
    }

    const roll = Math.random()
    const threshold = 1 / slotsRemaining
    if (roll > threshold) {
      console.log(`[reset] roll ${roll.toFixed(3)} > threshold ${threshold.toFixed(3)} — skip this slot`)
      return new Response(JSON.stringify({ skipped: 'not_this_slot', roll, threshold }), { status: 200 })
    }

    console.log(`[reset] sending — roll ${roll.toFixed(3)} <= threshold ${threshold.toFixed(3)}`)

    const { data: anchorRaw } = await supabase
      .from('vanguard_stream')
      .select('content')
      .eq('user_id', VANGUARD_USER_ID)
      .gte('timestamp', dayStart)
      .lt('timestamp', dayEnd)
      .ilike('content', 'anchor:%')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    const anchorText = (anchorRaw as any)?.content?.replace(/^anchor:\s*/i, '').trim() ?? null

    const userPrompt = anchorText
      ? `Today's anchor: "${anchorText}". Generate one reset message supporting this specific anchor.`
      : `No anchor set today. Generate one generic attention reset message (direction / process / lowering importance).`

    const llmRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.8,
        max_tokens: 60,
        messages: [
          { role: 'system', content: RESET_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
      }),
    })

    const llmData = await llmRes.json()
    const resetText = llmData.choices?.[0]?.message?.content?.trim()

    if (!resetText) throw new Error('LLM returned empty reset')

    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `🧩 ${resetText}` })
    })

    if (!telegramRes.ok) {
      const err = await telegramRes.json()
      throw new Error(`Telegram error: ${err.description}`)
    }

    await supabase.from('vanguard_stream').insert({
      user_id: VANGUARD_USER_ID,
      content: `[reset sent] ${resetText}`,
      category: 'system:reset',
      timestamp: now.toISOString(),
    })

    console.log(`[reset] done: "${resetText}"`)
    return new Response(JSON.stringify({ success: true, text: resetText }), { status: 200 })

  } catch (err) {
    console.error('[reset] error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})
