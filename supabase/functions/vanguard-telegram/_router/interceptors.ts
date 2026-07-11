import { safeSendTelegram } from "../_utils/helpers.ts";
import { handleReconciliation } from "../_handlers/reconciliation.ts";
import type { TelegramRouterContext } from "./config.ts";

type VoiceLikeAttachment = { file_id: string; duration?: number };

export interface MessageContext extends TelegramRouterContext {
  message: {
    text?: string;
    voice?: VoiceLikeAttachment;
    audio?: VoiceLikeAttachment & { mime_type?: string };
    message_id: number;
    chat: { id: number };
    reply_to_message?: { text?: string };
    photo?: any[];
  };
  chatId: number;
  messageId: number;
  isVoice: boolean;
  voiceAttachment: VoiceLikeAttachment | null;

  // Mutable pipeline state passed between interceptors
  text: string;
  mode: string;
  cleanText: string;
  shouldRespond: boolean;
  streamRecordId: string | null;
  deferredVaultIngest: { text: string; category: string } | null;
  pendingReconciliation: {
    id: string;
    date: string;
    mode?: string;
    parsed_response?: { mode?: string; [key: string]: unknown };
  } | null;
  streamSaveFailed: boolean;
  handlerResponded: boolean;
  resolvedClaims?: { id: string; text: string }[];
}

export interface MessageInterceptor {
  name: string;
  handle(ctx: MessageContext): Promise<boolean>;
}

export function buildInitialContext(
  message: MessageContext["message"],
  routerCtx: TelegramRouterContext,
): MessageContext {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const voiceAttachment = getVoiceLikeAttachment(message);
  const isVoice = !!voiceAttachment;
  const text = message.text || "";

  return {
    ...routerCtx,
    message,
    chatId,
    messageId,
    isVoice,
    voiceAttachment,
    text,
    mode: "stream",
    cleanText: text,
    shouldRespond: false,
    streamRecordId: null,
    deferredVaultIngest: null,
    pendingReconciliation: null,
    streamSaveFailed: false,
    handlerResponded: false,
  };
}

function getVoiceLikeAttachment(message: MessageContext["message"]): VoiceLikeAttachment | null {
  if (message.voice?.file_id) return message.voice;
  if (!message.audio?.file_id) return null;

  const mime = (message.audio.mime_type || "").toLowerCase();
  if (
    !mime ||
    mime.includes("ogg") ||
    mime.includes("opus") ||
    mime.includes("mpeg") ||
    mime.includes("mp4") ||
    mime.includes("m4a")
  ) {
    return { file_id: message.audio.file_id, duration: message.audio.duration };
  }

  return null;
}

export async function tryResumeStuckReconciliationVoice(
  messageId: number,
  chatId: number,
  ctx: Pick<TelegramRouterContext, "supabase" | "telegramToken" | "deepseekApiKey" | "supabaseUrl" | "supabaseServiceRoleKey" | "vanguardUserId">,
): Promise<boolean> {
  const { supabase, telegramToken, deepseekApiKey, supabaseUrl, supabaseServiceRoleKey, vanguardUserId } = ctx;

  const { data: existing } = await supabase
    .from("vanguard_stream")
    .select("id, content, metadata")
    .eq("metadata->>telegram_message_id", messageId.toString())
    .maybeSingle();

  if (!existing?.content) return false;

  const reconId = (existing.metadata as { reconciliation_id?: string } | null)?.reconciliation_id;
  if (!reconId) return false;

  const { data: recon } = await supabase
    .from("daily_reconciliations")
    .select("id, date, status")
    .eq("id", reconId)
    .maybeSingle();

  if (recon?.status !== "sent") return false;

  await safeSendTelegram(
    chatId,
    "⏳ Wznawiam analizę refleksji...",
    telegramToken,
    { disable_notification: true },
  );

  await handleReconciliation(
    recon.id,
    String(existing.content),
    existing.id,
    chatId,
    supabase,
    telegramToken,
    deepseekApiKey,
    supabaseUrl,
    supabaseServiceRoleKey,
    vanguardUserId,
    recon.date,
  );
  return true;
}

export function looksLikeTodoCapture(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 180) return false;
  if (/https?:\/\//.test(t)) return false;
  if (/^(\?|!!|##|@|poprawka:)/i.test(t)) return false;
  if (/^\/\w/.test(t)) return false;
  if (/(^|\s)(p[1-4])(?=\s|$)/i.test(t)) return true;
  if (/(^|\s)(jutro|pojutrze|dzisiaj|dziś|dzis)(?=\s|$)/i.test(t)) return true;
  if (/^\+/.test(t) || /\s\+(jutro|tydz)/i.test(t)) return true;
  if (/!high|!low|pilne/i.test(t)) return true;
  return false;
}

// Re-exports of modular interceptors
export { PhotoInterceptor, TranscriptionInterceptor } from "./interceptors/media.ts";
export { ForceReplyInterceptor, IdempotencyInterceptor, SavedLinkInterceptor } from "./interceptors/control.ts";
export { CommandRouterInterceptor, TodoAutoCaptureInterceptor } from "./interceptors/commands.ts";
export { ReconciliationContextInterceptor, ReconciliationSaverInterceptor } from "./interceptors/reconciliation.ts";
export { StreamWriterInterceptor, KnowledgeSaverInterceptor } from "./interceptors/storage.ts";
export { OracleResponseInterceptor } from "./interceptors/oracle.ts";
