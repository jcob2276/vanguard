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

  let sent = 0;
  for (const item of dueItems) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", item.user_id);

    if (subs && subs.length > 0) {
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
    }

    const { error: markErr } = await supabase
      .from("todo_items")
      .update({ reminder_sent: true })
      .eq("id", item.id);
    if (markErr) console.error("[push-reminder] mark sent failed:", item.id, markErr.message);
  }

  return new Response(JSON.stringify({ sent }));
});
