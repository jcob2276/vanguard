import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";

export type SourceRef = {
  table: string;
  id: string;
  date?: string | null;
  quote?: string | null;
};

export type WikiPageDraft = {
  slug: string;
  title: string;
  page_type: string;
  status?: string;
  confidence?: number;
  summary?: string;
  content_md?: string;
  tags?: string[];
  source_refs?: SourceRef[];
  metadata?: Record<string, unknown>;
};

export type ReviewDraft = {
  page_slug?: string;
  item_type: string;
  title: string;
  detail: string;
  action?: string;
  severity?: string;
  source_refs?: SourceRef[];
  metadata?: Record<string, unknown>;
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function slugify(input: string): string {
  return (input || "untitled")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function trimText(text: string | null | undefined, max = 380): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function compactSources(rows: any[], table: string, fields: string[]) {
  return (rows || []).map((row: any) => {
    const bits = fields
      .map((field) => row[field] ? `${field}: ${trimText(row[field], 180)}` : "")
      .filter(Boolean)
      .join(" | ");
    return {
      table,
      id: String(row.id || row.stream_record_id || row.date || row.created_at),
      date: row.created_at || row.occurred_at || row.date || null,
      text: bits || trimText(JSON.stringify(row), 260),
    };
  });
}

export function sourceRefs(sources: any[], max = 8): SourceRef[] {
  return sources.slice(0, max).map((s) => ({
    table: s.table,
    id: s.id,
    date: s.date,
    quote: trimText(s.text, 260),
  }));
}

function countMatches(sources: any[], pattern: RegExp): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const source of sources) {
    const match = String(source.text || "").match(pattern);
    const key = match?.[1]?.trim();
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function countSummary(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ") || "brak wyraznego rozkladu";
}

function bucketSources(sourceBundle: any[]) {
  return {
    stream: sourceBundle.filter((s) => s.table === "vanguard_stream").slice(0, 14),
    friction: sourceBundle.filter((s) => s.table === "confirmed_friction_events" || s.table === "vanguard_behavioral_patterns").slice(0, 14),
    planning: sourceBundle.filter((s) => s.table === "daily_reconciliations").slice(0, 12),
    health: sourceBundle.filter((s) => s.table === "vanguard_daily_aggregates").slice(0, 12),
  };
}

function deterministicPage(slug: string, title: string, pageType: string, summary: string, refs: SourceRef[], implication: string, tag: string): WikiPageDraft {
  return {
    slug, title, page_type: pageType,
    status: refs.length >= 3 ? "active" : "needs_review",
    confidence: refs.length >= 6 ? 0.72 : refs.length >= 3 ? 0.62 : 0.45,
    summary,
    content_md: [
      "## Teza", summary, "",
      "## Dowody",
      ...refs.map((r) => `- ${r.table}:${r.id} (${r.date || "brak daty"}) - ${trimText(r.quote, 220)}`),
      "",
      "## Implikacja dla Oracle", implication, "",
      "## Nastepny test",
      "Przy kolejnej odpowiedzi Oracle ma porownac te strone ze swiezym streamem 72h i wskazac konflikt albo potwierdzenie.",
    ].join("\n"),
    tags: ["compiled-memory", "deterministic", tag],
    source_refs: refs,
    metadata: { compiler: "deterministic-domain-v1", domain: tag },
  };
}

export function buildDeterministicDomainPages(sourceBundle: any[]): WikiPageDraft[] {
  const buckets = bucketSources(sourceBundle);
  const pages: WikiPageDraft[] = [];

  const streamRefs = sourceRefs(buckets.stream, 8);
  if (streamRefs.length) {
    const categoryCounts = countMatches(buckets.stream, /category:\s*([^|]+)/i);
    pages.push(deterministicPage("current-stream-themes", "Aktualne tematy ze streamu", "source_summary",
      `Stream w ostatnim oknie koncentruje sie wokol: ${countSummary(categoryCounts)}. Najmocniejszy sygnal: ${trimText(streamRefs[0]?.quote, 180)}`,
      streamRefs, "Nie odpowiadaj ogolnie o 'ostatnio'. Najpierw sprawdz dominujaca kategorie streamu i cytowany wpis.", "stream"));
  }

  const frictionRefs = sourceRefs(buckets.friction, 8);
  if (frictionRefs.length) {
    const frictionCounts = countMatches(buckets.friction, /friction_type:\s*([^|]+)/i);
    pages.push(deterministicPage("current-friction-loops", "Aktualne friction loops", "friction_loop",
      `Najczesciej widoczne tarcia: ${countSummary(frictionCounts)}. Najmocniejszy sygnal: ${trimText(frictionRefs[0]?.quote, 180)}`,
      frictionRefs, "Traktuj to jako hipoteze operacyjna: szukaj powtorzenia w swiezym streamie, zanim nazwiesz to stalym wzorcem.", "friction"));
  }

  const planningRefs = sourceRefs(buckets.planning, 8);
  if (planningRefs.length) {
    const qualityCounts = countMatches(buckets.planning, /plan_quality:\s*([^|]+)/i);
    pages.push(deterministicPage("planning-execution-loop", "Petla planowania i wykonania", "decision",
      `Petla planowania ma rozklad jakosci: ${countSummary(qualityCounts)}. Najmocniejszy sygnal: ${trimText(planningRefs.find((r) => r.quote && !/events_summary:\s*$/i.test(r.quote))?.quote || planningRefs[0]?.quote, 180)}`,
      planningRefs, "W trybie planowania najpierw sprawdz jakosc poprzedniego planu i czy uzytkownik dal realny blocker.", "planning"));
  }

  const healthRefs = sourceRefs(buckets.health, 8);
  if (healthRefs.length) {
    const stateCounts = countMatches(buckets.health, /final_state:\s*([^|]+)/i);
    pages.push(deterministicPage("health-training-state", "Stan zdrowia i obciazenia", "health",
      `Ostatnie agregaty stanow dnia: ${countSummary(stateCounts)}. Najmocniejszy sygnal: ${trimText(healthRefs[0]?.quote, 180)}`,
      healthRefs, "Przy interpretacji produktywnosci najpierw sprawdz stan dnia i regeneracje.", "health"));
  }

  if (sourceBundle.length) {
    const allRefs = sourceRefs(sourceBundle, 10);
    pages.push(deterministicPage("operating-model-current-snapshot", "Aktualny snapshot operacyjny", "operating_model",
      `Aktualny model operacyjny sklada sie z ${buckets.stream.length} wpisow streamu, ${buckets.friction.length} sygnalow friction, ${buckets.planning.length} reconciliation i ${buckets.health.length} agregatow stanu.`,
      allRefs, "Oracle ma uzywac tej strony jako mapy nawigacyjnej: stream 72h -> friction -> planowanie -> stan/regeneracja.", "operating-model"));
  }

  return pages;
}

export async function compileDomainPage(params: {
  domain: string; slug: string; title: string; pageType: string; sources: any[]; existingPages: any[];
}): Promise<{ pages: WikiPageDraft[]; reviews: ReviewDraft[] }> {
  if (!params.sources.length) return { pages: [], reviews: [] };

  const system = `Jestes Vanguard Domain Wiki Compiler.
Masz zrobic JEDNA konkretna strone wiki dla domeny: ${params.domain}.
To jest compiled reasoning layer, nie source-of-truth.

Wymagania:
- Nie streszczaj listy zrodel jako "jest X zrodel". Wyciagnij konkretna teze.
- Teza ma wynikac z 3-6 wskazanych dowodow.
- Jesli dowody sa slabe, status=needs_review, ale nadal nazwij najlepsza hipoteze.
- W source_refs uzyj realnych table/id z SOURCES.
- content_md musi miec: ## Teza, ## Dowody, ## Implikacja dla Oracle, ## Nastepny test.
- Po polsku, ostro, bez motywacyjnych ozdob.

JSON:
{
  "page": {
    "slug": "${params.slug}",
    "title": "${params.title}",
    "page_type": "${params.pageType}",
    "status": "hypothesis|active|needs_review",
    "confidence": 0.0,
    "summary": "konkretna teza w 1-2 zdaniach",
    "content_md": "markdown",
    "tags": ["${params.domain}"],
    "source_refs": [{"table":"...","id":"...","date":"...","quote":"..."}],
    "metadata": {"compiler":"domain"}
  },
  "review_items": []
}`;

  const { content } = await deepseekChat({
    apiKey: Deno.env.get("DEEPSEEK_API_KEY") || "",
    model: "deepseek-v4-flash",
    temperature: 0.0,
    maxTokens: 1800,
    timeoutMs: 45000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: `EXISTING PAGES:\n${JSON.stringify(params.existingPages, null, 2)}\n\nSOURCES:\n${JSON.stringify(params.sources, null, 2)}` },
    ],
  });

  const parsed = parseJsonFromContent(content) || {};
  const page = (parsed as any).page || safeArray<WikiPageDraft>((parsed as any).pages)[0];
  const reviews = safeArray<ReviewDraft>((parsed as any).review_items || (parsed as any).reviews);
  return page ? { pages: [page as WikiPageDraft], reviews } : { pages: [], reviews };
}

export function uniqueReviewKey(userId: string, item: ReviewDraft) {
  return `${userId}:${slugify(item.page_slug || "global")}:${slugify(item.item_type)}:${slugify(item.title)}`;
}
