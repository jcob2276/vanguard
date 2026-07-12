import { safeSendTelegram } from "../_utils/helpers.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { getStreamByTelegramMessageId } from "../../_shared/repos/streamRepo.ts";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function isPrivateOrBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return true;
  if (host === "::1" || host === "[::1]") return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b, c] = [Number(v4[1]), Number(v4[2]), Number(v4[3])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 0) return true;
  return false;
}

/** Reject SSRF targets (private IPs, localhost, non-http schemes). */
function assertSafePublicUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (isPrivateOrBlockedHost(parsed.hostname)) {
    throw new Error("Blocked URL host");
  }
  return parsed;
}

async function fetchYouTubeOembed(url: string): Promise<{ title: string; thumbnailUrl: string; channelName: string }> {
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: AbortSignal.timeout(15000) });
    if (oembedRes.ok) {
      const oembed = await oembedRes.json();
      return { title: oembed.title || "", thumbnailUrl: oembed.thumbnail_url || "", channelName: oembed.author_name || "" };
    }
  } catch (err) {
    console.warn(`[savedLinks] YouTube oEmbed failed: ${err}`);
  }
  return { title: "", thumbnailUrl: "", channelName: "" };
}

// <title>/meta tags always live in the first few KB of <head> — read at most maxBytes
// instead of buffering a potentially multi-MB page into memory just to regex out a title.
async function fetchHtmlHead(url: string, maxBytes = 50_000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    if (!res.ok || !res.body) return "";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => {});
    return html;
  } catch (err) {
    console.warn(`[savedLinks] Failed to fetch page metadata: ${err}`);
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractMetaFromHtml(html: string): { title: string; description: string } {
  let title = "";
  let description = "";

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) title = titleMatch[1].trim();

  const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+(?:name|property)=["'](?:og:)?description["']/i);
  if (descMatch?.[1]) description = descMatch[1].trim();

  if (!title) {
    const ogTitleMatch = html.match(/<meta[^>]+(?:name|property)=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i) ||
                         html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+(?:name|property)=["']og:title["']/i);
    if (ogTitleMatch?.[1]) title = ogTitleMatch[1].trim();
  }

  return { title, description };
}

const POCKET_CATEGORIES = new Set(["Kariera", "Zdrowie", "Technologia", "Biznes", "Inne"]);

/** Shared LLM analysis used by both the Telegram path and the direct HTTP path. */
export async function generateLinkAnalysis(
  title: string,
  description: string,
  url: string,
  apiKey: string,
): Promise<{ takeaways: string[]; category: string }> {
  if (!apiKey) return { takeaways: [], category: "Inne" };
  try {
    const { content } = await deepseekChat({
      apiKey,
      model: 'deepseek-v4-flash',
      temperature: 0.2,
      maxTokens: 250,
      messages: [{
        role: 'user',
        content:
          `Dla artykułu "${title}" (${url}). Opis: ${description.slice(0, 500)}. ` +
          `Zwróć JSON: {"takeaways":["wniosek1","wniosek2","wniosek3"],"category":"Kariera|Zdrowie|Technologia|Biznes|Inne"} — ` +
          `dokładnie 3 krótkie wnioski po polsku i jedna kategoria.`,
      }],
      responseFormat: { type: 'json_object' },
      timeoutMs: 12000,
    });
    const parsed = parseJsonFromContent(content || '{}') ?? {};
    const takeaways = Array.isArray(parsed.takeaways)
      ? parsed.takeaways.map(String).filter(Boolean).slice(0, 3)
      : [];
    const rawCategory = String(parsed.category || "Inne");
    const category = POCKET_CATEGORIES.has(rawCategory) ? rawCategory : "Inne";
    return { takeaways, category };
  } catch (e) {
    console.warn('[savedLinks] link analysis failed:', e);
    return { takeaways: [], category: "Inne" };
  }
}

export async function fetchUrlMetadata(url: string): Promise<{
  title: string; description: string; domain: string; thumbnailUrl: string; channelName: string;
}> {
  assertSafePublicUrl(url);
  let domain = "unknown";
  try {
    domain = new URL(url).hostname.replace("www.", "");
  } catch (_) {
    // keep "unknown"
  }

  const isYouTube = domain === 'youtube.com' || domain === 'youtu.be';
  let title = "", description = "", thumbnailUrl = "", channelName = "";

  if (isYouTube) {
    const oembed = await fetchYouTubeOembed(url);
    title = oembed.title;
    thumbnailUrl = oembed.thumbnailUrl;
    channelName = oembed.channelName;
  }

  if (!isYouTube || !title) {
    const html = await fetchHtmlHead(url);
    if (html) {
      const meta = extractMetaFromHtml(html);
      if (!title) title = meta.title;
      description = meta.description;
    }
  }

  if (!title) title = domain || url;
  const cleanTitle = title.replace(/\s*[|•-]\s*[^|•-]+$/, "").trim() || title;

  return { title: cleanTitle, description, domain, thumbnailUrl, channelName };
}

/**
 * Intercepts text containing a URL and handles Read-it-Later saved link creation.
 */
export async function handleSavedLink(
  chatId: number,
  text: string,
  telegramToken: string,
  deepseekApiKey: string,
  vanguardUserId: string,
  supabase: any,
  messageId?: number
): Promise<boolean> {
  // Regex to detect HTTP/HTTPS URL
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return false;

  // Sanitize: handle double-URL concatenation (copy-paste artifact from some clients)
  const url = urlMatch[0].replace(/(https?:\/\/.+?)(https?:\/\/.*)$/, '$1');
  try {
    assertSafePublicUrl(url);
  } catch (err) {
    await safeSendTelegram(chatId, `❌ Nieprawidłowy lub zablokowany link: ${(err as Error).message}`, telegramToken);
    return true;
  }
  console.log(`[savedLinks] Detected URL: ${url}`);

  // Idempotency anchor — write to vanguard_stream NOW so Telegram retries are blocked
  // by the existing idempotency guard in messages.ts (which checks telegram_message_id).
  if (messageId) {
    const existing = await getStreamByTelegramMessageId(supabase, messageId);
    if (existing) {
      console.log(`[savedLinks] Idempotency: message ${messageId} already processed — skipping retry`);
      return true;
    }
    // A silently-failed anchor write defeats the whole point of this block — a Telegram
    // retry of this same message would find no `existing` row and re-process the link.
    const { error: anchorErr } = await supabase.from('vanguard_stream').insert({
      user_id: vanguardUserId,
      source: 'telegram',
      content: url,
      metadata: { telegram_chat_id: chatId, telegram_message_id: messageId.toString(), mode: 'url_saved' }
    });
    if (anchorErr) console.error('[savedLinks] idempotency anchor insert failed:', anchorErr);
  }

  // 1. Send processing indicator
  await safeSendTelegram(chatId, "📥 **Przetwarzam link i generuję podsumowanie...**", telegramToken);

  const { title: cleanTitle, description: pageDescription, domain, thumbnailUrl, channelName } = await fetchUrlMetadata(url);
  const { takeaways, category } = await generateLinkAnalysis(cleanTitle, pageDescription, url, deepseekApiKey);

  // 4. Save to vanguard_links table
  try {
    const { error: insertErr } = await supabase.from('vanguard_links').insert({
      user_id: vanguardUserId,
      url: url,
      title: cleanTitle,
      description: pageDescription,
      takeaways,
      category,
      domain: domain,
      status: "unread",
      ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
      ...(channelName && { channel_name: channelName }),
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

  const { title: cleanTitle, description: pageDescription, domain, thumbnailUrl, channelName } = await fetchUrlMetadata(url);
  const { takeaways, category } = await generateLinkAnalysis(cleanTitle, pageDescription, url, ctx.deepseekApiKey);

  const { data, error } = await supabase.from('vanguard_links').insert({
    user_id: vanguardUserId,
    url: url,
    title: cleanTitle,
    description: pageDescription,
    takeaways,
    category,
    domain: domain,
    status: "unread",
    ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
    ...(channelName && { channel_name: channelName }),
  }).select('*').single();

  if (error) {
    throw error;
  }

  return data;
}
