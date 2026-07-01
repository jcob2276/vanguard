import { sendMessageParsed } from "../_shared/telegram.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { getWarsawDayBoundaries } from "../_shared/time.ts";
import { logAuditEvent } from "../_shared/audit.ts";
import { logCriticalError } from "../_shared/errorLogging.ts";
import { deepseekChat } from "../_shared/deepseek.ts";
import { getRecentStrongBehavioralPatterns } from "../_shared/vanguardPatterns.ts";

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get("TELEGRAM_CHAT_ID") || "0");
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const VANGUARD_USER_ID = getVanguardUserId();

const supabase = createServiceClient();

type StreamRow = {
  id?: string;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

async function sendTelegram(text: string): Promise<number | null> {
  const result = await sendMessageParsed(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, text, {
    parseMode: "Markdown",
  });
  if (!result.ok) {
    console.error("[reconciliation] Telegram error:", result.description);
    return null;
  }
  return result.messageId ?? null;
}

function compactRows(rows: StreamRow[], limit = 12): string {
  return rows.slice(0, limit).map((row, index) => {
    const time = new Date(row.created_at).toLocaleTimeString("pl-PL", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
    });
    const text = String(row.content || "").replace(/\s+/g, " ").trim().slice(0, 700);
    return `${index + 1}. [${time}] ${text}`;
  }).join("\n");
}

async function buildReflectionPrompt(params: {
  voiceRows: StreamRow[];
  streamRows: StreamRow[];
  frictionRows: any[];
  manual: boolean;
}): Promise<string[]> {
  const voiceBlock = params.voiceRows.length
    ? compactRows(params.voiceRows, 10)
    : "Brak glosowek w ostatnich 24h.";

  const streamBlock = params.streamRows.length
    ? compactRows(params.streamRows, 14)
    : "Brak zapisow streamu w ostatnich 24h.";

  const frictionBlock = params.frictionRows.length
    ? params.frictionRows.slice(0, 8).map((event: any, index: number) => {
      const type = event.friction_type || event.event_kind || "event";
      const behavior = String(event.actual_behavior || event.declared_intention || event.immediate_cost || "").replace(/\s+/g, " ").trim();
      return `${index + 1}. ${type}: ${behavior.slice(0, 220)}`;
    }).join("\n")
    : "Brak sklasyfikowanych friction events.";

  try {
    const { content } = await deepseekChat({
      apiKey: DEEPSEEK_API_KEY,
      model: "deepseek-v4-flash",
      temperature: 0.35,
      maxTokens: 2500,
      messages: [
        {
          role: "system",
          content:
            "Jestes wieczornym trenerem refleksji w Vanguard. Nie planujesz jutra w Telegramu. " +
            "Masz pomoc uzytkownikowi usiasc spokojnie, nagrac glosowke i przeanalizowac dzien: " +
            "co poszlo dobrze, co poszlo zle, co moglo pojsc lepiej, za co jest wdzieczny, jakie napiecie albo temat warto poglebic. " +
            "Pisz po polsku, krotko, konkretnie, bez coachingu motywacyjnego. Nie udawaj pewnosci, jesli dane sa slabe."
        },
        {
          role: "user",
          content:
            `Tryb: ${params.manual ? "manualny /koniec" : "cron 21:30"}\n\n` +
            `GLOSOWKI 24H:\n${voiceBlock}\n\n` +
            `STREAM 24H:\n${streamBlock}\n\n` +
            `FRICTION 24H:\n${frictionBlock}\n\n` +
            "Napisz dwie osobne wiadomosci oddzielone ciagiem znakow '===DELIMITER==='.\n" +
            "Wiadomosc 1 (Podsumowanie):\n" +
            "- 3-5 punktow: co slychac w ostatnich 24h z glosowek/streamu.\n\n" +
            "===DELIMITER===\n\n" +
            "Wiadomosc 2 (Pytania i Instrukcja):\n" +
            "- 2-4 pytania poglebiajace, bardzo konkretne.\n" +
            "- Instrukcja: nagraj spokojna glosowke refleksyjna.\n\n" +
            "Nie pytaj o plan jutra. Nie generuj zadan na jutro."
        }
      ]
    });

    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (cleaned) {
      const parts = cleaned.split("===DELIMITER===").map(p => p.trim()).filter(Boolean);
      return parts.length > 0 ? parts : [cleaned];
    }
  } catch (err) {
    console.warn("[reconciliation] reflection prompt LLM failed:", err);
  }

  return [
    `*Wieczorna refleksja*\n\nW ostatnich 24h widze ${params.voiceRows.length} glosowek i ${params.streamRows.length} wpisow w streamie.`,
    `Usiadz spokojnie i nagraj glosowke:\n1. Co dzisiaj realnie poszlo dobrze?\n2. Co poszlo zle albo bylo tarciem?\n3. Co moglo pojsc lepiej i dlaczego?\n4. Za co dzisiaj jestes wdzieczny?\n5. Jaki jeden temat warto jeszcze nazwac bez uciekania w planowanie?`
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });

  try {
    if (!TELEGRAM_CHAT_ID) {
      console.warn("[reconciliation] TELEGRAM_CHAT_ID not set, skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "missing_chat_id" }), { status: 200 });
    }

    const url = new URL(req.url);
    const forceOverride = url.searchParams.get("force") === "true";
    const manual = url.searchParams.get("manual") === "true";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });

    if (!forceOverride) {
      const { data: existing } = await supabase
        .from("daily_reconciliations")
        .select("id, status, mode, created_at")
        .eq("user_id", VANGUARD_USER_ID)
        .eq("date", todayStr)
        .in("mode", ["reflection", "full", "checkin"])
        .in("status", ["sent", "answered"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log("[reconciliation] reflection already used today - skipping");
        return new Response(JSON.stringify({ skipped: true, reason: "already_used_today", id: existing.id }), { status: 200 });
      }
    }

    const { start: dayStart, end: dayEnd } = getWarsawDayBoundaries(todayStr);

    const [streamRes, frictionRes] = await Promise.all([
      supabase
        .from("vanguard_stream")
        .select("id, content, created_at, metadata")
        .eq("user_id", VANGUARD_USER_ID)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
        .order("created_at", { ascending: true })
        .limit(80),
      supabase
        .from("friction_events")
        .select("id, event_kind, friction_type, actual_behavior, declared_intention, immediate_cost, occurred_at")
        .eq("user_id", VANGUARD_USER_ID)
        .gte("occurred_at", dayStart)
        .lt("occurred_at", dayEnd)
        .order("occurred_at", { ascending: true })
        .limit(30),
    ]);

    if (streamRes.error) throw streamRes.error;
    if (frictionRes.error) console.error("[reconciliation] friction query error:", frictionRes.error);

    const streamRows = (streamRes.data || []) as StreamRow[];
    const voiceRows = streamRows.filter((row) => {
      const metadata = row.metadata || {};
      return typeof metadata.voice_duration_seconds === "number" || typeof metadata.voice_wpm === "number";
    });
    const frictionRows = frictionRes.data || [];

    let messageTexts = await buildReflectionPrompt({
      voiceRows,
      streamRows,
      frictionRows,
      manual,
    });

    // Pattern Bridge: append top visible patterns to evening reflection
    try {
      const patterns = await getRecentStrongBehavioralPatterns(supabase, VANGUARD_USER_ID, 2);
      const strong = patterns.filter(p => p.confidence >= 0.65 && p.occurrence_count >= 7);
      if (strong.length > 0) {
        const bridge = strong.map(p =>
          `📊 *${p.title || "Wzorzec"}* (N=${p.occurrence_count}, pewność ${Math.round(p.confidence * 100)}%)\n${p.evidence_text}`
        ).join("\n\n");
        messageTexts[0] += `\n\n---\n\n*W Twoich danych ten schemat się powtarza:*\n\n${bridge}`;
      }
    } catch (e) {
      console.warn("[reconciliation] pattern bridge fetch failed (non-fatal):", e);
    }

    let messageId: number | null = null;
    for (const text of messageTexts) {
      const mid = await sendTelegram(text);
      if (mid) messageId = mid;
    }

    const { data: row, error: upsertErr } = await supabase.from("daily_reconciliations").upsert({
      user_id: VANGUARD_USER_ID,
      date: todayStr,
      status: "sent",
      mode: "reflection",
      events_count: frictionRows.length,
      events_summary: frictionRows.map((event: any) => ({
        id: event.id,
        friction_type: event.friction_type,
        behavior: String(event.actual_behavior || event.declared_intention || "").slice(0, 160),
      })),
      telegram_message_id: messageId,
      parsed_response: {
        mode: "reflection",
        manual,
        voice_count_24h: voiceRows.length,
        stream_count_24h: streamRows.length,
        prompt_version: "reflection-24h-v1",
      },
      user_response: null,
      answered_at: null,
      planning_status: null,
      planning_history: null,
    }, { onConflict: "user_id,date" }).select("id").single();

    if (upsertErr) throw upsertErr;

    // Awaited — this is the canary audit event proving the reflection actually fired;
    // letting it run unawaited risked the Edge Runtime tearing down the isolate right
    // after the Response below before the insert flushed.
    await logAuditEvent({
      eventType: "evening_reflection_created",
      severity: "info",
      message: "Utworzono wieczorna sesje refleksji",
      metadata: {
        date: todayStr,
        manual,
        voice_count_24h: voiceRows.length,
        stream_count_24h: streamRows.length,
        friction_count: frictionRows.length,
      },
    });

    console.log(`[reconciliation] reflection sent id=${row?.id} manual=${manual} voices=${voiceRows.length}`);
    return new Response(JSON.stringify({
      ok: true,
      mode: "reflection",
      id: row?.id,
      manual,
      voice_count_24h: voiceRows.length,
      stream_count_24h: streamRows.length,
      events_count: frictionRows.length,
    }), { status: 200 });
  } catch (err) {
    await logCriticalError({
      area: "daily-reconciliation",
      error: err,
      message: "Daily reflection reconciliation failed",
    });
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
