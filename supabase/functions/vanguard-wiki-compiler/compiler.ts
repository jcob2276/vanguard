import { deepseekChat, parseJsonFromContent } from "../_shared/deepseek.ts";
import { LLM_TASKS } from "../_shared/llm/tasks.ts";
import { getWarsawDateString } from "../_shared/time.ts";
import { getEmbedding } from "../_shared/openai.ts";
import { ALLOWED_WIKI_PAGE_TYPES, ALLOWED_WIKI_STATUSES } from "../_shared/domain.ts";
import {
  type SourceRef, type WikiPageDraft, type ReviewDraft,
  clamp, slugify, safeArray, trimText, compactSources, sourceRefs,
  buildDeterministicDomainPages, compileDomainPage, uniqueReviewKey,
} from "./deterministic.ts";

type QueryResult = { data: unknown; error: { message: string } | null };
export async function compileForUser(supabase: any, userId: string, opts: { mode: string; days: number; limit: number; dryRun: boolean }) {
  const now = new Date(); const today = getWarsawDateString(now);
  const cutStream = new Date(now.getTime() - opts.days * 864e5).toISOString();
  const cutFriction = new Date(now.getTime() - Math.max(opts.days, 30) * 864e5).toISOString();
  const cut14Date = getWarsawDateString(new Date(now.getTime() - 13 * 864e5));

  const [streamRes, frictionRes, recRes, aggregateRes, existingRes, patternsRes] = await Promise.all([
    supabase.from("vanguard_stream").select("id, created_at, category, source, content").eq("user_id", userId).gte("created_at", cutStream).order("created_at", { ascending: false }).limit(opts.limit),
    supabase.from("confirmed_friction_events").select("*").eq("user_id", userId).gte("occurred_at", cutFriction).order("occurred_at", { ascending: false }).limit(60),
    supabase.from("daily_reconciliations").select("id, date, created_at, events_summary, user_response, planning_summary, p2_parsed, day_score, plan_quality, plan_failure_reason").eq("user_id", userId).gte("date", cut14Date).order("date", { ascending: false }).limit(14),
    supabase.from("vanguard_daily_aggregates").select("id, date, final_state, execution_score, sleep_hours, hrv_avg, readiness_score, dopamine_load_index").eq("user_id", userId).gte("date", cut14Date).order("date", { ascending: false }).limit(14),
    supabase.from("vanguard_wiki_pages").select("slug, title, page_type, status, confidence, summary, updated_at").eq("user_id", userId).not("status", "eq", "archived").order("last_compiled_at", { ascending: false }).limit(40),
    supabase.from("vanguard_behavioral_patterns").select("id, pattern_type, title, evidence_text, occurrence_count, confidence, status, last_seen").eq("user_id", userId).in("status", ["visible", "user_confirmed", "pending"]).order("last_seen", { ascending: false }).limit(25),
  ]);

  for (const [name, res] of Object.entries({ streamRes, frictionRes, recRes, aggregateRes, existingRes, patternsRes })) {
    const r = res as QueryResult;
    if (r.error) console.warn(`[wiki-compiler] source query failed: ${name}: ${r.error.message}`);
  }
  const sourceBundle = [
    ...compactSources(streamRes.data || [], "vanguard_stream", ["category", "content"]),
    ...compactSources(frictionRes.data || [], "confirmed_friction_events", ["friction_type", "raw_text", "actual_behavior", "declared_intention"]),
    ...compactSources(recRes.data || [], "daily_reconciliations", ["events_summary", "user_response", "plan_quality", "plan_failure_reason"]),
    ...compactSources(aggregateRes.data || [], "vanguard_daily_aggregates", ["final_state"]),
    ...compactSources(patternsRes.data || [], "vanguard_behavioral_patterns", ["pattern_type", "title", "evidence_text"]),
  ];

  const system = buildCompilerSystemPrompt();
  const user = buildCompilerUserPrompt(today, opts.mode, existingRes.data || [], sourceBundle);

  const chatResult = await deepseekChat({
    apiKey: Deno.env.get("DEEPSEEK_API_KEY") || "",
    ...LLM_TASKS.structured,
    maxTokens: 8000,
    timeoutMs: 75000,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  });
  const content = chatResult.content;

  console.log("[wiki-compiler] LLM Raw Response:", content);
  const parsed = parseJsonFromContent(content) || {};
  const lp = parsed as Record<string, unknown>;
  let pages = safeArray<WikiPageDraft>((lp.pages || lp.wiki_pages) as WikiPageDraft[] | undefined);
  let reviews = safeArray<ReviewDraft>((lp.review_items || lp.reviews) as ReviewDraft[] | undefined);
  const archivedPages = safeArray<string>((lp.archived_pages || lp.archived) as string[] | undefined);
  const deterministicPages = buildDeterministicDomainPages(sourceBundle);

  if (opts.mode.includes("domain") && deterministicPages.length > 0) {
    pages = deterministicPages;
    reviews.push({
      page_slug: "operating-model-current-snapshot", item_type: "confirmation_needed",
      title: "Deterministyczna wiki wymaga oceny jakości",
      detail: "Compiler uzywa deterministic-domain-v1 jako glownego wyniku dla trybu domain.",
      action: "Porownac strony wiki z raw stream 72h i oznaczyc najtrafniejsze jako active/user_confirmed.",
      severity: "low", source_refs: deterministicPages[0]?.source_refs?.slice(0, 5) || [],
      metadata: { compiler: "deterministic-domain-v1" },
    });
  }

  if (pages.length === 0 && sourceBundle.length > 0) {
    const buckets = {
      stream: sourceBundle.filter((s) => s.table === "vanguard_stream"),
      friction: sourceBundle.filter((s) => s.table === "confirmed_friction_events" || s.table === "vanguard_behavioral_patterns"),
      planning: sourceBundle.filter((s) => s.table === "daily_reconciliations"),
      health: sourceBundle.filter((s) => s.table === "vanguard_daily_aggregates"),
    };
    const domainResults = await Promise.all([
      compileDomainPage({ domain: "stream", slug: "current-stream-themes", title: "Aktualne tematy ze streamu", pageType: "source_summary", sources: buckets.stream, existingPages: existingRes.data || [] }).catch(() => ({ pages: [], reviews: [] })),
      compileDomainPage({ domain: "friction", slug: "current-friction-loops", title: "Aktualne friction loops", pageType: "friction_loop", sources: buckets.friction, existingPages: existingRes.data || [] }).catch(() => ({ pages: [], reviews: [] })),
      compileDomainPage({ domain: "planning", slug: "planning-execution-loop", title: "Petla planowania i wykonania", pageType: "decision", sources: buckets.planning, existingPages: existingRes.data || [] }).catch(() => ({ pages: [], reviews: [] })),
      compileDomainPage({ domain: "health", slug: "health-training-state", title: "Stan zdrowia i obciazenia", pageType: "health", sources: buckets.health, existingPages: existingRes.data || [] }).catch(() => ({ pages: [], reviews: [] })),
    ]);
    pages = domainResults.flatMap((r) => r.pages);
    reviews = domainResults.flatMap((r) => r.reviews);
  }

  if ((pages.length === 0 || pages.every((p) => (p.metadata as Record<string, unknown>)?.fallback)) && deterministicPages.length > 0) pages = deterministicPages;

  if (pages.length === 0 && sourceBundle.length > 0) {
    pages = buildFallbackPages(sourceBundle);
    reviews.push({
      page_slug: "operating-model-current-snapshot", item_type: "confirmation_needed",
      title: "Wiki compiler zwrocil pusty wynik modelu",
      detail: "Awaryjny snapshot zostal utworzony z raw sources.",
      action: "Ponowic compiler i/lub rozbic sources na mniejsze domeny.",
      severity: "medium", source_refs: sourceBundle.slice(0, 5).map((s: any) => ({ table: s.table, id: s.id, date: s.date })),
      metadata: { fallback: true },
    });
  }

  if (opts.dryRun) return { success: true, dry_run: true, source_count: sourceBundle.length, pages, review_items: reviews };

  return await persistResults(supabase, userId, now, pages, reviews, archivedPages, sourceBundle, cutStream, cutFriction, opts, parsed, content, chatResult);
}

function buildCompilerSystemPrompt(): string {
  return `Jestes Vanguard Wiki Compiler.
Budujesz derived/compiled memory, nie source-of-truth. Surowe dowody sa nienaruszalne.

Zasada PROFILING OVER LOGGING (Krytyczna):
1. Konwertuj Zdarzenia na Atrybuty/Zasady.
2. Agresywne Scalanie i Nadpisywanie.
3. Odrzucaj Szum.

Zadanie:
- aktualizuj zywa wiki o Jakubie: wzorce zachowania, projekty, trening/zdrowie, decyzje, osoby, friction loops, operating model.
- nie tworz "ostatecznych prawd" bez mocnych dowodow.
- kazda strona musi miec source_refs z konkretnych id z listy SOURCES.
- gdy widzisz sprzecznosc, malo dowodow, stary claim albo potrzebna decyzje usera, dodaj review_items.
- jesli jakakolwiek istniejąca strona wiki jest juz nieaktualna, dodaj ja do "archived_pages".
- pisz po polsku, konkretnie, bez coachingu motywacyjnego.

JSON schema:
{
  "pages": [{
    "slug": "kebab-case", "title": "...",
    "page_type": "identity|behavior_pattern|person|project|training|health|decision|friction_loop|concept|source_summary|operating_model|goal",
    "status": "hypothesis|active|needs_review|user_confirmed",
    "confidence": 0.0, "summary": "1-2 zdania", "content_md": "markdown",
    "tags": ["..."], "source_refs": [{"table":"...","id":"...","date":"...","quote":"..."}],
    "metadata": {"why_updated":"..."}
  }],
  "archived_pages": ["slug-to-archive"],
  "review_items": [{
    "page_slug": "...", "item_type": "contradiction|stale_claim|weak_evidence|missing_source|merge_candidate|confirmation_needed|deep_research",
    "title": "...", "detail": "...", "action": "...", "severity": "low|medium|high",
    "source_refs": [{"table":"...","id":"..."}], "metadata": {}
  }]
}
Limit: 3-8 pages, max 8 review_items.`;
}

function buildCompilerUserPrompt(today: string, mode: string, existingPages: any[], sourceBundle: any[]): string {
  return `DATA: ${today}
MODE: ${mode}

EXISTING WIKI PAGES:
${JSON.stringify(existingPages, null, 2)}

SOURCES:
${JSON.stringify(sourceBundle, null, 2)}

Priorytet:
1. Utrwal najwazniejsze wzorce, ktore poprawiaja decyzje Oracle.
2. Laczyc stream + friction + reconciliation + biometrie, ale tylko z cytowalnym evidence.
3. Oznaczac rzeczy niepewne jako hypothesis/needs_review.`;
}

function buildFallbackPages(sourceBundle: any[]): WikiPageDraft[] {
  const refsFor = (predicate: (s: any) => boolean, max = 10) => sourceBundle.filter(predicate).slice(0, max).map((s: any) => ({
    table: s.table, id: s.id, date: s.date, quote: trimText(s.text, 220),
  }));
  const anyRefs = refsFor(() => true, 12);
  const streamRefs = refsFor((s: any) => s.table === "vanguard_stream", 10);
  const frictionRefs = refsFor((s: any) => s.table === "confirmed_friction_events" || s.table === "vanguard_behavioral_patterns", 10);
  const planningRefs = refsFor((s: any) => s.table === "daily_reconciliations", 10);
  const healthRefs = refsFor((s: any) => s.table === "vanguard_daily_aggregates", 10);

  const fallbackPage = (slug: string, title: string, pageType: string, summary: string, refs: SourceRef[], tag: string): WikiPageDraft => ({
    slug, title, page_type: pageType, status: "needs_review", confidence: 0.45,
    summary: `${summary} Najmocniejszy dowod: ${trimText((refs[0] || anyRefs[0])?.quote, 180)}`,
    content_md: [
      "## Teza", summary, "",
      "## Dowody",
      ...(refs.length ? refs : anyRefs.slice(0, 6)).map((s: any) => `- ${s.table}:${s.id} (${s.date || "brak daty"}) - ${trimText(s.quote, 180)}`),
      "",
      "## Implikacje", "To jest deterministyczny fallback compiled memory.", "",
      "## Nastepny test", "Uzyc tej strony jako indeksu i rozbic kolejne runy na mniejsze domeny.",
    ].join("\n"),
    tags: ["fallback", "compiled-memory", tag],
    source_refs: refs.length ? refs : anyRefs.slice(0, 6),
    metadata: { fallback: true, reason: "empty_model_pages", domain: tag },
  });

  const pages: WikiPageDraft[] = [];
  pages.push(fallbackPage("operating-model-current-snapshot", "Aktualny snapshot operacyjny", "operating_model",
    `Compiler zebral ${sourceBundle.length} zrodel.`, anyRefs, "operating-model"));
  if (streamRefs.length) pages.push(fallbackPage("current-stream-themes", "Aktualne tematy ze streamu", "source_summary",
    `Ostatni stream ma ${streamRefs.length} cytowanych wpisow.`, streamRefs, "stream"));
  if (frictionRefs.length) pages.push(fallbackPage("current-friction-loops", "Aktualne friction loops", "friction_loop",
    `W ostatnim oknie sa ${frictionRefs.length} sygnalow friction/patterns.`, frictionRefs, "friction"));
  if (planningRefs.length) pages.push(fallbackPage("planning-execution-loop", "Petla planowania i wykonania", "decision",
    `Reconciliation/planning ma ${planningRefs.length} zrodel.`, planningRefs, "planning"));
  if (healthRefs.length) pages.push(fallbackPage("health-training-state", "Stan zdrowia i obciazenia", "health",
    `Agregaty dzienne maja ${healthRefs.length} zrodel.`, healthRefs, "health"));
  return pages;
}

async function persistResults(supabase: any, userId: string, now: Date, pages: WikiPageDraft[], reviews: ReviewDraft[], archivedPages: string[], sourceBundle: any[], cutStream: string, cutFriction: string, opts: any, parsed: any, content: string, chatResult: any) {
  let pagesUpserted = 0;
  let reviewCreated = 0;
  const pageIdBySlug: Record<string, string> = {};

  for (const draft of pages.slice(0, 8)) {
    const slug = slugify(draft.slug || draft.title);
    try {
      const refs = safeArray<SourceRef>(draft.source_refs).slice(0, 12);
      // page_type/status pochodzą z LLM — clamp na słowniki zgodne z CHECK constraintami,
      // inaczej nielegalna wartość = cichy skip całej strony (catch niżej).
      const pageType = (ALLOWED_WIKI_PAGE_TYPES as readonly string[]).includes(draft.page_type ?? "") ? draft.page_type : "concept";
      const pageStatus = (ALLOWED_WIKI_STATUSES as readonly string[]).includes(draft.status ?? "") ? draft.status : "hypothesis";
      const payload = {
        user_id: userId, slug, title: trimText(draft.title || slug, 120),
        page_type: pageType, status: pageStatus,
        confidence: clamp(Number(draft.confidence ?? 0.55)),
        summary: trimText(draft.summary || "", 600),
        content_md: String(draft.content_md || draft.summary || ""),
        tags: Array.isArray(draft.tags) ? draft.tags.slice(0, 12).map(String) : [],
        source_refs: refs, metadata: draft.metadata || {},
        first_seen_at: refs[0]?.date || null, last_seen_at: refs[0]?.date || null,
        last_compiled_at: now.toISOString(), updated_at: now.toISOString(),
      };

      const { data, error } = await supabase.from("vanguard_wiki_pages").upsert(payload, { onConflict: "user_id,slug" }).select("id, slug").single();
      if (error) throw error;
      pagesUpserted++;
      pageIdBySlug[data.slug] = data.id;

      // Sync to vanguard_knowledge
      try {
        const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
        if (openaiKey) {
          const titleText = trimText(draft.title || slug, 120);
          const summaryText = trimText(draft.summary || "", 600);
          const knowledgeContent = `${titleText}: ${summaryText}`;
          const embedding = await getEmbedding(knowledgeContent, openaiKey);
          if (embedding) {
            const importanceScore = Math.round(clamp(Number(draft.confidence ?? 0.55)) * 10);
            const isVerified = pageStatus === "user_confirmed" || pageStatus === "active";
            const { data: existingKn } = await supabase.from("vanguard_knowledge").select("id").eq("user_id", userId).eq("metadata->>slug", slug).maybeSingle();
            const payloadKn: any = {
              user_id: userId, title: titleText, content: knowledgeContent,
              category: pageType, importance_score: importanceScore,
              is_verified: isVerified, embedding, metadata: { slug, wiki_page_id: data.id },
              updated_at: now.toISOString(),
            };
            if (existingKn?.id) payloadKn.id = existingKn.id;
            else payloadKn.created_at = now.toISOString();
            const { error: knErr } = await supabase.from("vanguard_knowledge").upsert(payloadKn);
            if (knErr) console.error(`[wiki-compiler] Failed to sync to vanguard_knowledge for ${slug}:`, knErr.message);
          }
        }
      } catch (knSyncErr: unknown) {
        console.error('[Edge Function Error]', knSyncErr);
      }

      for (const ref of refs) {
        if (!ref.table || !ref.id) continue;
        const { error: sourceErr } = await supabase.from("vanguard_wiki_sources").upsert({
          user_id: userId, page_id: data.id, source_table: ref.table,
          source_id: String(ref.id), source_date: ref.date || null,
          quote: ref.quote ? trimText(ref.quote, 500) : null, relevance: 0.75,
        }, { onConflict: "page_id,source_table,source_id" });
        if (sourceErr) console.error(`[wiki-compiler] Failed to upsert source for ${data.slug}:`, sourceErr);
      }
    } catch (err: unknown) { console.error('[Edge Function Error]', err); }
  }
  if (archivedPages.length > 0) {
    const { error: archiveErr } = await supabase.from("vanguard_wiki_pages")
      .update({ status: "archived", updated_at: now.toISOString() })
      .eq("user_id", userId).in("slug", archivedPages.map(s => slugify(s)));
    if (archiveErr) console.error("[wiki-compiler] Failed to archive pages:", archiveErr);
  }
  for (const item of reviews.slice(0, 8)) {
    const dedupeKey = uniqueReviewKey(userId, item);
    const existing = await supabase.from("vanguard_wiki_review_items").select("id")
      .eq("user_id", userId).eq("status", "open").eq("metadata->>dedupe_key", dedupeKey).maybeSingle();
    if (existing.data?.id) continue;
    const pageId = item.page_slug ? pageIdBySlug[slugify(item.page_slug)] || null : null;
    const { error } = await supabase.from("vanguard_wiki_review_items").insert({
      user_id: userId, page_id: pageId, item_type: item.item_type || "confirmation_needed",
      title: trimText(item.title || "Review needed", 160), detail: String(item.detail || ""),
      action: item.action ? trimText(item.action, 500) : null,
      severity: item.severity || "medium",
      source_refs: safeArray<SourceRef>(item.source_refs).slice(0, 10),
      metadata: { ...(item.metadata || {}), dedupe_key: dedupeKey },
    });
    if (error) throw error;
    reviewCreated++;
  }

  await supabase.from("vanguard_wiki_runs").insert({
    user_id: userId, mode: opts.mode,
    source_window: { days: opts.days, cut_stream: cutStream, cut_friction: cutFriction, source_count: sourceBundle.length },
    pages_upserted: pagesUpserted, review_created: reviewCreated, status: "success",
    metadata: { requested_limit: opts.limit, llm_response: parsed },
  }).throwOnError();

  return {
    success: true, source_count: sourceBundle.length,
    pages_upserted: pagesUpserted, review_created: reviewCreated,
    debug: { raw_content: content, parsed_response: parsed, archived_pages: archivedPages, raw_chat_result: chatResult.raw },
  };
}
