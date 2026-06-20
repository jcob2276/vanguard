import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, corsHeaders, resolveUserScope } from "../_shared/supabase.ts";
import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";
import { getWarsawDateString } from "../_shared/time.ts";

type SourceRef = {
  table: string;
  id: string;
  date?: string | null;
  quote?: string | null;
};

type WikiPageDraft = {
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

type ReviewDraft = {
  page_slug?: string;
  item_type: string;
  title: string;
  detail: string;
  action?: string;
  severity?: string;
  source_refs?: SourceRef[];
  metadata?: Record<string, unknown>;
};

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function slugify(input: string): string {
  return (input || "untitled")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function trimText(text: string | null | undefined, max = 380): string {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function compactSources(rows: any[], table: string, fields: string[]) {
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

function uniqueReviewKey(userId: string, item: ReviewDraft) {
  return `${userId}:${slugify(item.page_slug || "global")}:${slugify(item.item_type)}:${slugify(item.title)}`;
}

function bucketSources(sourceBundle: any[]) {
  return {
    stream: sourceBundle.filter((s) => s.table === "vanguard_stream").slice(0, 14),
    friction: sourceBundle.filter((s) => s.table === "confirmed_friction_events" || s.table === "vanguard_behavioral_patterns").slice(0, 14),
    planning: sourceBundle.filter((s) => s.table === "daily_reconciliations").slice(0, 12),
    health: sourceBundle.filter((s) => s.table === "vanguard_daily_aggregates").slice(0, 12),
  };
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

function sourceRefs(sources: any[], max = 8): SourceRef[] {
  return sources.slice(0, max).map((s) => ({
    table: s.table,
    id: s.id,
    date: s.date,
    quote: trimText(s.text, 260),
  }));
}

function deterministicPage(
  slug: string,
  title: string,
  pageType: string,
  summary: string,
  refs: SourceRef[],
  implication: string,
  tag: string,
): WikiPageDraft {
  return {
    slug,
    title,
    page_type: pageType,
    status: refs.length >= 3 ? "active" : "needs_review",
    confidence: refs.length >= 6 ? 0.72 : refs.length >= 3 ? 0.62 : 0.45,
    summary,
    content_md: [
      "## Teza",
      summary,
      "",
      "## Dowody",
      ...refs.map((r) => `- ${r.table}:${r.id} (${r.date || "brak daty"}) - ${trimText(r.quote, 220)}`),
      "",
      "## Implikacja dla Oracle",
      implication,
      "",
      "## Nastepny test",
      "Przy kolejnej odpowiedzi Oracle ma porownac te strone ze swiezym streamem 72h i wskazac konflikt albo potwierdzenie.",
    ].join("\n"),
    tags: ["compiled-memory", "deterministic", tag],
    source_refs: refs,
    metadata: { compiler: "deterministic-domain-v1", domain: tag },
  };
}

function buildDeterministicDomainPages(sourceBundle: any[]): WikiPageDraft[] {
  const buckets = bucketSources(sourceBundle);
  const pages: WikiPageDraft[] = [];

  const streamRefs = sourceRefs(buckets.stream, 8);
  if (streamRefs.length) {
    const categoryCounts = countMatches(buckets.stream, /category:\s*([^|]+)/i);
    pages.push(deterministicPage(
      "current-stream-themes",
      "Aktualne tematy ze streamu",
      "source_summary",
      `Stream w ostatnim oknie koncentruje sie wokol: ${countSummary(categoryCounts)}. Najmocniejszy sygnal: ${trimText(streamRefs[0]?.quote, 180)}`,
      streamRefs,
      "Nie odpowiadaj ogolnie o 'ostatnio'. Najpierw sprawdz dominujaca kategorie streamu i cytowany wpis.",
      "stream",
    ));
  }

  const frictionRefs = sourceRefs(buckets.friction, 8);
  if (frictionRefs.length) {
    const frictionCounts = countMatches(buckets.friction, /friction_type:\s*([^|]+)/i);
    pages.push(deterministicPage(
      "current-friction-loops",
      "Aktualne friction loops",
      "friction_loop",
      `Najczesciej widoczne tarcia: ${countSummary(frictionCounts)}. Najmocniejszy sygnal: ${trimText(frictionRefs[0]?.quote, 180)}`,
      frictionRefs,
      "Traktuj to jako hipoteze operacyjna: szukaj powtorzenia w swiezym streamie, zanim nazwiesz to stalym wzorcem.",
      "friction",
    ));
  }

  const planningRefs = sourceRefs(buckets.planning, 8);
  if (planningRefs.length) {
    const qualityCounts = countMatches(buckets.planning, /plan_quality:\s*([^|]+)/i);
    pages.push(deterministicPage(
      "planning-execution-loop",
      "Petla planowania i wykonania",
      "decision",
      `Petla planowania ma rozklad jakosci: ${countSummary(qualityCounts)}. Najmocniejszy sygnal: ${trimText(planningRefs.find((r) => r.quote && !/events_summary:\s*$/i.test(r.quote))?.quote || planningRefs[0]?.quote, 180)}`,
      planningRefs,
      "W trybie planowania najpierw sprawdz jakosc poprzedniego planu i czy uzytkownik dal realny blocker, nie buduj nowego planu na pustym template.",
      "planning",
    ));
  }

  const healthRefs = sourceRefs(buckets.health, 8);
  if (healthRefs.length) {
    const stateCounts = countMatches(buckets.health, /final_state:\s*([^|]+)/i);
    pages.push(deterministicPage(
      "health-training-state",
      "Stan zdrowia i obciazenia",
      "health",
      `Ostatnie agregaty stanow dnia: ${countSummary(stateCounts)}. Najmocniejszy sygnal: ${trimText(healthRefs[0]?.quote, 180)}`,
      healthRefs,
      "Przy interpretacji produktywnosci najpierw sprawdz stan dnia i regeneracje; nie traktuj behavioral drift jako czysto mentalnego problemu.",
      "health",
    ));
  }

  if (sourceBundle.length) {
    const allRefs = sourceRefs(sourceBundle, 10);
    pages.push(deterministicPage(
      "operating-model-current-snapshot",
      "Aktualny snapshot operacyjny",
      "operating_model",
      `Aktualny model operacyjny sklada sie z ${buckets.stream.length} wpisow streamu, ${buckets.friction.length} sygnalow friction, ${buckets.planning.length} reconciliation i ${buckets.health.length} agregatow stanu.`,
      allRefs,
      "Oracle ma uzywac tej strony jako mapy nawigacyjnej: stream 72h -> friction -> planowanie -> stan/regeneracja.",
      "operating-model",
    ));
  }

  return pages;
}

async function compileDomainPage(params: {
  domain: string;
  slug: string;
  title: string;
  pageType: string;
  sources: any[];
  existingPages: any[];
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

async function compileForUser(supabase: any, userId: string, opts: { mode: string; days: number; limit: number; dryRun: boolean }) {
  const now = new Date();
  const today = getWarsawDateString(now);
  const cutStream = new Date(now.getTime() - opts.days * 864e5).toISOString();
  const cutFriction = new Date(now.getTime() - Math.max(opts.days, 30) * 864e5).toISOString();
  const cut14Date = getWarsawDateString(new Date(now.getTime() - 13 * 864e5));

  const [streamRes, frictionRes, recRes, aggregateRes, existingRes, patternsRes] = await Promise.all([
    supabase.from("vanguard_stream")
      .select("id, created_at, category, source, content")
      .eq("user_id", userId)
      .gte("created_at", cutStream)
      .order("created_at", { ascending: false })
      .limit(opts.limit),
    supabase.from("confirmed_friction_events")
      .select("*")
      .eq("user_id", userId)
      .gte("occurred_at", cutFriction)
      .order("occurred_at", { ascending: false })
      .limit(60),
    supabase.from("daily_reconciliations")
      .select("id, date, created_at, events_summary, user_response, planning_summary, p2_parsed, day_score, plan_quality, plan_failure_reason")
      .eq("user_id", userId)
      .gte("date", cut14Date)
      .order("date", { ascending: false })
      .limit(14),
    supabase.from("vanguard_daily_aggregates")
      .select("id, date, final_state, execution_score, sleep_hours, hrv_avg, readiness_score, dopamine_load_index")
      .eq("user_id", userId)
      .gte("date", cut14Date)
      .order("date", { ascending: false })
      .limit(14),
    supabase.from("vanguard_wiki_pages")
      .select("slug, title, page_type, status, confidence, summary, updated_at")
      .eq("user_id", userId)
      .not("status", "eq", "archived")
      .order("last_compiled_at", { ascending: false })
      .limit(40),
    supabase.from("vanguard_behavioral_patterns")
      .select("id, pattern_type, title, evidence_text, occurrence_count, confidence, status, last_seen")
      .eq("user_id", userId)
      .in("status", ["visible", "user_confirmed", "pending"])
      .order("last_seen", { ascending: false })
      .limit(25),
  ]);

  for (const [name, res] of Object.entries({ streamRes, frictionRes, recRes, aggregateRes, existingRes, patternsRes })) {
    if ((res as any).error) console.warn(`[wiki-compiler] source query failed, continuing without it: ${name}: ${(res as any).error.message}`);
  }

  const sourceBundle = [
    ...compactSources(streamRes.data || [], "vanguard_stream", ["category", "content"]),
    ...compactSources(frictionRes.data || [], "confirmed_friction_events", ["friction_type", "raw_text", "actual_behavior", "declared_intention"]),
    ...compactSources(recRes.data || [], "daily_reconciliations", ["events_summary", "user_response", "plan_quality", "plan_failure_reason"]),
    ...compactSources(aggregateRes.data || [], "vanguard_daily_aggregates", ["final_state"]),
    ...compactSources(patternsRes.data || [], "vanguard_behavioral_patterns", ["pattern_type", "title", "evidence_text"]),
  ];

  const system = `Jestes Vanguard Wiki Compiler.
Budujesz derived/compiled memory, nie source-of-truth. Surowe dowody sa nienaruszalne.

Zadanie:
- aktualizuj zywa wiki o Jakubie: wzorce zachowania, projekty, trening/zdrowie, decyzje, osoby, friction loops, operating model.
- nie tworz "ostatecznych prawd" bez mocnych dowodow. Slabsze wnioski maja status hypothesis lub needs_review.
- kazda strona musi miec source_refs z konkretnych id z listy SOURCES.
- gdy widzisz sprzecznosc, malo dowodow, stary claim albo potrzebna decyzje usera, dodaj review_items.
- jesli jakakolwiek istniejąca strona wiki jest juz nieaktualna, nieaktywna, projekt zostal zakonczony, badz nowa informacja ja uniewaznia, deaktualizuje lub zastepuje (np. zakonczenie starego projektu, zmiana pracy, zmiana adresu), dodaj jej slug do "archived_pages", aby system ja zarchiwizowal.
- pisz po polsku, konkretnie, bez coachingu motywacyjnego.

JSON schema:
{
  "pages": [{
    "slug": "kebab-case",
    "title": "...",
    "page_type": "identity|behavior_pattern|person|project|training|health|decision|friction_loop|concept|source_summary|operating_model",
    "status": "hypothesis|active|needs_review|user_confirmed",
    "confidence": 0.0,
    "summary": "1-2 zdania",
    "content_md": "markdown z sekcjami: Teza, Dowody, Implikacje, Nastepny test",
    "tags": ["..."],
    "source_refs": [{"table":"...","id":"...","date":"...","quote":"krotki cytat/parafraza"}],
    "metadata": {"why_updated":"..."}
  }],
  "archived_pages": ["slug-to-archive"],
  "review_items": [{
    "page_slug": "...",
    "item_type": "contradiction|stale_claim|weak_evidence|missing_source|merge_candidate|confirmation_needed|deep_research",
    "title": "...",
    "detail": "...",
    "action": "co user/system ma sprawdzic",
    "severity": "low|medium|high",
    "source_refs": [{"table":"...","id":"..."}],
    "metadata": {}
  }]
}
Limit: 3-8 pages, max 8 review_items. Nie zwracaj pustych pages, jesli SOURCES nie sa puste.`;

  const user = `DATA: ${today}
MODE: ${opts.mode}

EXISTING WIKI PAGES:
${JSON.stringify(existingRes.data || [], null, 2)}

SOURCES:
${JSON.stringify(sourceBundle, null, 2)}

Priorytet:
1. Utrwal najwazniejsze wzorce, ktore poprawiaja decyzje Oracle.
2. Laczyc stream + friction + reconciliation + biometrie, ale tylko z cytowalnym evidence.
3. Oznaczac rzeczy niepewne jako hypothesis/needs_review.`;

  const chatResult = await deepseekChat({
    apiKey: Deno.env.get("DEEPSEEK_API_KEY") || "",
    model: "deepseek-v4-flash",
    temperature: 0.1,
    maxTokens: 8000,
    timeoutMs: 75000,
    responseFormat: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = chatResult.content;

  console.log("[wiki-compiler] LLM Raw Response:", content);
  const parsed = parseJsonFromContent(content) || {};
  console.log("[wiki-compiler] LLM Parsed:", JSON.stringify(parsed, null, 2));
  let pages = safeArray<WikiPageDraft>((parsed as any).pages || (parsed as any).wiki_pages);
  let reviews = safeArray<ReviewDraft>((parsed as any).review_items || (parsed as any).reviews);
  const archivedPages = safeArray<string>((parsed as any).archived_pages || (parsed as any).archived || []);
  const deterministicPages = buildDeterministicDomainPages(sourceBundle);

  if (opts.mode.includes("domain") && deterministicPages.length > 0) {
    pages = deterministicPages;
    reviews.push({
      page_slug: "operating-model-current-snapshot",
      item_type: "confirmation_needed",
      title: "Deterministyczna wiki wymaga oceny jakości",
      detail: "Compiler uzywa deterministic-domain-v1 jako glownego wyniku dla trybu domain. Sprawdz, czy tezy sa trafne i czy LLM enrichment ma je wzbogacac.",
      action: "Porownac strony wiki z raw stream 72h i oznaczyc najtrafniejsze jako active/user_confirmed.",
      severity: "low",
      source_refs: deterministicPages[0]?.source_refs?.slice(0, 5) || [],
      metadata: { compiler: "deterministic-domain-v1" },
    });
  }

  if (pages.length === 0 && sourceBundle.length > 0) {
    const buckets = bucketSources(sourceBundle);
    const domainResults = await Promise.all([
      compileDomainPage({
        domain: "stream",
        slug: "current-stream-themes",
        title: "Aktualne tematy ze streamu",
        pageType: "source_summary",
        sources: buckets.stream,
        existingPages: existingRes.data || [],
      }).catch(() => ({ pages: [], reviews: [] })),
      compileDomainPage({
        domain: "friction",
        slug: "current-friction-loops",
        title: "Aktualne friction loops",
        pageType: "friction_loop",
        sources: buckets.friction,
        existingPages: existingRes.data || [],
      }).catch(() => ({ pages: [], reviews: [] })),
      compileDomainPage({
        domain: "planning",
        slug: "planning-execution-loop",
        title: "Petla planowania i wykonania",
        pageType: "decision",
        sources: buckets.planning,
        existingPages: existingRes.data || [],
      }).catch(() => ({ pages: [], reviews: [] })),
      compileDomainPage({
        domain: "health",
        slug: "health-training-state",
        title: "Stan zdrowia i obciazenia",
        pageType: "health",
        sources: buckets.health,
        existingPages: existingRes.data || [],
      }).catch(() => ({ pages: [], reviews: [] })),
    ]);

    pages = domainResults.flatMap((r) => r.pages);
    reviews = domainResults.flatMap((r) => r.reviews);
  }

  if ((pages.length === 0 || pages.every((p) => (p.metadata as any)?.fallback)) && deterministicPages.length > 0) {
    pages = deterministicPages;
  }

  if (pages.length === 0 && sourceBundle.length > 0) {
    const refsFor = (predicate: (s: any) => boolean, max = 10) => sourceBundle.filter(predicate).slice(0, max).map((s: any) => ({
      table: s.table,
      id: s.id,
      date: s.date,
      quote: trimText(s.text, 220),
    }));
    const anyRefs = refsFor(() => true, 12);
    const streamRefs = refsFor((s: any) => s.table === "vanguard_stream", 10);
    const frictionRefs = refsFor((s: any) => s.table === "confirmed_friction_events" || s.table === "vanguard_behavioral_patterns", 10);
    const planningRefs = refsFor((s: any) => s.table === "daily_reconciliations", 10);
    const healthRefs = refsFor((s: any) => s.table === "vanguard_daily_aggregates", 10);

    const fallbackPage = (
      slug: string,
      title: string,
      pageType: string,
      summary: string,
      refs: SourceRef[],
      tag: string,
    ): WikiPageDraft => ({
      slug,
      title,
      page_type: pageType,
      status: "needs_review",
      confidence: 0.45,
      summary: `${summary} Najmocniejszy dowod: ${trimText((refs[0] || anyRefs[0])?.quote, 180)}`,
      content_md: [
        "## Teza",
        summary,
        "",
        "## Dowody",
        ...(refs.length ? refs : anyRefs.slice(0, 6)).map((s: any) => `- ${s.table}:${s.id} (${s.date || "brak daty"}) - ${trimText(s.quote, 180)}`),
        "",
        "## Implikacje",
        "To jest deterministyczny fallback compiled memory. Wymaga kolejnej kompilacji LLM albo potwierdzenia przez usera.",
        "",
        "## Nastepny test",
        "Uzyc tej strony jako indeksu i rozbic kolejne runy na mniejsze domeny.",
      ].join("\n"),
      tags: ["fallback", "compiled-memory", tag],
      source_refs: refs.length ? refs : anyRefs.slice(0, 6),
      metadata: { fallback: true, reason: "empty_model_pages", domain: tag },
    });

    pages.push({
      ...fallbackPage(
        "operating-model-current-snapshot",
        "Aktualny snapshot operacyjny",
        "operating_model",
        `Compiler zebral ${sourceBundle.length} zrodel. To awaryjny, cytowalny indeks aktualnej pamieci operacyjnej.`,
        anyRefs,
        "operating-model",
      ),
    });
    if (streamRefs.length) pages.push(fallbackPage(
      "current-stream-themes",
      "Aktualne tematy ze streamu",
      "source_summary",
      `Ostatni stream ma ${streamRefs.length} cytowanych wpisow do kompilacji tematow, projektow i stanow.`,
      streamRefs,
      "stream",
    ));
    if (frictionRefs.length) pages.push(fallbackPage(
      "current-friction-loops",
      "Aktualne friction loops",
      "friction_loop",
      `W ostatnim oknie sa ${frictionRefs.length} cytowane sygnaly friction/patterns do review.`,
      frictionRefs,
      "friction",
    ));
    if (planningRefs.length) pages.push(fallbackPage(
      "planning-execution-loop",
      "Petla planowania i wykonania",
      "decision",
      `Reconciliation/planning ma ${planningRefs.length} zrodel do oceny jak plan przechodzi w wykonanie.`,
      planningRefs,
      "planning",
    ));
    if (healthRefs.length) pages.push(fallbackPage(
      "health-training-state",
      "Stan zdrowia i obciazenia",
      "health",
      `Agregaty dzienne maja ${healthRefs.length} zrodel do laczenia stanu, regeneracji i wykonania.`,
      healthRefs,
      "health",
    ));

    reviews.push({
      page_slug: "operating-model-current-snapshot",
      item_type: "confirmation_needed",
      title: "Wiki compiler zwrocil pusty wynik modelu",
      detail: "Awaryjny snapshot zostal utworzony z raw sources. Trzeba sprawdzic, czy prompt/model powinien generowac bardziej szczegolowe strony.",
      action: "Ponowic compiler i/lub rozbic sources na mniejsze domeny: behavior, trening, projekty.",
      severity: "medium",
      source_refs: anyRefs.slice(0, 5),
      metadata: { fallback: true },
    });
  }

  if (opts.dryRun) {
    return {
      success: true,
      dry_run: true,
      source_count: sourceBundle.length,
      pages,
      review_items: reviews,
    };
  }

  let pagesUpserted = 0;
  let reviewCreated = 0;
  const pageIdBySlug: Record<string, string> = {};

  for (const draft of pages.slice(0, 8)) {
    const slug = slugify(draft.slug || draft.title);
    try {
      const refs = safeArray<SourceRef>(draft.source_refs).slice(0, 12);
      const payload = {
        user_id: userId,
        slug,
        title: trimText(draft.title || slug, 120),
        page_type: draft.page_type || "concept",
        status: draft.status || "hypothesis",
        confidence: clamp(Number(draft.confidence ?? 0.55)),
        summary: trimText(draft.summary || "", 600),
        content_md: String(draft.content_md || draft.summary || ""),
        tags: Array.isArray(draft.tags) ? draft.tags.slice(0, 12).map(String) : [],
        source_refs: refs,
        metadata: draft.metadata || {},
        first_seen_at: refs[0]?.date || null,
        last_seen_at: refs[0]?.date || null,
        last_compiled_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const { data, error } = await supabase
        .from("vanguard_wiki_pages")
        .upsert(payload, { onConflict: "user_id,slug" })
        .select("id, slug")
        .single();
      if (error) throw error;
      pagesUpserted++;
      pageIdBySlug[data.slug] = data.id;

      for (const ref of refs) {
        if (!ref.table || !ref.id) continue;
        const { error: sourceErr } = await supabase.from("vanguard_wiki_sources").upsert({
          user_id: userId,
          page_id: data.id,
          source_table: ref.table,
          source_id: String(ref.id),
          source_date: ref.date || null,
          quote: ref.quote ? trimText(ref.quote, 500) : null,
          relevance: 0.75,
        }, { onConflict: "page_id,source_table,source_id" });
        if (sourceErr) console.error(`[wiki-compiler] Failed to upsert source for page ${data.slug}:`, sourceErr);
      }
    } catch (err: any) {
      console.error(`[wiki-compiler] Failed to upsert page "${slug}", skipping:`, err?.message || err);
    }
  }

  if (archivedPages.length > 0) {
    const { error: archiveErr } = await supabase
      .from("vanguard_wiki_pages")
      .update({ status: "archived", updated_at: now.toISOString() })
      .eq("user_id", userId)
      .in("slug", archivedPages.map(s => slugify(s)));

    if (archiveErr) {
      console.error("[wiki-compiler] Failed to archive pages:", archiveErr);
    } else {
      console.log(`[wiki-compiler] Mem0 archived ${archivedPages.length} pages: ${archivedPages.join(", ")}`);
    }
  }

  for (const item of reviews.slice(0, 8)) {
    const dedupeKey = uniqueReviewKey(userId, item);
    const existing = await supabase
      .from("vanguard_wiki_review_items")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "open")
      .eq("metadata->>dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing.data?.id) continue;

    const pageId = item.page_slug ? pageIdBySlug[slugify(item.page_slug)] || null : null;
    const { error } = await supabase.from("vanguard_wiki_review_items").insert({
      user_id: userId,
      page_id: pageId,
      item_type: item.item_type || "confirmation_needed",
      title: trimText(item.title || "Review needed", 160),
      detail: String(item.detail || ""),
      action: item.action ? trimText(item.action, 500) : null,
      severity: item.severity || "medium",
      source_refs: safeArray<SourceRef>(item.source_refs).slice(0, 10),
      metadata: { ...(item.metadata || {}), dedupe_key: dedupeKey },
    });
    if (error) throw error;
    reviewCreated++;
  }

  await supabase.from("vanguard_wiki_runs").insert({
    user_id: userId,
    mode: opts.mode,
    source_window: { days: opts.days, cut_stream: cutStream, cut_friction: cutFriction, source_count: sourceBundle.length },
    pages_upserted: pagesUpserted,
    review_created: reviewCreated,
    status: "success",
    metadata: { requested_limit: opts.limit, llm_response: parsed },
  });

  return {
    success: true,
    source_count: sourceBundle.length,
    pages_upserted: pagesUpserted,
    review_created: reviewCreated,
    debug: {
      raw_content: content,
      parsed_response: parsed,
      archived_pages: archivedPages,
      raw_chat_result: chatResult.raw
    }
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createServiceClient();
  try {
    const body = await req.json().catch(() => ({}));
    const requestedUserId = body.userId ? String(body.userId) : null;
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    const cronSecret = Deno.env.get("VANGUARD_CRON_SECRET") || "";
    const isCron = !!cronSecret && bearer === cronSecret;

    let canCompileAllUsers = isCron;
    let scopedUserId: string | null = requestedUserId;
    if (!isCron) {
      const scoped = await resolveUserScope(req, requestedUserId);
      canCompileAllUsers = scoped.isServiceRole && !requestedUserId;
      scopedUserId = requestedUserId || scoped.userId;
      if (!scoped.isServiceRole && !scopedUserId) throw new Error("Missing userId");
    }

    const mode = String(body.mode || "incremental");
    const days = Math.max(1, Math.min(90, Number(body.days ?? 21)));
    const limit = Math.max(10, Math.min(120, Number(body.limit ?? 60)));
    const dryRun = !!body.dry_run;

    let userIds: string[] = [];
    if (scopedUserId) userIds = [scopedUserId];
    else if (!canCompileAllUsers) throw new Error("Missing userId");
    else {
      const { data, error } = await supabase.from("user_settings").select("user_id").not("user_id", "is", null);
      if (error) throw error;
      userIds = Array.from(new Set((data || []).map((row: any) => row.user_id).filter(Boolean)));
    }
    if (!userIds.length) throw new Error("No users found");

    const results = [];
    for (const userId of userIds) {
      try {
        results.push({ user_id: userId, ...(await compileForUser(supabase, userId, { mode, days, limit, dryRun })) });
      } catch (err) {
        await supabase.from("vanguard_wiki_runs").insert({
          user_id: userId,
          mode,
          source_window: { days, limit },
          status: "failed",
          error: String((err as Error)?.message || err),
        });
        results.push({ user_id: userId, success: false, error: String((err as Error)?.message || err) });
      }
    }

    const ok = results.every((r: any) => r.success);
    return new Response(JSON.stringify({ success: ok, results }), {
      status: ok ? 200 : 207,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = String((err as Error)?.message || err);
    const status = /Authorization|token|Forbidden|Missing userId/i.test(message) ? 401 : 500;
    return new Response(JSON.stringify({ success: false, error: String((err as Error)?.message || err) }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
