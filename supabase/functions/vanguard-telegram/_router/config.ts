import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createServiceClient } from "../../_shared/supabase.ts";
import { getVanguardUserId } from "../../_shared/constants.ts";

export type TelegramRouterContext = {
  supabase: SupabaseClient;
  telegramToken: string;
  openAiKey: string;
  deepseekApiKey: string;
  vanguardUserId: string;
  authorizedChatId: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  inboxRecordId?: string;
};

export function createTelegramContext(): TelegramRouterContext {
  return {
    supabase: createServiceClient(),
    telegramToken: Deno.env.get("TELEGRAM_BOT_TOKEN") || "",
    openAiKey: Deno.env.get("OPENAI_API_KEY") || "",
    deepseekApiKey: Deno.env.get("DEEPSEEK_API_KEY") || "",
    vanguardUserId: getVanguardUserId(),
    authorizedChatId: parseInt(Deno.env.get("TELEGRAM_CHAT_ID") || "0"),
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    supabaseServiceRoleKey: Deno.env.get("SB_SECRET_KEY") ?? "",
  };
}
