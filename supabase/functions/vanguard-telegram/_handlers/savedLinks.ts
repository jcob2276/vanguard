import { safeSendTelegram } from "../_utils/helpers.ts";
import { deepseekChat } from "../../_shared/deepseek.ts";

/**
 * Intercepts text containing a URL and handles Read-it-Later saved link creation.
 */
export async function handleSavedLink(
  chatId: number,
  text: string,
  telegramToken: string,
  deepseekApiKey: string,
  vanguardUserId: string,
  supabase: any
): Promise<boolean> {
  // Regex to detect HTTP/HTTPS URL
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return false;

  const url = urlMatch[0];
  console.log(`[savedLinks] Detected URL: ${url}`);

  // 1. Send processing indicator
  await safeSendTelegram(chatId, "📥 **Przetwarzam link i generuję podsumowanie...**", telegramToken);

  let pageTitle = "";
  let pageDescription = "";
  let domain = "";

  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname.replace("www.", "");
  } catch (_) {
    domain = "unknown";
  }

  // 2. Try fetching HTML metadata
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(id);

    if (res.ok) {
      const html = await res.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch?.[1]) {
        pageTitle = titleMatch[1].trim();
      }

      // Extract description
      const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                        html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+(?:name|property)=["'](?:og:)?description["']/i);
      if (descMatch?.[1]) {
        pageDescription = descMatch[1].trim();
      }

      // If title is missing, look for og:title
      if (!pageTitle) {
        const ogTitleMatch = html.match(/<meta[^>]+(?:name|property)=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i) ||
                             html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+(?:name|property)=["']og:title["']/i);
        if (ogTitleMatch?.[1]) {
          pageTitle = ogTitleMatch[1].trim();
        }
      }
    }
  } catch (err) {
    console.warn(`[savedLinks] Failed to fetch page metadata: ${err}`);
  }

  // Fallbacks if metadata parsing failed
  if (!pageTitle) {
    pageTitle = domain || url;
  }

  // Simple title cleaning
  const cleanTitle = pageTitle
    .replace(/\s*[|•-]\s*[^|•-]+$/, "") // Remove branding suffix (e.g., "| Onet")
    .trim() || pageTitle;

  // 4. Save to vanguard_links table directly (no AI analysis)
  try {
    const { error: insertErr } = await supabase.from('vanguard_links').insert({
      user_id: vanguardUserId,
      url: url,
      title: cleanTitle,
      description: pageDescription,
      takeaways: [],
      category: "Inne",
      domain: domain,
      status: "unread"
    });

    if (insertErr) throw insertErr;

    // 5. Send Telegram confirmation message
    const confirmText = `🔖 **Zapisano w skrzynce linków!**\n\n` +
      `**Tytuł:** ${cleanTitle}\n` +
      `**Domena:** 🌐 ${domain}\n\n` +
      `Link czeka na Ciebie w zakładce **Zapisane linki** w aplikacji.`;

    await safeSendTelegram(chatId, confirmText, telegramToken);
    return true;
  } catch (err) {
    console.error("[savedLinks] Failed to save link to DB:", err);
    await safeSendTelegram(chatId, `❌ Błąd zapisu linku w bazie: ${(err as Error).message}`, telegramToken);
    return true;
  }
}

/**
 * Handles link saving directly via HTTP request (without Telegram bot interaction).
 */
export async function handleSavedLinkDirect(
  url: string,
  vanguardUserId: string,
  ctx: { deepseekApiKey: string; supabase: any }
): Promise<any> {
  const { supabase } = ctx;
  console.log(`[savedLinks] Direct call for URL: ${url} user: ${vanguardUserId}`);

  let pageTitle = "";
  let pageDescription = "";
  let domain = "";

  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname.replace("www.", "");
  } catch (_) {
    domain = "unknown";
  }

  // Fetch HTML metadata
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(id);

    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch?.[1]) pageTitle = titleMatch[1].trim();

      const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                        html.match(/<meta[^>]+content=["']([\s\S]*?)["']/i);
      if (descMatch?.[1]) pageDescription = descMatch[1].trim();

      if (!pageTitle) {
        const ogTitleMatch = html.match(/<meta[^>]+(?:name|property)=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i) ||
                             html.match(/<meta[^>]+content=["']([\s\S]*?)["']/i);
        if (ogTitleMatch?.[1]) pageTitle = ogTitleMatch[1].trim();
      }
    }
  } catch (err) {
    console.warn(`[savedLinks] Failed to fetch page metadata: ${err}`);
  }

  if (!pageTitle) pageTitle = domain || url;

  const cleanTitle = pageTitle
    .replace(/\s*[|•-]\s*[^|•-]+$/, "")
    .trim() || pageTitle;

  // Insert into DB directly (no AI)
  const { data, error } = await supabase.from('vanguard_links').insert({
    user_id: vanguardUserId,
    url: url,
    title: cleanTitle,
    description: pageDescription,
    takeaways: [],
    category: "Inne",
    domain: domain,
    status: "unread"
  }).select('*').single();

  if (error) {
    throw error;
  }

  return data;
}
