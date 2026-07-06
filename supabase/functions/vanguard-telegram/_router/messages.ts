import { logCriticalError } from "../../_shared/errorLogging.ts";
import { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";
import type { TelegramRouterContext } from "./config.ts";
import {
  buildInitialContext,
  PhotoInterceptor,
  TranscriptionInterceptor,
  ForceReplyInterceptor,
  IdempotencyInterceptor,
  SavedLinkInterceptor,
  CommandRouterInterceptor,
  TodoAutoCaptureInterceptor,
  ReconciliationContextInterceptor,
  StreamWriterInterceptor,
  ReconciliationSaverInterceptor,
  KnowledgeSaverInterceptor,
  OracleResponseInterceptor,
} from "./interceptors.ts";

;

export async function handleIncomingMessage(
  message: {
    text?: string;
    voice?: { file_id: string; duration?: number };
    audio?: { file_id: string; duration?: number; mime_type?: string };
    message_id: number;
    chat: { id: number };
    reply_to_message?: { text?: string };
    photo?: any[];
  },
  routerCtx: TelegramRouterContext,
): Promise<void> {
  try {
    const ctx = buildInitialContext(message, routerCtx);

    const pipeline = [
      new PhotoInterceptor(),
      new TranscriptionInterceptor(),
      new ForceReplyInterceptor(),
      new IdempotencyInterceptor(),
      new SavedLinkInterceptor(),
      new CommandRouterInterceptor(),
      new TodoAutoCaptureInterceptor(),
      new ReconciliationContextInterceptor(),
      new StreamWriterInterceptor(),
      new ReconciliationSaverInterceptor(),
      new KnowledgeSaverInterceptor(),
      new OracleResponseInterceptor(),
    ];

    for (const interceptor of pipeline) {
      const intercepted = await interceptor.handle(ctx);
      if (intercepted) {
        // Output debug log to show which interceptor finished the flow
        console.log(`[telegram-messages] Intercepted by: ${interceptor.name}`);
        break;
      }
    }
  } catch (err) {
    await logCriticalError({
      area: "telegram-messages-root",
      error: err,
      message: "Unhandled error in handleIncomingMessage root pipeline",
    });
  }
}
