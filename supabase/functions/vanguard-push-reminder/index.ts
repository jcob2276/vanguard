/**
 * vanguard-push-reminder — fires every minute via pg_cron.
 * Picks todo_items where reminder_at <= now() and reminder_sent = false,
 * sends web push to all push_subscriptions of the owner, marks reminder_sent.
 */
import { createServiceClient } from "../_shared/supabase.ts";
// @ts-ignore npm import
import webpush from "npm:web-push@3.6.7";

const CONTACT_EMAIL = "mailto:newsletter.jakub@gmail.com";

Deno.serve(async () => {
  const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 });
  }
  webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  const supabase = createServiceClient();

  const now = new Date().toISOString();
  const { data: dueItems, error } = await supabase
    .from("todo_items")
    .select("id, user_id, title, reminder_at")
    .lte("reminder_at", now)
    .eq("reminder_sent", false)
    .neq("status", "done")
    .limit(50);

  if (error) {
    console.error("[push-reminder] fetch error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!dueItems || dueItems.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }));
  }

  // Fetch all subscriptions for the involved users in one query instead of N queries
  // (one per due item) — avoids an N+1 round trip when many items are due at once.
  const userIds = [...new Set(dueItems.map(item => item.user_id))];
  const { data: allSubs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, keys_p256dh, keys_auth")
    .in("user_id", userIds);
  if (subsErr) console.error("[push-reminder] subscriptions fetch error:", subsErr);

  const subsByUser = new Map<string, NonNullable<typeof allSubs>>();
  for (const sub of allSubs || []) {
    if (!subsByUser.has(sub.user_id)) subsByUser.set(sub.user_id, []);
    subsByUser.get(sub.user_id)!.push(sub);
  }

  let sent = 0;
  for (const item of dueItems) {
    const subs = subsByUser.get(item.user_id);

    if (!subs || subs.length === 0) {
      // No push subscription to deliver to — leave reminder_sent=false so it's retried
      // next run instead of being marked "sent" when nothing was actually delivered.
      console.warn(`[push-reminder] no push subscriptions for user ${item.user_id}, skipping item ${item.id}`);
      continue;
    }

    const payload = JSON.stringify({
      title: "⏰ Przypomnienie",
      body: item.title,
      url: "/",
    });

    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
          payload,
        ).catch((e: Error) => console.warn("[push-reminder] send failed:", sub.endpoint, e.message))
      )
    );
    sent++;

    const { error: markErr } = await supabase
      .from("todo_items")
      .update({ reminder_sent: true })
      .eq("id", item.id);
    if (markErr) console.error("[push-reminder] mark sent failed:", item.id, markErr.message);
  }

  return new Response(JSON.stringify({ sent }));
});
