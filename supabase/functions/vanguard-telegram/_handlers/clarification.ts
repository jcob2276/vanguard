import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import type { TelegramRouterContext } from "../_router/config.ts";

export async function handleClarificationReply(
  promptText: string,
  responseText: string,
  ctx: TelegramRouterContext,
  chatId: number,
): Promise<boolean> {
  const { supabase, telegramToken, deepseekApiKey, vanguardUserId } = ctx;

  // 1. Extract the actual question from promptText
  let questionText = promptText
    .replace(/🎙️\s*Pytanie\s*pogłębiające/gi, "")
    .replace(/Odpowiedz\s*głosem\s*lub\s*tekstem\.?/gi, "")
    .trim();

  try {
    // 2. Fetch pending clarification requests for this user
    const { data: pendingRequests, error: findErr } = await supabase
      .from("oracle_clarification_requests")
      .select("id, question, proposed_memory, response_type")
      .eq("user_id", vanguardUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (findErr) {
      console.error("[clarification] error finding pending requests:", findErr);
      await safeSendTelegram(chatId, `⚠️ Błąd bazy podczas wyszukiwania pytania: ${findErr.message}`, telegramToken);
      return true;
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      await safeSendTelegram(chatId, "⚠️ Brak oczekujących pytań pogłębiających (pending) w bazie danych.", telegramToken);
      return true;
    }

    // Try to match the best question
    const request = pendingRequests.find((r: any) => {
      const qClean = r.question.replace(/\s+/g, "").toLowerCase();
      const targetClean = questionText.replace(/\s+/g, "").toLowerCase();
      return qClean === targetClean || qClean.includes(targetClean) || targetClean.includes(qClean);
    }) || pendingRequests[0]; // Fallback to the latest pending if no exact match

    // 3. Classify user response using LLM (yes/no/uncertain)
    let classification: "yes" | "no" | "__uncertain__" = "__uncertain__";
    try {
      const classificationRes = await deepseekChat({
        apiKey: deepseekApiKey,
        ...LLM_TASKS.structured,
        maxTokens: 50,
        messages: [
          {
            role: "system",
            content: `Jesteś precyzyjnym klasyfikatorem odpowiedzi na pytania potwierdzające fakty do bazy wiedzy.
Zadane pytanie: "${request.question}"
Odpowiedź użytkownika: "${responseText}"

Zaklasyfikuj intencję użytkownika do jednej z trzech kategorii:
- "yes": użytkownik potwierdza (np. tak, zgadza się, dokładnie, owszem, jasne)
- "no": użytkownik zaprzecza (np. nie, nieprawda, bzdura, mylisz się)
- "uncertain": użytkownik jest niepewny, nie pamięta lub nie odpowiada wprost na pytanie (np. nie wiem, może, chyba, ciężko powiedzieć)

Zwróć TYLKO poprawny obiekt JSON: {"classification": "yes" | "no" | "uncertain"}`
          }
        ]
      });

      const parsed = parseJsonFromContent(classificationRes.content || "{}");
      if (parsed?.classification === "yes") {
        classification = "yes";
      } else if (parsed?.classification === "no") {
        classification = "no";
      }
    } catch (err) {
      console.error("[clarification] Deepseek classification failed, fallback to basic parsing:", err);
      // Fallback
      const rLower = responseText.toLowerCase().trim();
      if (/^(tak|zgadza|oczywiście|potwierdzam|yes|yep|jasne)/i.test(rLower)) {
        classification = "yes";
      } else if (/^(nie|zaprzeczam|no|nope)/i.test(rLower)) {
        classification = "no";
      }
    }

    // 4. Update the DB record (this will trigger handle_clarification_writeback in DB)
    const answerPayload = {
      option_ids: [classification],
      text: responseText,
      is_custom_answer: false,
      is_uncertain: classification === "__uncertain__",
    };

    // Update the database. This runs in a transaction with the trigger, so if trigger fails, this will throw!
    const { error: updateErr } = await supabase
      .from("oracle_clarification_requests")
      .update({
        status: "answered",
        answer: answerPayload,
        answered_at: new Date().toISOString()
      })
      .eq("id", request.id);

    if (updateErr) {
      throw updateErr;
    }

    // 5. Respond back with confirmation
    if (classification === "yes") {
      let memorySummary = request.proposed_memory;
      try {
        const parsedMem = JSON.parse(request.proposed_memory || "{}");
        if (parsedMem.source && parsedMem.relation && parsedMem.target) {
          memorySummary = `\`${parsedMem.source} ${parsedMem.relation} ${parsedMem.target}\``;
        }
      } catch {
        // use as-is
      }
      await safeSendTelegram(chatId, `✅ Potwierdzono. Zapisano w bazie wiedzy:\n${memorySummary}`, telegramToken);
    } else if (classification === "no") {
      await safeSendTelegram(chatId, `❌ Odrzucono hipotezę. Fakt nie został zapisany.`, telegramToken);
    } else {
      await safeSendTelegram(chatId, `🤔 Odpowiedź niejednoznaczna. Pomijam zapis pamięci.`, telegramToken);
    }

    return true;

  } catch (err: any) {
    console.error("[clarification] handleClarificationReply failed:", err);
    await safeSendTelegram(
      chatId,
      `⚠️ Błąd podczas zapisywania odpowiedzi do bazy wiedzy:\n${err.message || String(err)}`,
      telegramToken
    );
    return true; // We handled the error, so prevent it from falling through
  }
}
