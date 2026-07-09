/**
 * @function vanguard-push-reminder
 * @trigger pg_cron co minutę
 * @role Przypomnienia: wysyła powiadomienia web push i Telegram o zaległych todo i zaplanowanych suplementach.
 * @reads todo_items, supplements, push_subscriptions
 * @writes todo_items, supplements
 * @calls api.telegram.org (bezpośrednio)
 * @consumer Powiadomienia push w przeglądarce i Telegramie użytkownika
 * @status active
 */
import { createServiceClient } from "../_shared/supabase.ts";
// @ts-ignore npm import
import webpush from "npm:web-push@3.6.7";
import { sendMessageParsed } from "../_shared/telegram.ts";
// Force upload of domain package for shared dependencies
import type {} from "@vanguard/domain";

const CONTACT_EMAIL = "mailto:newsletter.jakub@gmail.com";


Deno.serve(async () => {
  const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
  const TG_TOKEN      = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const TG_CHAT_ID    = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 });
  }
  webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  const supabase = createServiceClient();

  const now = new Date();
  const nowIso = now.toISOString();

  // Get current Warsaw date and time for supplement schedules
  const warsawDate = now.toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
  const warsawTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now); // e.g. "08:15"

  // ----------------------------------------------------
  // Part 1: Todo Item Reminders
  // ----------------------------------------------------
  const { data: dueTodos, error: todoErr } = await supabase
    .from("todo_items")
    .select("id, user_id, title, reminder_at")
    .lte("reminder_at", nowIso)
    .eq("reminder_sent", false)
    .neq("status", "done")
    .limit(50);

  if (todoErr) {
    console.error("[push-reminder] fetch todos error:", todoErr);
  }

  // ----------------------------------------------------
  // Part 2: Supplement Reminders
  // ----------------------------------------------------
  const { data: activeSuplements, error: suplErr } = await supabase
    .from("supplements")
    .select("id, user_id, name, emoji, slug, reminder_time, start_date, end_date, reminder_sent_date")
    .eq("active", true)
    .not("reminder_time", "is", null);

  if (suplErr) {
    console.error("[push-reminder] fetch supplements error:", suplErr);
  }

  const dueSupplements = (activeSuplements || []).filter(supl => {
    // Check cycle dates
    if (supl.start_date && supl.start_date > warsawDate) return false;
    if (supl.end_date && supl.end_date < warsawDate) return false;

    // Check if already sent today
    if (supl.reminder_sent_date === warsawDate) return false;

    // Check time: supl.reminder_time is HH:MM:SS or HH:MM
    const parts = supl.reminder_time.split(":");
    if (parts.length < 2) return false;
    const suplHour = parseInt(parts[0], 10);
    const suplMin = parseInt(parts[1], 10);

    const nowParts = warsawTime.split(":");
    const nowHour = parseInt(nowParts[0], 10);
    const nowMin = parseInt(nowParts[1], 10);

    const suplMinutes = suplHour * 60 + suplMin;
    const nowMinutes = nowHour * 60 + nowMin;

    return nowMinutes >= suplMinutes;
  });

  const dueTodosCount = dueTodos?.length || 0;
  const dueSupsCount = dueSupplements.length;

  if (dueTodosCount === 0 && dueSupsCount === 0) {
    return new Response(JSON.stringify({ sent_todos: 0, sent_supplements: 0 }));
  }

  // Gather unique user IDs involved in notifications
  const userIds = [
    ...new Set([
      ...(dueTodos || []).map(item => item.user_id),
      ...dueSupplements.map(supl => supl.user_id)
    ])
  ];

  // Fetch push subscriptions for all involved users
  const { data: allSubs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, keys_p256dh, keys_auth")
    .in("user_id", userIds);

  if (subsErr) {
    console.error("[push-reminder] push subscriptions fetch error:", subsErr);
  }

  const subsByUser = new Map<string, any[]>();
  for (const sub of allSubs || []) {
    if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
    subsByUser.get(sub.user_id)!.push(sub);
  }

  let sentTodos = 0;
  let sentSups = 0;

  // Process due todos
  for (const item of dueTodos || []) {
    const subs = subsByUser.get(item.user_id);
    if (!subs || subs.length === 0) {
      console.warn(`[push-reminder] no push subscriptions for user ${item.user_id}, skipping todo ${item.id}`);
      continue;
    }

    const payload = JSON.stringify({
      title: "⏰ Przypomnienie",
      body: item.title,
      url: "/",
    });

    const deliveryResults = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          payload,
        )
      )
    );

    const anyDelivered = deliveryResults.some(r => r.status === "fulfilled");
    if (!anyDelivered) {
      console.warn(`[push-reminder] all sends failed for todo ${item.id}`);
      continue;
    }
    sentTodos++;

    const { error: markErr } = await supabase
      .from("todo_items")
      .update({ reminder_sent: true })
      .eq("id", item.id);
    if (markErr) console.error("[push-reminder] mark todo sent failed:", item.id, markErr.message);
  }

  // Process due supplements
  for (const supl of dueSupplements) {
    const subs = subsByUser.get(supl.user_id) || [];
    
    // Web Push
    if (subs.length > 0) {
      const payload = JSON.stringify({
        title: "💊 Przypomnienie o suplemencie",
        body: `Czas na: ${supl.emoji || "💊"} ${supl.name}`,
        url: "/dashboard",
      });

      await Promise.allSettled(
        subs.map(sub =>
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
            payload,
          )
        )
      );
    }

    // Telegram Push
    if (TG_TOKEN && TG_CHAT_ID) {
      const text = `💊 <b>Przypomnienie o suplemencie</b>\n\nCzas na: <b>${supl.emoji || "💊"} ${supl.name}</b>`;
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: "✅ Zaloguj wzięcie",
              callback_data: `supl_s_${supl.slug}`,
            }
          ]
        ]
      };
      await sendMessageParsed(TG_TOKEN, parseInt(TG_CHAT_ID, 10), text, {
        parseMode: "HTML",
        replyMarkup,
      });
    }

    sentSups++;

    const { error: markErr } = await supabase
      .from("supplements")
      .update({ reminder_sent_date: warsawDate })
      .eq("id", supl.id);

    if (markErr) console.error("[push-reminder] mark supplement sent failed:", supl.id, markErr.message);
  }

  return new Response(JSON.stringify({ sent_todos: sentTodos, sent_supplements: sentSups }));
});
