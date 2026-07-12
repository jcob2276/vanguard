/**
 * @function vanguard-wiki-compiler
 * @trigger HTTP POST / manual / cron
 * @role Kompilator wiki: agreguje i kompiluje fakty z grafu wiedzy w syntetyczne artykuły wiki.
 * @reads vanguard_wiki_pages, vanguard_wiki_sources, vanguard_wiki_review_items, vanguard_stream, friction_events, daily_reconciliations, confirmed_friction_events, vanguard_daily_aggregates, vanguard_behavioral_patterns, vanguard_knowledge, user_settings
 * @writes vanguard_wiki_pages, vanguard_wiki_sources, vanguard_wiki_review_items, vanguard_wiki_runs, vanguard_knowledge
 * @calls deepseek-v4-flash, text-embedding-3-small
 * @consumer Sekcja Wiki / Baza wiedzy w aplikacji frontendowej
 * @status active
 */
import { resolveUserScope } from "../_shared/supabase.ts";
import { serveJson } from "../_shared/http.ts";
import { compileForUser } from "./compiler.ts";

Deno.serve(serveJson(async (req, ctx) => {
    const supabase = ctx.supabase;
    const body = await req.json().catch(() => ({}));
    const requestedUserId = body.userId ? String(body.userId) : null;
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    const cronSecret = Deno.env.get("VANGUARD_CRON_SECRET") || "";
    const isCron = !!cronSecret && bearer === cronSecret;

    let canCompileAllUsers = isCron;
    let scopedUserId: string | null = requestedUserId;
    if (!isCron) {
      const scoped = await resolveUserScope(req, requestedUserId);
      canCompileAllUsers = scoped.isServiceRole && !requestedUserId;
      scopedUserId = requestedUserId || scoped.userId;
      if (!scoped.isServiceRole && !scopedUserId) throw new Error("Missing userId");
    }

    const mode = String(body.mode || "incremental");
    const days = Math.max(1, Math.min(90, Number(body.days ?? 21)));
    const limit = Math.max(10, Math.min(120, Number(body.limit ?? 60)));
    const dryRun = !!body.dry_run;

    let userIds: string[] = [];
    if (scopedUserId) userIds = [scopedUserId];
    else if (!canCompileAllUsers) throw new Error("Missing userId");
    else {
      const { data, error } = await supabase.from("user_settings").select("user_id").not("user_id", "is", null);
      if (error) throw error;
      userIds = Array.from(new Set((data || []).map((row: any) => row.user_id).filter(Boolean)));
    }
    if (!userIds.length) throw new Error("No users found");

    const results = [];
    for (const userId of userIds) {
      try {
        results.push({ user_id: userId, ...(await compileForUser(supabase, userId, { mode, days, limit, dryRun })) });
      } catch (err) {
        await supabase.from("vanguard_wiki_runs").insert({
          user_id: userId, mode, source_window: { days, limit },
          status: "failed", error: String((err as Error)?.message || err),
        });
        results.push({ user_id: userId, success: false, error: String((err as Error)?.message || err) });
      }
    }

    const ok = results.every((r: any) => r.success);
    return { success: ok, results };
}, { auth: 'none' }));
