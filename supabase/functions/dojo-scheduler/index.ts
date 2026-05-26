/**
 * dojo-scheduler
 *
 * Cron: twice daily
 *   Morning  — 06:00 UTC (08:00 Warsaw summer)  → sends Rep A for current day
 *   Afternoon — 13:00 UTC (15:00 Warsaw summer) → sends Rep B reminder if stuck
 *
 * Does NOT advance state. State is only advanced by dojo-telegram when user submits a rep.
 * Scheduler only sends reminders if the user hasn't submitted the expected rep yet.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { sendMessage } from "../_shared/telegram.ts";

const DOJO_TOKEN = Deno.env.get("DOJO_TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DOJO_USER_ID = Deno.env.get("VANGUARD_USER_ID") || "";
const DOJO_CHAT_ID = parseInt(Deno.env.get("DOJO_TELEGRAM_CHAT_ID") || "0");

const SKILL_SLUG = "persuasive_communication_mode_v1_jakub_adapted";

const supabase = createServiceClient();

async function sendDojoMessage(text: string): Promise<void> {
  if (!DOJO_CHAT_ID) {
    console.warn("DOJO_TELEGRAM_CHAT_ID not set, skipping send");
    return;
  }
  const res = await sendMessage(DOJO_TOKEN, DOJO_CHAT_ID, text, { parseMode: "Markdown" });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[dojo-scheduler] sendMessage error:", res.status, errBody.substring(0, 200));
  }
}

async function getActiveRun(): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("dojo_runs")
    .select("*")
    .eq("user_id", DOJO_USER_ID)
    .not("phase", "eq", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getActiveRun:", error.message);
    return null;
  }
  return data;
}

async function getCurriculumDay(day: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("dojo_curricula")
    .select("days")
    .eq("slug", SKILL_SLUG)
    .single();
  if (error || !data) return null;
  const dayData = (data.days as Record<string, unknown>[]).find((d) => d.day === day);
  return dayData || null;
}

async function hasRepTodayForPhase(runId: string, day: number, repType: string): Promise<boolean> {
  const today = new Date().toLocaleDateString("sv", { timeZone: "Europe/Warsaw" });
  const startOfDay = `${today}T00:00:00+02:00`;

  const { count } = await supabase
    .from("dojo_reps")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("day", day)
    .eq("rep_type", repType)
    .gte("created_at", startOfDay);

  return (count || 0) > 0;
}

function getSlotForNow(): "morning" | "afternoon" | "none" {
  const warsawHour = parseInt(
    new Date().toLocaleString("pl", { timeZone: "Europe/Warsaw", hour: "numeric", hour12: false })
  );

  // Morning window: 6–11 Warsaw
  if (warsawHour >= 6 && warsawHour < 11) return "morning";
  // Afternoon window: 14–19 Warsaw
  if (warsawHour >= 14 && warsawHour < 19) return "afternoon";
  return "none";
}

serve(async () => {
  console.log('[dojo-scheduler] Dojo scheduler is disabled by user configuration.');
  return new Response("Dojo scheduler is disabled", { status: 410 });
  try {
    const slot = getSlotForNow();
    if (slot === "none") {
      console.log("Outside scheduling windows, skipping.");
      return new Response("ok");
    }

    const run = await getActiveRun();
    if (!run) {
      console.log("No active dojo run.");
      return new Response("ok");
    }

    const phase = run.phase as string;
    const day = run.current_day as number;

    if (phase === "completed") {
      console.log("Run completed, nothing to schedule.");
      return new Response("ok");
    }

    const dayData = await getCurriculumDay(day);
    if (!dayData) {
      console.error("Curriculum day not found:", day);
      return new Response("error");
    }

    // Morning: remind if rep_a not yet done today
    if (slot === "morning" && phase === "rep_a") {
      const done = await hasRepTodayForPhase(run.id as string, day, "rep_a");
      if (done) {
        console.log("Rep A already done today, skip morning reminder.");
        return new Response("ok");
      }

      const repA = dayData.rep_a as Record<string, unknown>;
      const constraint = dayData.primary_constraint as string;
      await sendDojoMessage(
        `🥋 *Dojo — Dzień ${day}: ${dayData.focus}*\n\n` +
        `🎯 Constraint: _${constraint}_\n\n` +
        `*Rep A (${repA.duration_seconds}s):*\n${repA.instruction}\n\nNagraj voice note.`
      );
      console.log(`Morning reminder sent for day ${day}.`);
      return new Response("ok");
    }

    // Afternoon: remind if stuck on rep_b or correction_rep_a
    if (slot === "afternoon" && (phase === "rep_b" || phase === "correction_rep_a")) {
      const repType = phase === "correction_rep_a" ? "correction_rep_a" : "rep_b";
      const done = await hasRepTodayForPhase(run.id as string, day, repType);
      if (done) {
        console.log(`${repType} already done today, skip afternoon reminder.`);
        return new Response("ok");
      }

      if (phase === "correction_rep_a") {
        const corrRep = dayData.correction_rep_a as Record<string, unknown>;
        await sendDojoMessage(
          `⚡ *Dojo — Correction Rep (Dzień ${day})*\n\n` +
          `${corrRep.instruction_template}\n\nNagraj voice note (${corrRep.duration_seconds}s).`
        );
      } else {
        const repB = dayData.rep_b as Record<string, unknown>;
        await sendDojoMessage(
          `🎯 *Dojo — Rep B (Dzień ${day})*\n\n` +
          `${repB.instruction}\n\nNagraj voice note (${repB.duration_seconds}s).`
        );
      }
      console.log(`Afternoon reminder sent for day ${day}, phase ${phase}.`);
      return new Response("ok");
    }

    // Afternoon: if stuck on real_life_transfer, nudge
    if (slot === "afternoon" && phase === "real_life_transfer") {
      const transfer = dayData.real_life_transfer as Record<string, unknown>;
      await sendDojoMessage(
        `🌍 *Transfer (Dzień ${day})*\n\n${transfer.instruction}\n\n✅ Gdy zrobisz: wyślij "done"`
      );
      console.log("Transfer reminder sent.");
      return new Response("ok");
    }

    console.log(`No action for slot=${slot}, phase=${phase}.`);
    return new Response("ok");
  } catch (err) {
    console.error("dojo-scheduler error:", err);
    return new Response("error", { status: 500 });
  }
});
