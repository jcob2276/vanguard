/**
 * @function vanguard-push-reminder
 * @trigger pg_cron co minutę
 * @role Niezawodne, serwerowe przypomnienia Web Push działające przy zamkniętej aplikacji.
 * @reads todo_items, supplements, push_subscriptions
 * @writes todo_items, supplements, push_subscriptions
 * @consumer Service Worker aplikacji Vanguard
 * @status active
 */
import { serveJson } from "../_shared/http.ts";
import webpush from "npm:web-push@3.6.7";
import { getWarsawDateString } from "../_shared/time.ts";

const CONTACT_EMAIL = "mailto:newsletter.jakub@gmail.com";

interface PushSubscriptionRow {
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

Deno.serve(serveJson(async (_req, ctx) => {
  const supabase = ctx.supabase;
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublic || !vapidPrivate) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(CONTACT_EMAIL, vapidPublic, vapidPrivate);

  const now = new Date();
  const nowIso = now.toISOString();
  const warsawDate = getWarsawDateString(now);
  const warsawParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const warsawHour = Number(warsawParts.find((part) => part.type === "hour")?.value ?? 0);
  const warsawMinute = Number(warsawParts.find((part) => part.type === "minute")?.value ?? 0);
  const warsawMinutes = warsawHour * 60 + warsawMinute;

  const [{ data: subscriptions, error: subsError }, { data: dueTodos, error: todoError },
    { data: supplements, error: supplementError }] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, keys_p256dh, keys_auth"),
    supabase.from("todo_items")
      .select("id, user_id, title")
      .lte("reminder_at", nowIso)
      .eq("reminder_sent", false)
      .neq("status", "done")
      .limit(50),
    supabase.from("supplements")
      .select("id, user_id, name, emoji, reminder_time, start_date, end_date, reminder_sent_date")
      .eq("active", true)
      .not("reminder_time", "is", null),
  ]);

  if (subsError) throw new Error(`Push subscriptions fetch failed: ${subsError.message}`);
  if (todoError) throw new Error(`Todo reminders fetch failed: ${todoError.message}`);
  if (supplementError) throw new Error(`Supplement reminders fetch failed: ${supplementError.message}`);

  const subsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const sub of subscriptions ?? []) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  const sendToUser = async (userId: string, payload: PushPayload) => {
    const userSubs = subsByUser.get(userId) ?? [];
    if (userSubs.length === 0) return { delivered: false, error: "no_active_subscription" };

    let delivered = false;
    const errors: string[] = [];
    const staleEndpoints: string[] = [];

    await Promise.all(userSubs.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
        delivered = true;
      } catch (error: unknown) {
        const pushError = error as { statusCode?: number; message?: string };
        if (pushError.statusCode === 404 || pushError.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
        errors.push(pushError.message ?? `push_${pushError.statusCode ?? "unknown"}`);
      }
    }));

    if (staleEndpoints.length > 0) {
      const { error } = await supabase.from("push_subscriptions")
        .delete().eq("user_id", userId).in("endpoint", staleEndpoints);
      if (error) console.error("[push-reminder] stale subscription cleanup failed", error);
    }

    return { delivered, error: errors.join("; ") || null };
  };

  let sentTodos = 0;
  for (const item of dueTodos ?? []) {
    const result = await sendToUser(item.user_id, {
      title: "⏰ Przypomnienie",
      body: item.title,
      url: "/todo",
      tag: `todo-${item.id}`,
    });
    if (!result.delivered) continue;

    const { error } = await supabase.from("todo_items")
      .update({ reminder_sent: true }).eq("id", item.id);
    if (error) console.error("[push-reminder] todo mark sent failed", item.id, error);
    else sentTodos++;
  }

  const dueSupplements = (supplements ?? []).filter((supplement) => {
    if (supplement.start_date && supplement.start_date > warsawDate) return false;
    if (supplement.end_date && supplement.end_date < warsawDate) return false;
    if (supplement.reminder_sent_date === warsawDate || !supplement.reminder_time) return false;
    const [hour, minute] = supplement.reminder_time.split(":").map(Number);
    return warsawMinutes >= hour * 60 + minute;
  });

  let sentSupplements = 0;
  for (const supplement of dueSupplements) {
    const result = await sendToUser(supplement.user_id, {
      title: "💊 Przypomnienie o suplemencie",
      body: `Czas na: ${supplement.emoji || "💊"} ${supplement.name}`,
      url: "/",
      tag: `supplement-${supplement.id}-${warsawDate}`,
    });
    if (!result.delivered) continue;

    const { error } = await supabase.from("supplements")
      .update({ reminder_sent_date: warsawDate }).eq("id", supplement.id);
    if (error) console.error("[push-reminder] supplement mark sent failed", supplement.id, error);
    else sentSupplements++;
  }

  return {
    sent_todos: sentTodos,
    sent_supplements: sentSupplements,
  };
}, { auth: "service" }));
