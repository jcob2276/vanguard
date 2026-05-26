import { sendMessageParsed } from "../_shared/telegram.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { getWarsawDayBoundaries } from "../_shared/time.ts";

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "";
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');
const VANGUARD_USER_ID = getVanguardUserId();

const supabase = createServiceClient();

async function sendTelegram(text: string): Promise<number | null> {
  const result = await sendMessageParsed(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text, {
    parseMode: 'Markdown',
  });
  if (!result.ok) {
    console.error('[reconciliation] Telegram error:', result.description);
    return null;
  }
  return result.messageId ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200 });
  try {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });

    // Allow manual force-override via ?force=true query param
    const url = new URL(req.url);
    const forceOverride = url.searchParams.get('force') === 'true';

    if (!forceOverride) {
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
        .in('event_kind', ['friction_event', 'positive_micro_action'])
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
        .not('planning_summary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (frictionRes.error) console.error('[reconciliation] friction query error:', frictionRes.error);
    if (anchorRes.error) console.error('[reconciliation] anchor query error:', anchorRes.error);
    if (planRes.error) console.error('[reconciliation] plan query error:', planRes.error);

    const warsawDay = new Date().toLocaleDateString('en-US', { timeZone: 'Europe/Warsaw', weekday: 'long' });
    const isSaturday = warsawDay === 'Saturday';

    if (isSaturday) {
      console.log('[reconciliation] triggering Saturday Check-In flow');
      const messageText = 
        `🧱 *Saturday Check-In: WEEKLY INTEGRATION + REALITY REVIEW* 🧱\n\n` +
        `*Część 1: INPUT*\n` +
        `1. Co konsumowałeś najwięcej?\n` +
        `2. Co przeczytałeś / oglądałeś / analizowałeś?\n` +
        `3. Ile było konsumowania vs tworzenia?\n` +
        `4. Czy input prowadził do działania czy zastępował działanie?\n\n` +
        `_Nagraj głosówkę lub odpisz._`;

      const messageId = await sendTelegram(messageText);

      const { data: insData, error: insErr } = await supabase.from('daily_reconciliations').insert({
        user_id:             VANGUARD_USER_ID,
        date:                todayStr,
        status:              'sent',
        mode:                'checkin',
        telegram_message_id: messageId,
        parsed_response:     { mode: 'saturday_checkin', step: 'input', answers: {} }
      }).select();

      if (insErr) {
        console.error('[reconciliation] Saturday insert error:', insErr);
        throw new Error('Insert failed: ' + insErr.message);
      }

      console.log(`[reconciliation] Saturday check-in sent msg_id=${messageId} data=${JSON.stringify(insData)}`);
      return new Response(JSON.stringify({ ok: true, mode: 'saturday_checkin' }), { status: 200 });
    }

    const evList = frictionRes.data || [];
    const hasEvents = evList.length > 0;
    const mode = hasEvents ? 'full' : 'checkin';

    const anchorRaw = anchorRes.data?.content || null;
    const anchorText = anchorRaw
      ? anchorRaw.replace(/^anchor:\s*/i, '').trim()
      : null;

    // Extract today's plan from yesterday's planning session
    const planningSummary = planRes.data?.planning_summary as any || null;
    const prodArtifact = planningSummary?.production_artifact as { artifact?: string } | undefined;
    const prodArtifactName = prodArtifact?.artifact || null;
    const oneClearMove = planningSummary?.one_clear_move || (planningSummary?.top3 as string[] || [])[0] || null;
    const tensionAction = (planningSummary?.tension_action as { action?: string } | undefined)?.action || planningSummary?.tension_action?.task || null;

    console.log(`[reconciliation] anchor=${anchorText ? '"' + anchorText.substring(0, 50) + '"' : 'none'} plan=${oneClearMove ? 'yes' : 'no'}`);

    let messageText: string;

    // Plan block — from last night's planning session
    let planBlock = '';
    if (oneClearMove || prodArtifactName || tensionAction) {
      planBlock = `*Plan był:*\n`;
      if (oneClearMove) planBlock += `→ Pierwszy blok: ${oneClearMove}\n`;
      if (prodArtifactName) planBlock += `→ Artefakt: ${prodArtifactName}\n`;
      if (tensionAction) planBlock += `⚡ Ruch napięciowy: ${tensionAction}\n`;
      planBlock += '\n';
    }

    // Friction summary (if any)
    let frictionBlock = '';
    if (hasEvents) {
      const lines = evList.map((e: any, i: number) => {
        const type = e.friction_type || 'event';
        const beh  = (e.actual_behavior || e.declared_intention || '(brak opisu)').substring(0, 80);
        return `${i + 1}. \`${type}\` — ${beh}`;
      }).join('\n');
      frictionBlock = `System wykrył:\n${lines}\n\n`;
    }

    messageText =
      `*Zamknięcie dnia — głosówka.*\n\n` +
      planBlock +
      frictionBlock +
      `Powiedz:\n` +
      `1. Jaki artefakt dziś powstał?\n` +
      `2. Czy pierwsze 90 minut było bez stymulacji?\n` +
      `3. Jaki ruch napięciowy zrobiłeś albo ominąłeś?\n` +
      `4. Gdzie analiza zastąpiła działanie?\n` +
      `5. Co jest pierwszym artefaktem jutra?`;

    const messageId = await sendTelegram(messageText);

    const { error: reconInsertErr } = await supabase.from('daily_reconciliations').insert({
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
    if (reconInsertErr) {
      console.error('[reconciliation] evening insert failed:', reconInsertErr);
      throw new Error(`Insert failed: ${reconInsertErr.message}`);
    }

    console.log(`[reconciliation] sent mode=${mode} events=${evList.length} anchor=${!!anchorText} msg_id=${messageId}`);
    return new Response(JSON.stringify({ ok: true, mode, events_count: evList.length, anchor: !!anchorText }), { status: 200 });

  } catch (err) {
    console.error('[reconciliation] fatal:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
