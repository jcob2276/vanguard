/**
 * Evening reflection response handler.
 *
 * Telegram evening flow is no longer tomorrow planning. The scheduled prompt
 * asks for a reflective voice note, then this handler saves it, extracts useful
 * structure, and sends a concise analysis back.
 */

import { safeSendTelegram } from "../_utils/helpers.ts";
import { logCriticalError } from "../../_shared/errorLogging.ts";
import { parseReconciliationResponse, type P2ParsedResponse } from "../../_shared/reconciliationParser.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";

const TELEGRAM_FAST_LLM_MS = 14000;

export type ReconciliationHandlerOptions = {
  /** Single LLM call + pre-save — fits Telegram 30s webhook budget. */
  telegramFastPath?: boolean;
};

export async function handleReconciliation(
  reconciliationId: string,
  cleanText: string,
  streamRecordId: string | null,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
  _supabaseUrl: string,
  _supabaseKey: string,
  _userId: string,
  reconciliationDate: string,
  options?: ReconciliationHandlerOptions,
): Promise<void> {
  if (options?.telegramFastPath) {
    await handleReconciliationTelegramFast(
      reconciliationId,
      cleanText,
      streamRecordId,
      chatId,
      supabase,
      telegramToken,
      deepseekApiKey,
      reconciliationDate,
    );
    return;
  }

  await handleReconciliationFull(
    reconciliationId,
    cleanText,
    streamRecordId,
    chatId,
    supabase,
    telegramToken,
    deepseekApiKey,
    reconciliationDate,
  );
}

async function handleReconciliationTelegramFast(
  reconciliationId: string,
  cleanText: string,
  streamRecordId: string | null,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
  reconciliationDate: string,
): Promise<void> {
  const dayScore = extractDayScore(cleanText);

  // Pre-save so a webhook timeout/retry never loses the transcript.
  await supabase
    .from("daily_reconciliations")
    .update({
      user_response: cleanText,
      answered_at: new Date().toISOString(),
    })
    .eq("id", reconciliationId)
    .eq("status", "sent");

  let eveningExtraction: Record<string, unknown> | null = null;
  let p2Parsed: P2ParsedResponse | null = null;
  let reflectionText = "";

  try {
    const { content: raw } = await deepseekChat({
      apiKey: deepseekApiKey,
      model: "deepseek-v4-flash",
      temperature: 0.2,
      maxTokens: 900,
      timeoutMs: TELEGRAM_FAST_LLM_MS,
      responseFormat: { type: "json_object" },
      messages: [{
        role: "user",
        content:
          "Jestes parserem wieczornej refleksji Vanguard. Uzytkownik nagral glosowke.\n" +
          "Wyodrebnij strukture I napisz krotka analize. Odpowiedz TYLKO JSON:\n" +
          '{"evening_extraction":{"went_well":[],"went_wrong":[],"could_be_better":[],"gratitude":[],"tensions":[],"open_questions":[],"day_score":null},' +
          '"p2":{"day_score":null,"biggest_cost":null,"best_move":null,"correction":null,"resource":null,"blocker_candidates":[],"parse_confidence":0.5,"needs_manual_review":false,"unparsed_notes":null},' +
          '"reflection":"4 sekcje po polsku: 1) Fakty 2) Dobrze 3) Zle/lepiej 4) Jedno pytanie do app"}\n\n' +
          `DATA: ${reconciliationDate}\nODPOWIEDZ UZYTKOWNIKA:\n${cleanText.slice(0, 3500)}`,
      }],
    });

    const parsed = parseJsonFromContent(raw);
    if (parsed) {
      if (parsed.evening_extraction && typeof parsed.evening_extraction === "object") {
        eveningExtraction = parsed.evening_extraction as Record<string, unknown>;
      }
      const p2 = parsed.p2;
      if (p2 && typeof p2 === "object") {
        const p2Obj = p2 as Record<string, unknown>;
        p2Parsed = {
          day_score: typeof p2Obj.day_score === "number" ? p2Obj.day_score : null,
          biggest_cost: typeof p2Obj.biggest_cost === "string" ? p2Obj.biggest_cost : null,
          best_move: typeof p2Obj.best_move === "string" ? p2Obj.best_move : null,
          correction: typeof p2Obj.correction === "string" ? p2Obj.correction : null,
          resource: typeof p2Obj.resource === "string" ? p2Obj.resource : null,
          blocker_candidates: Array.isArray(p2Obj.blocker_candidates)
            ? p2Obj.blocker_candidates.slice(0, 5).map((b) => String(b).slice(0, 100))
            : [],
          parse_confidence: typeof p2Obj.parse_confidence === "number" ? p2Obj.parse_confidence : 0.5,
          needs_manual_review: !!p2Obj.needs_manual_review,
          unparsed_notes: typeof p2Obj.unparsed_notes === "string" ? p2Obj.unparsed_notes : null,
          parser_version: "telegram-fast-v1",
        };
      }
      if (typeof parsed.reflection === "string") {
        reflectionText = parsed.reflection.trim();
      }
    }
  } catch (extractErr) {
    console.warn("[reconciliation] telegram fast path LLM failed:", extractErr);
  }

  if (!p2Parsed) {
    p2Parsed = {
      day_score: null,
      biggest_cost: null,
      best_move: null,
      correction: null,
      resource: null,
      blocker_candidates: [],
      parse_confidence: 0,
      needs_manual_review: true,
      unparsed_notes: cleanText.slice(0, 400) || null,
      parser_version: "telegram-fast-fallback",
    };
  }

  const { error: updateError } = await supabase
    .from("daily_reconciliations")
    .update({
      status: "answered",
      user_response: cleanText,
      parsed_response: {
        raw_response: cleanText,
        stream_record_id: streamRecordId,
        parser_version: "telegram_reflection_v1",
        mode: "reflection",
      },
      day_score: dayScore,
      answered_at: new Date().toISOString(),
      planning_status: null,
      evening_extraction: eveningExtraction,
      evening_extraction_version: eveningExtraction ? "reflection-v1" : null,
      p2_parsed: p2Parsed,
      p2_parser_version: p2Parsed.parser_version,
    })
    .eq("id", reconciliationId);

  if (updateError) {
    console.error("[reconciliation] update failed:", updateError);
    await safeSendTelegram(chatId, "Nie udalo sie zapisac refleksji.", telegramToken);
    return;
  }

  await safeSendTelegram(
    chatId,
    reflectionText
      ? reflectionText.slice(0, 3500)
      : "Refleksja zapisana. Nie odpalam planowania w Telegramu; plan dnia dopracuj w aplikacji.",
    telegramToken,
    { disable_notification: false },
  );
}

async function handleReconciliationFull(
  reconciliationId: string,
  cleanText: string,
  streamRecordId: string | null,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
  reconciliationDate: string,
): Promise<void> {
  const dayScore = extractDayScore(cleanText);

  let eveningExtraction: Record<string, unknown> | null = null;
  let eveningExtractionVersion: string | null = null;

  const extractPromise = deepseekChat({
    apiKey: deepseekApiKey,
    model: "deepseek-v4-flash",
    temperature: 0.1,
    maxTokens: 500,
    messages: [{
      role: "user",
      content:
        "Wyodrebnij refleksje z odpowiedzi uzytkownika. Odpowiedz TYLKO poprawnym JSON bez markdown:\n" +
        '{"went_well":[],"went_wrong":[],"could_be_better":[],"gratitude":[],"tensions":[],"open_questions":[],"day_score":null}\n\n' +
        "ODPOWIEDZ UZYTKOWNIKA:\n" +
        cleanText.slice(0, 2500),
    }],
  }).then(({ content: rawExtract }) => {
    const extracted = parseJsonFromContent(rawExtract);
    if (extracted) {
      eveningExtraction = extracted;
      eveningExtractionVersion = "reflection-v1";
    }
  }).catch((extractErr) => {
    console.warn("[reconciliation] reflection extraction failed:", extractErr);
  });

  const p2Promise = parseReconciliationResponse(cleanText, deepseekApiKey).then((parsed) => {
    return parsed;
  }).catch((p2Err) => {
    console.warn("[reconciliation] p2 parser failed (non-fatal):", p2Err);
    return null;
  });

  const [, p2Parsed] = await Promise.all([extractPromise, p2Promise]);

  const { error: updateError } = await supabase
    .from("daily_reconciliations")
    .update({
      status: "answered",
      user_response: cleanText,
      parsed_response: {
        raw_response: cleanText,
        stream_record_id: streamRecordId,
        parser_version: "telegram_reflection_v1",
        mode: "reflection",
      },
      day_score: dayScore,
      answered_at: new Date().toISOString(),
      planning_status: null,
      evening_extraction: eveningExtraction,
      evening_extraction_version: eveningExtractionVersion,
      p2_parsed: p2Parsed,
      p2_parser_version: p2Parsed?.parser_version || null,
    })
    .eq("id", reconciliationId);

  if (updateError) {
    console.error("[reconciliation] update failed:", updateError);
    await safeSendTelegram(chatId, "Nie udalo sie zapisac refleksji.", telegramToken);
    return;
  }

  try {
    const { content: rawReflection } = await deepseekChat({
      apiKey: deepseekApiKey,
      model: "deepseek-v4-flash",
      temperature: 0.35,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content:
            "Jestes wieczornym trenerem refleksji w Vanguard. Nie planujesz jutra w Telegramu. " +
            "Masz zrobic mocna, rzeczowa analize dnia: co poszlo dobrze, co poszlo zle, co moglo pojsc lepiej, za co uzytkownik jest wdzieczny, jakie tarcie warto nazwac. " +
            "Nie generuj top3, first move, production_artifact ani planning_summary. Pisz po polsku, konkretnie, bez motywacyjnej waty.",
        },
        {
          role: "user",
          content:
            `DATA: ${reconciliationDate}\n\n` +
            `ODPOWIEDZ UZYTKOWNIKA:\n${cleanText.slice(0, 5000)}\n\n` +
            `EKSTRAKCJA:\n${JSON.stringify({ dayScore, eveningExtraction, p2Parsed }).slice(0, 4000)}\n\n` +
            "Odpowiedz w 4 sekcjach:\n" +
            "1. Fakty/refleksje, ktore uslyszales.\n" +
            "2. Co poszlo dobrze.\n" +
            "3. Co poszlo zle albo moglo pojsc lepiej.\n" +
            "4. Jedno pytanie do dalszego przemyslenia w aplikacji, nie w Telegramu.",
        },
      ],
    });

    const reflectionText = rawReflection.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    await safeSendTelegram(
      chatId,
      reflectionText
        ? reflectionText.slice(0, 3500)
        : "Refleksja zapisana. Nie odpalam planowania w Telegramu; plan dnia dopracuj w aplikacji.",
      telegramToken,
      { disable_notification: false },
    );
  } catch (reflectionErr) {
    await logCriticalError({
      area: "reconciliation-handler",
      error: reflectionErr,
      message: "Reflection response generation failed",
    });
    await safeSendTelegram(
      chatId,
      "Refleksja zapisana. Nie odpalam planowania w Telegramu; plan dnia dopracuj w aplikacji.",
      telegramToken,
      { disable_notification: false },
    );
  }
}

function extractDayScore(text: string): number | null {
  const normalized = text.toLowerCase();
  const explicit = normalized.match(/(?:ocena dnia|dzie[nń]\s+na|oceniam(?:\s+dzie[nń])?)\D*([1-5])(?:\s*\/\s*5)?/i);
  if (explicit?.[1]) return Number(explicit[1]);
  const numberedAnswer = normalized.match(/(?:^|\n|\s)4[).\:-]\s*(?:ocena|score|dzie[nń])?\s*([1-5])(?:\s*\/\s*5)?\s*$/im);
  if (numberedAnswer?.[1]) return Number(numberedAnswer[1]);
  return null;
}
