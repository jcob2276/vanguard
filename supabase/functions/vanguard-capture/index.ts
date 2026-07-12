/**
 * @function vanguard-capture
 * @trigger HTTP POST / Frontend / extension
 * @role Szybkie przechwytywanie notatek tekstowych i głosowych oraz zapisywanie do bazy jako stream/linki.
 * @reads vanguard_stream, vanguard_entity_links, entities, vanguard_relation_ontology, vanguard_links
 * @writes vanguard_stream, vanguard_raw_events, vanguard_entity_links, audit_events, vanguard_relation_ontology, vanguard_links
 * @calls deepseek-v4-flash, text-embedding-3-small
 * @consumer Inbox w aplikacji frontendowej (stream i linki)
 * @status active
 */
import { transcribeBlob } from "../_shared/openai.ts";
import { resolveUserScope } from "../_shared/supabase.ts";
import { serveJson } from "../_shared/http.ts";
import { fetchUrlMetadata, generateLinkAnalysis } from "../vanguard-telegram/_handlers/savedLinks.ts";
import { handleVaultIngest } from "./vaultIngest.ts";
import { insertStreamRecord } from "../_shared/repos/streamRepo.ts";

Deno.serve(serveJson(async (req, ctx) => {
    const db = ctx.supabase;
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";

    const contentType = req.headers.get("content-type") || "";
    let userId = "";
    let content = "";
    let source = "shortcut";
    let metadata: Record<string, any> = {};
    let isVaultLog = false;
    let category = "identity_vault";
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const { userId: scopeId } = await resolveUserScope(req, null);
      if (!scopeId) throw new Error("Unauthorized");
      userId = scopeId;

      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("Missing audio file in form data");
      
      const declaredSource = formData.get("source");
      if (declaredSource) source = String(declaredSource);

      const declaredMeta = formData.get("metadata");
      if (declaredMeta) {
        try { metadata = JSON.parse(String(declaredMeta)); } catch (_) {}
      }

      if (!openAiKey) throw new Error("OPENAI_API_KEY is not configured");
      content = await transcribeBlob(file, openAiKey, { filename: file.name || "audio.webm" });
      metadata.from_voice = true;
      source = "voice";

    } else {
      const body = await req.json().catch(() => ({}));
      const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
      userId = scopeId || body.userId;
      if (!userId) throw new Error("userId required");

      const action = body.action;
      source = String(body.source || "shortcut");
      
      isVaultLog = body.text !== undefined || action === "vault_log" || source === "identity_vault";
      if (isVaultLog) {
        text = String(body.text || "").trim();
        category = String(body.category || "identity_vault");
      } else {
        content = String(body.content || "").trim();
        metadata = body.metadata || {};
      }
    }

    if (isVaultLog) {
      if (!text) throw new Error("Text is empty");
      return await handleVaultIngest(db, userId, text, category, openAiKey, deepseekApiKey);
    }

    if (!content) throw new Error("Content is empty");

    // Check if the content is a URL link
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const url = urlMatch[0].replace(/(https?:\/\/.+?)(https?:\/\/.*)$/, "$1");
      console.log(`[capture] URL detected: ${url}`);

      const meta = await fetchUrlMetadata(url);
      const analysis = await generateLinkAnalysis(meta.title, meta.description, url, deepseekApiKey);

      const { data, error } = await db.from("vanguard_links").insert({
        user_id: userId,
        url,
        title: meta.title,
        description: meta.description,
        takeaways: analysis.takeaways,
        category: analysis.category,
        domain: meta.domain,
        status: "unread",
        ...(meta.thumbnailUrl && { thumbnail_url: meta.thumbnailUrl }),
        ...(meta.channelName && { channel_name: meta.channelName }),
      }).select("*").single();

      if (error) throw error;
      return { ok: true, type: "link", data };
    }

    const data = await insertStreamRecord(db, { user_id: userId, source, content, metadata });

    return { ok: true, type: "stream", data };
}, { auth: 'none' }));
