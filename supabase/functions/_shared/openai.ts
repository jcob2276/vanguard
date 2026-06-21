/**
 * Shared OpenAI helpers.
 */

export async function getEmbedding(text: string | string[], apiKey: string): Promise<number[] | number[][] | null> {
  if (!apiKey) {
    console.error("[OpenAI] Missing API key for embedding generation.");
    return null;
  }
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", { signal: AbortSignal.timeout(15000),
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: Array.isArray(text) ? text : text.replace(/\n/g, " ").slice(0, 8000),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[OpenAI] Embedding HTTP error (${res.status}): ${errText.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(text)) {
      return data.data?.map((d: any) => d.embedding) ?? null;
    }
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error("[OpenAI] Embedding exception caught:", err);
    return null;
  }
}
