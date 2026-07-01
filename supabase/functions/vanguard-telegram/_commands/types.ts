import type { TelegramRouterContext } from "../_router/config.ts";

export interface CommandHandler {
  command: string;
  handle(chatId: number, text: string, ctx: TelegramRouterContext): Promise<void>;
}
