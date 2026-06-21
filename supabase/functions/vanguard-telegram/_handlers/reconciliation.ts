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
import { deepseekChat } from "../../_shared/deepseek.ts";

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
): Promise<void> {
  const dayScore = extractDayScore(cleanText);

  // Run both extraction LLM calls first, then persist everything in ONE update below —
  // three separate UPDATEs to the same row (status+response, then extraction, then p2)
  // left a window where a mid-sequence failure produced a half-written row, and a Telegram
  // retry of the whole handler would re-stamp answered_at with a new timestamp.
  let eveningExtraction: any = null;
  let eveningExtractionVersion: string | null = null;
  try {
    const { content: rawExtract } = await deepseekChat({
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
    });

    const jsonMatch = rawExtract.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      eveningExtraction = JSON.parse(jsonMatch[0]);
      eveningExtractionVersion = "reflection-v1";
    }
  } catch (extractErr) {
    console.warn("[reconciliation] reflection extraction failed:", extractErr);
  }

  let p2Parsed: P2ParsedResponse | null = null;
  try {
    p2Parsed = await parseReconciliationResponse(cleanText, deepseekApiKey);
  } catch (p2Err) {
    console.warn("[reconciliation] p2 parser failed (non-fatal):", p2Err);
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
  // End-anchored so "4) 3" only matches when the digit is the END of that line/phrase —
  // "4. 3 rzeczy poszly dobrze" (an unrelated numbered list item) must NOT match. Keeps the
  // original start-of-line/whitespace prefix so "Pytanie 4: 5/5" / "Odpowiedz na 4: 5"
  // (a realistic phrasing, "4" not at line start) still matches — the end anchor alone
  // is what kills the false positive, an additional start-of-line requirement is not needed
  // and breaks that realistic case.
  const numberedAnswer = normalized.match(/(?:^|\n|\s)4[).\:-]\s*(?:ocena|score|dzie[nń])?\s*([1-5])(?:\s*\/\s*5)?\s*$/im);
  if (numberedAnswer?.[1]) return Number(numberedAnswer[1]);
  return null;
}
