import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '2031950629');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
const VANGUARD_USER_ID = Deno.env.get('VANGUARD_USER_ID') || '165ae341-670c-46ce-82dc-434c4dbfcdfd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getWarsawDayBoundaries(dateStr: string): { start: string; end: string } {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const tzLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    timeZoneName: 'shortOffset'
  }).formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT+2';
  const m = tzLabel.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = (m?.[1] === '+') ? 1 : -1;
  const offsetMs = sign * ((parseInt(m?.[2] || '2') * 60 + parseInt(m?.[3] || '0')) * 60000);
  const startUTC = new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs;
  return {
    start: new Date(startUTC).toISOString(),
    end:   new Date(startUTC + 86400000).toISOString()
  };
}

async function sendTelegram(text: string): Promise<number | null> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
  });
  const data = await res.json();
  if (!data.ok) console.error('[reconciliation] Telegram error:', JSON.stringify(data));
  return data.result?.message_id ?? null;
}

Deno.serve(async (_req) => {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    // Guard: skip only if an evening reconciliation was already sent today.
    // Uses 17:00 Warsaw as cutoff — morning rows (planning sessions) must not block
    // the evening cron. BUG-02 fix.
    const eveningCutoff = (() => {
      const { start: dayStart } = getWarsawDayBoundaries(todayStr);
      return new Date(new Date(dayStart).getTime() + 17 * 3600000).toISOString();
    })();

    const { data: existing } = await supabase
      .from('daily_reconciliations')
      .select('id')
      .eq('user_id', VANGUARD_USER_ID)
      .eq('date', todayStr)
      .gte('created_at', eveningCutoff)
      .maybeSingle();

    if (existing) {
      console.log('[reconciliation] already sent this evening — skipping');
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const { start: dayStart, end: dayEnd } = getWarsawDayBoundaries(todayStr);

    // Yesterday's date (for pulling today's plan which was created last night)
    const yesterdayStr = new Date(new Date(todayStr).getTime() - 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    const [frictionRes, anchorRes, planRes] = await Promise.all([
      supabase
        .from('friction_events')
        .select('id, friction_type, actual_behavior, declared_intention, immediate_cost')
        .eq('user_id', VANGUARD_USER_ID)
        .gte('occurred_at', dayStart)
        .lt('occurred_at', dayEnd)
        .order('occurred_at', { ascending: true }),
      supabase
        .from('vanguard_stream')
        .select('content')
        .eq('user_id', VANGUARD_USER_ID)
        .gte('timestamp', dayStart)
        .lt('timestamp', dayEnd)
        .ilike('content', 'anchor:%')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Today's plan = planning session from yesterday evening
      supabase
        .from('daily_reconciliations')
        .select('planning_summary')
        .eq('user_id', VANGUARD_USER_ID)
        .eq('date', yesterdayStr)
        .eq('type', 'planning')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (frictionRes.error) console.error('[reconciliation] friction query error:', frictionRes.error);
    if (anchorRes.error) console.error('[reconciliation] anchor query error:', anchorRes.error);

    const evList = frictionRes.data || [];
    const hasEvents = evList.length > 0;
    const mode = hasEvents ? 'full' : 'checkin';

    const anchorRaw = anchorRes.data?.content || null;
    const anchorText = anchorRaw
      ? anchorRaw.replace(/^anchor:\s*/i, '').trim()
      : null;

    // Extract today's plan from yesterday's planning session
    const planningSummary = planRes.data?.planning_summary as any || null;
    const top3: string[] = planningSummary?.top3 || [];
    const firstMove: string | null = planningSummary?.first_move_morning || planningSummary?.pierwszy_ruch || null;
    const tensionAction: string | null = planningSummary?.tension_action?.task || null;

    console.log(`[reconciliation] anchor=${anchorText ? '"' + anchorText.substring(0, 50) + '"' : 'none'} plan=${top3.length > 0 ? 'yes' : 'no'}`);

    let messageText: string;

    // --- PLAN NA DZIŚ (z wczorajszego planowania) ---
    let planBlock = '';
    if (top3.length > 0) {
      planBlock =
        `*Plan na dziś był:*\n` +
        top3.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');
      if (tensionAction) planBlock += `\n⚡ Ruch napięciowy: ${tensionAction}`;
      planBlock += '\n\n';
    }

    if (hasEvents) {
      const lines = evList.map((e: any, i: number) => {
        const type = e.friction_type || 'event';
        const beh  = (e.actual_behavior || e.declared_intention || '(brak opisu)').substring(0, 80);
        return `${i + 1}. \`${type}\` — ${beh}`;
      }).join('\n');

      messageText =
        `*Daily reconciliation — 5 min*\n\n` +
        planBlock +
        `Dziś wykryłem:\n${lines}\n`;
    } else {
      messageText =
        `*Daily check-in — 3 min*\n\n` +
        planBlock +
        `Nie wykryłem dziś mikrotarć ani pozytywnych mikroakcji.\n`;
    }

    if (anchorText) {
      messageText += `\n*Anchor:* ${anchorText}\n`;
    }

    if (hasEvents) {
      messageText +=
        `\n*Correction:*\n` +
        `1. Co system źle zrozumiał?\n` +
        `2. Jaki był największy koszt dnia?\n` +
        `3. Jaki był najlepszy ruch dnia?\n` +
        `4. Ocena dnia 1–5.`;
    } else {
      messageText +=
        `\n*Correction:*\n` +
        `1. Czy to był faktycznie czysty dzień, czy czegoś nie zalogowałeś?\n` +
        `2. Najważniejszy ruch dnia?\n` +
        `3. Największy koszt dnia?\n` +
        `4. Ocena dnia 1–5.`;
    }

    if (anchorText) {
      const anchorQ = hasEvents ? 5 : 5;
      messageText +=
        `\n${anchorQ}. Anchor zrobiony? tak / nie / częściowo\n` +
        `${anchorQ + 1}. Jeśli nie — co realnie zatrzymało?`;
    }

    messageText +=
      `\n\n_Reflection (opcjonalnie):_\n` +
      `${anchorText ? '7' : '5'}. Co dzisiaj realnie Cię zasiliło albo ustabilizowało?`;

    const messageId = await sendTelegram(messageText);

    await supabase.from('daily_reconciliations').insert({
      user_id:             VANGUARD_USER_ID,
      date:                todayStr,
      status:              'sent',
      mode,
      events_count:        evList.length,
      events_summary:      evList.map((e: any) => ({
        id:            e.id,
        friction_type: e.friction_type,
        behavior:      String(e.actual_behavior || '').substring(0, 100)
      })),
      telegram_message_id: messageId,
      parsed_response:     anchorText ? { anchor: anchorText } : null
    });

    console.log(`[reconciliation] sent mode=${mode} events=${evList.length} anchor=${!!anchorText} msg_id=${messageId}`);
    return new Response(JSON.stringify({ ok: true, mode, events_count: evList.length, anchor: !!anchorText }), { status: 200 });

  } catch (err) {
    console.error('[reconciliation] fatal:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
