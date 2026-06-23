import { deepseekChat } from './deepseek.ts';

interface HistoryMsg { role: string; content: string; }

const SOFT_RATIO = 0.80;
const HARD_RATIO = 0.95;
const KEEP_RECENT = 20;
const BUDGET_CHARS = 12_000;
const MAX_TOKENS = 131_072;
const CHARS_PER_TOKEN = 4;

function estimateTokens(msgs: HistoryMsg[]): number {
  return msgs.reduce((sum, m) => sum + Math.ceil(m.content.length / CHARS_PER_TOKEN), 0);
}

function preTrim(msgs: HistoryMsg[]): HistoryMsg[] {
  const seen = new Set<string>();
  return msgs
    .filter(m => {
      if (seen.has(m.content)) return false;
      seen.add(m.content);
      return true;
    })
    .map(m => ({
      ...m,
      content: m.content.length > 4000 ? m.content.substring(0, 4000) + '…[truncated]' : m.content,
    }));
}

export async function compressHistoryIfNeeded(history: HistoryMsg[]): Promise<HistoryMsg[]> {
  if (history.length === 0) return history;

  const trimmed = preTrim(history);
  const totalTokens = estimateTokens(trimmed);
  const ratio = totalTokens / MAX_TOKENS;

  if (ratio < SOFT_RATIO) return trimmed;

  const keepTail = trimmed.slice(-KEEP_RECENT);
  const toCompress = trimmed.slice(0, -KEEP_RECENT);
  if (toCompress.length === 0) return keepTail;

  const compressionPrompt = `Poniżej jest historia rozmowy agenta z użytkownikiem. Stwórz zwięzłe podsumowanie w max ${BUDGET_CHARS} znaków, zachowując: decyzje, fakty o użytkowniku, otwarte wątki, kontekst niezbędny do dalszej rozmowy. Pomiń small-talk i powtórzenia.

HISTORIA:
${toCompress.map(m => `[${m.role}]: ${m.content}`).join('\n\n')}

PODSUMOWANIE (max ${BUDGET_CHARS} znaków):`;

  try {
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
    const result = await deepseekChat({
      apiKey,
      messages: [{ role: 'user', content: compressionPrompt }],
      temperature: 0.2,
      maxTokens: Math.ceil(BUDGET_CHARS / CHARS_PER_TOKEN),
    });
    const summaryText = result.content ?? '';
    const compressed: HistoryMsg = {
      role: 'system',
      content: `[SKOMPRESOWANA HISTORIA]\n${summaryText.substring(0, BUDGET_CHARS)}`,
    };
    return [compressed, ...keepTail];
  } catch (e: any) {
    console.warn('[contextCompression] compression failed, returning trimmed:', e.message);
    return keepTail;
  }
}
