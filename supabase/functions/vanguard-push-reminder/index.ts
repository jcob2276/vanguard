/**
 * @function vanguard-push-reminder
 * @trigger pg_cron co minutę
 * @role Niezawodne, serwerowe przypomnienia: Web Push (PWA) + FCM (Capacitor APK).
 * @reads todo_items, supplements, life_obligations, push_subscriptions, push_fcm_tokens
 * @writes todo_items, supplements, life_obligations, push_subscriptions, push_fcm_tokens
 * @consumer Service Worker (PWA) / FCM (Android APK)
 * @status active
 */
import { serveJson } from "../_shared/http.ts";
import webpush from "npm:web-push@3.6.7";
import { isFcmConfigured, sendFcmToToken } from "../_shared/fcmPush.ts";
import {
  dueLeadOffsetsToday,
  getWarsawDateString,
  leadLabel,
  parseSentReminders,
  type LifeObligationKind,
} from "@vanguard/domain";

const CONTACT_EMAIL = "mailto:newsletter.jakub@gmail.com";
/** Morning window start (Warsaw) for life-admin obligation pushes. */
const OBLIGATION_REMINDER_AFTER_MINUTES = 9 * 60;

interface PushSubscriptionRow {
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

interface FcmTokenRow {
  user_id: string;
  token: string;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface LifeObligationRow {
  id: string;
  user_id: string;
  title: string;
  kind: LifeObligationKind;
  related_name: string | null;
  anchor_date: string;
  recurrence: string;
  lead_offsets: number[] | null;
  sent_reminders: unknown;
}

Deno.serve(serveJson(async (_req, ctx) => {
  const supabase = ctx.supabase;
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublic || !vapidPrivate) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(CONTACT_EMAIL, vapidPublic, vapidPrivate);
  const fcmReady = isFcmConfigured();

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

  const [
    { data: subscriptions, error: subsError },
    { data: fcmTokens, error: fcmError },
    { data: dueTodos, error: todoError },
    { data: supplements, error: supplementError },
    { data: obligations, error: obligationError },
  ] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, keys_p256dh, keys_auth"),
    supabase.from("push_fcm_tokens").select("user_id, token"),
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
    supabase.from("life_obligations")
      .select("id, user_id, title, kind, related_name, anchor_date, recurrence, lead_offsets, sent_reminders")
      .eq("is_active", true)
      .limit(200),
  ]);

  if (subsError) throw new Error(`Push subscriptions fetch failed: ${subsError.message}`);
  if (fcmError) throw new Error(`FCM tokens fetch failed: ${fcmError.message}`);
  if (todoError) throw new Error(`Todo reminders fetch failed: ${todoError.message}`);
  if (supplementError) throw new Error(`Supplement reminders fetch failed: ${supplementError.message}`);
  if (obligationError) throw new Error(`Life obligations fetch failed: ${obligationError.message}`);

  const subsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const sub of subscriptions ?? []) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  const fcmByUser = new Map<string, FcmTokenRow[]>();
  for (const row of fcmTokens ?? []) {
    const list = fcmByUser.get(row.user_id) ?? [];
    list.push(row);
    fcmByUser.set(row.user_id, list);
  }

  const sendToUser = async (userId: string, payload: PushPayload) => {
    const userSubs = subsByUser.get(userId) ?? [];
    const userFcm = fcmByUser.get(userId) ?? [];
    if (userSubs.length === 0 && userFcm.length === 0) {
      return { delivered: false, error: "no_active_subscription" };
    }

    let delivered = false;
    const errors: string[] = [];
    const staleEndpoints: string[] = [];
    const staleTokens: string[] = [];

    await Promise.all([
      ...userSubs.map(async (sub) => {
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
      }),
      ...userFcm.map(async (row) => {
        if (!fcmReady) return;
        try {
          const result = await sendFcmToToken(row.token, payload);
          if (result === "ok") delivered = true;
          else if (result === "unregistered") staleTokens.push(row.token);
        } catch (error: unknown) {
          errors.push(error instanceof Error ? error.message : "fcm_unknown");
        }
      }),
    ]);

    if (staleEndpoints.length > 0) {
      const { error } = await supabase.from("push_subscriptions")
        .delete().eq("user_id", userId).in("endpoint", staleEndpoints);
      if (error) console.error("[push-reminder] stale subscription cleanup failed", error);
    }
    if (staleTokens.length > 0) {
      const { error } = await supabase.from("push_fcm_tokens")
        .delete().eq("user_id", userId).in("token", staleTokens);
      if (error) console.error("[push-reminder] stale FCM cleanup failed", error);
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

  let sentObligations = 0;
  if (warsawMinutes >= OBLIGATION_REMINDER_AFTER_MINUTES) {
    for (const raw of (obligations ?? []) as LifeObligationRow[]) {
      const due = dueLeadOffsetsToday({
        anchor_date: raw.anchor_date,
        recurrence: raw.recurrence,
        lead_offsets: raw.lead_offsets ?? [],
        sent_reminders: raw.sent_reminders,
      }, warsawDate);
      if (due.length === 0) continue;

      const who = raw.related_name ? ` (${raw.related_name})` : "";
      for (const hit of due) {
        const result = await sendToUser(raw.user_id, {
          title: "📅 Termin",
          body: `${raw.title}${who} — ${leadLabel(hit.offset)} (${hit.occurrence})`,
          url: "/terminy",
          tag: `obligation-${raw.id}-${hit.key}`,
        });
        if (!result.delivered) continue;

        const nextSent = [...parseSentReminders(raw.sent_reminders), hit.key];
        raw.sent_reminders = nextSent;
        const { error } = await supabase.from("life_obligations")
          .update({ sent_reminders: nextSent, updated_at: nowIso })
          .eq("id", raw.id);
        if (error) console.error("[push-reminder] obligation mark sent failed", raw.id, error);
        else sentObligations++;
      }
    }
  }

  return {
    sent_todos: sentTodos,
    sent_supplements: sentSupplements,
    sent_obligations: sentObligations,
    fcm_configured: fcmReady,
  };
}, { auth: "service" }));
