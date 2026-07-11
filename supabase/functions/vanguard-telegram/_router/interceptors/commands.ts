import { safeSendTelegram } from "../../_utils/helpers.ts";
import { handleSuplementCommand } from "../../_handlers/supplements.ts";
import {
  handleStartMenuCommand,
  handleKoniecCommand,
  handlePytanieCommand,
  handleDietaCommand,
  handleInteractivePromptCommand,
  handlePostCommand,
  handleLenieCommand,
  handleTodoCommand,
  handleKeepCommand,
  handlePosilekCommand,
} from "../commands.ts";
import { MessageContext, MessageInterceptor, looksLikeTodoCapture } from "../interceptors.ts";

// 6. Router for slash commands and menu items
export class CommandRouterInterceptor implements MessageInterceptor {
  name = "CommandRouterInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    let cleanText = ctx.text;
    let shouldRespond = true;
    let mode = "chat";

    if (ctx.text.startsWith("?")) {
      shouldRespond = true;
      mode = "chat";
      cleanText = ctx.text.substring(1).trim();
    } else if (ctx.text.startsWith("!!")) {
      shouldRespond = true;
      mode = "deep";
      cleanText = ctx.text.substring(2).trim();
    } else if (ctx.text.startsWith("##")) {
      shouldRespond = false;
      mode = "knowledge";
      cleanText = ctx.text.substring(2).trim();
    } else if (ctx.text.startsWith("@")) {
      shouldRespond = true;
      mode = "report";
      cleanText = ctx.text.substring(1).trim();
    } else if (ctx.text.toLowerCase().startsWith("poprawka:")) {
      shouldRespond = false;
      mode = "knowledge";
      cleanText = ctx.text;
    }

    ctx.mode = mode;
    ctx.shouldRespond = shouldRespond;
    ctx.cleanText = cleanText;

    const lowerText = ctx.text.toLowerCase().trim();

    if (lowerText === "/start" || lowerText === "/menu") {
      await handleStartMenuCommand(ctx.chatId, ctx.telegramToken);
      return true;
    }
    if (lowerText === "/koniec" || lowerText === "🔚 koniec") {
      await handleKoniecCommand(ctx.chatId, ctx.telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
      return true;
    }
    if (lowerText === "/pytanie" || lowerText === "💬 pytanie") {
      await handlePytanieCommand(ctx.chatId, ctx.telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
      return true;
    }
    if (lowerText === "/dieta" || lowerText === "🍽️ dieta" || lowerText === "dieta") {
      await handleDietaCommand(ctx.chatId, ctx.telegramToken, ctx.supabaseUrl, ctx.supabaseServiceRoleKey, ctx.vanguardUserId);
      return true;
    }
    if (await handleInteractivePromptCommand(lowerText, ctx.chatId, ctx.telegramToken)) {
      return true;
    }
    if (lowerText.startsWith("/post")) {
      await handlePostCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId);
      return true;
    }
    if (lowerText.startsWith("/posilek") || lowerText.startsWith("/posiłek")) {
      await handlePosilekCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId, ctx.deepseekApiKey, ctx.supabaseUrl, ctx.supabaseServiceRoleKey);
      return true;
    }
    if (lowerText.startsWith("/lenie")) {
      await handleLenieCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId);
      return true;
    }
    if (lowerText.startsWith("/todo")) {
      await handleTodoCommand(ctx.text, ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId, ctx.deepseekApiKey);
      return true;
    }
    if (lowerText === "/s" || lowerText === "/suplement" || lowerText === "💊 suple") {
      await handleSuplementCommand(ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId);
      return true;
    }
    if (lowerText.startsWith("/keep") || lowerText.startsWith("/notatka")) {
      const sliceLen = lowerText.startsWith("/keep") ? 5 : 8;
      await handleKeepCommand(ctx.text.slice(sliceLen).trim(), ctx.chatId, ctx.telegramToken, ctx.supabase, ctx.vanguardUserId, false);
      return true;
    }
    if (lowerText.startsWith("/librarian")) {
      await safeSendTelegram(ctx.chatId, "⏳ Uruchamiam Agenta Bibliotekarza...", ctx.telegramToken, { disable_notification: true });
      fetch(`${ctx.supabaseUrl}/functions/v1/vanguard-librarian`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${ctx.supabaseServiceRoleKey}` },
      }).catch((err) => console.error("[telegram] /librarian invoke failed:", err));
      return true;
    }

    return false;
  }
}

// 7. Todo autocapture
export class TodoAutoCaptureInterceptor implements MessageInterceptor {
  name = "TodoAutoCaptureInterceptor";
  async handle(ctx: MessageContext): Promise<boolean> {
    const hasCommandPrefix = /^(\?|!!|##|@|poprawka:)/i.test(ctx.text.trim());
    if (!hasCommandPrefix && looksLikeTodoCapture(ctx.text)) {
      await handleTodoCommand(
        ctx.text,
        ctx.chatId,
        ctx.telegramToken,
        ctx.supabase,
        ctx.vanguardUserId,
        ctx.deepseekApiKey,
      );
      return true;
    }
    return false;
  }
}
