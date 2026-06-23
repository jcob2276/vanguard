/**
 * In-memory image buffer per sessionId.
 * Prevents base64 images from accumulating in history[].content.
 * Oracle stores image descriptions in history; raw bytes live here.
 *
 * Lifecycle: drain() is called before next LLM turn to inject as a user message.
 */

interface PendingImage {
  description: string;
  base64?: string;
  mimeType?: string;
  sessionId: string;
  createdAt: number;
}

// module-level singleton (lives for the lifetime of the isolate)
const buffer = new Map<string, PendingImage[]>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function pushImage(sessionId: string, image: Omit<PendingImage, 'sessionId' | 'createdAt'>): void {
  if (!buffer.has(sessionId)) buffer.set(sessionId, []);
  buffer.get(sessionId)!.push({ ...image, sessionId, createdAt: Date.now() });
}

export function drainImages(sessionId: string): PendingImage[] {
  const imgs = buffer.get(sessionId) ?? [];
  buffer.delete(sessionId);
  return imgs;
}

export function buildDrainedUserMessage(sessionId: string): string | null {
  const imgs = drainImages(sessionId);
  if (imgs.length === 0) return null;
  return imgs.map(img => `[Obraz: ${img.description}]`).join('\n');
}

// Cleanup stale entries to prevent memory leak across requests
export function gcBuffer(): void {
  const now = Date.now();
  for (const [sid, imgs] of buffer.entries()) {
    const fresh = imgs.filter(i => now - i.createdAt < TTL_MS);
    if (fresh.length === 0) buffer.delete(sid);
    else buffer.set(sid, fresh);
  }
}
