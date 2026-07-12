import { getEmbedding } from "../_shared/openai.ts";
import { deepseekChat } from "../_shared/deepseek.ts";

type Triad = {
  source: string;
  source_type?: string;
  relation: string;
  target: string;
  target_type?: string;
  memory_type?: string;
  confidence_score?: number;
  layer?: string;
};

export function chunkText(text: string, maxWords = 400, overlapWords = 50): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 10);
  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/);
    if (wordCount + words.length > maxWords && current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [current.join("\n\n").split(/\s+/).slice(-overlapWords).join(" ")];
      wordCount = overlapWords;
    }
    current.push(paragraph.trim());
    wordCount += words.length;
  }

  if (current.length > 0) chunks.push(current.join("\n\n"));
  return chunks.filter((chunk) => chunk.trim().length > 20);
}

export async function embed(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const embedding = await getEmbedding(text, apiKey);
    if (!embedding || !Array.isArray(embedding)) return null;
    if (Array.isArray(embedding[0])) return embedding[0] as number[];
    return embedding as number[];
  } catch (err) {
    console.error("[capture] embed exception:", err);
    return null;
  }
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function extractTriadsWithOntology(
  text: string,
  category: string,
  apiKey: string,
  allowedRelations: string[]
): Promise<Triad[]> {
  const prompt = `Jestes systemem ekstrakcji wiedzy Vanguard OS. Przeanalizuj tekst i wypisz relacje jako triady JSON.

Kategoria tekstu: ${category}

Typy encji: person, project, place, state, event, physical_state, belief, goal, value, habit, fear, relationship, memory.
Relacja MUSI byc jedna z tej ontologii:
${allowedRelations.join(", ")}

Tekst:
${text.slice(0, 4000)}

Odpowiedz TYLKO jako JSON array, max 20 triad:
[{"source":"Jakub","source_type":"person","relation":"relacja_po_polsku","target":"nazwa","target_type":"typ","memory_type":"fact","confidence_score":0.8,"layer":"intelligence"}]

Zasady:
- Uzywaj "Jakub" jako kanonicznej encji uzytkownika.
- Encje maja byc konkretne, nie ogolne.
- Tylko pewne relacje, nie spekuluj. Hipotezy oznacz memory_type="hypothesis".
- Nie mieszaj telemetrii z psychologia; telemetryczne liczby oznacz layer="telemetry".`;

  try {
    const result = await deepseekChat({
      apiKey,
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 1800,
    });
    const content = result.content;
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(allowedRelations);
    return parsed.filter((triad: Triad) =>
      triad?.source && triad?.relation && triad?.target && allowed.has(triad.relation)
    );
  } catch (error) {
    console.error("[capture] extractTriads exception:", error);
    return [];
  }
}
