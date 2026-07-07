import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { fetchUrlMetadata, generateLinkAnalysis } from "../vanguard-telegram/_handlers/savedLinks.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const db = createServiceClient();
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";

    const contentType = req.headers.get("content-type") || "";
    let userId: string;
    let content = "";
    let source = "shortcut";
    let metadata: Record<string, any> = {};

    if (contentType.includes("multipart/form-data")) {
      // 1. Resolve user scope via Auth Header (Bearer)
      const { userId: scopeId } = await resolveUserScope(req, null);
      if (!scopeId) throw new Error("Unauthorized");
      userId = scopeId;

      // 2. Parse Form Data
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("Missing audio file in form data");
      
      const declaredSource = formData.get("source");
      if (declaredSource) source = String(declaredSource);

      const declaredMeta = formData.get("metadata");
      if (declaredMeta) {
        try {
          metadata = JSON.parse(String(declaredMeta));
        } catch (_) {
          // ignore invalid metadata JSON
        }
      }

      // 3. Transcribe using Whisper
      if (!openAiKey) throw new Error("OPENAI_API_KEY is not configured");
      const whisperForm = new FormData();
      whisperForm.append("file", file);
      whisperForm.append("model", "whisper-1");
      whisperForm.append("language", "pl");

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openAiKey}` },
        body: whisperForm,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text().catch(() => "unknown");
        throw new Error(`Whisper HTTP error (${whisperRes.status}): ${errText.substring(0, 200)}`);
      }
      const whisperData = await whisperRes.json();
      content = whisperData.text || "";
      metadata.from_voice = true;
      source = "voice";

    } else {
      // JSON payload
      const body = await req.json().catch(() => ({}));
      const { userId: scopeId } = await resolveUserScope(req, body.userId ?? null);
      userId = scopeId || body.userId;
      if (!userId) throw new Error("userId required");

      content = String(body.content || "").trim();
      source = String(body.source || "shortcut");
      metadata = body.metadata || {};
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
      return new Response(JSON.stringify({ ok: true, type: "link", data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: write to vanguard_stream
    const dateText = new Date().toISOString().substring(0, 10);
    const { data, error } = await db.from("vanguard_stream").insert({
      user_id: userId,
      source,
      content,
      metadata,
      date_text: dateText,
    }).select("*").single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, type: "stream", data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("[capture] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
