-- Vanguard Wiki: compiled reasoning layer inspired by the LLM Wiki pattern.
-- Evidence remains canonical in vanguard_stream/friction/aggregates; wiki pages are derived.

CREATE TABLE IF NOT EXISTS public.vanguard_wiki_pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug              text NOT NULL,
  title             text NOT NULL,
  page_type         text NOT NULL DEFAULT 'concept' CHECK (page_type IN (
    'identity', 'behavior_pattern', 'person', 'project', 'training', 'health',
    'decision', 'friction_loop', 'concept', 'source_summary', 'operating_model'
  )),
  status            text NOT NULL DEFAULT 'hypothesis' CHECK (status IN (
    'hypothesis', 'active', 'needs_review', 'user_confirmed', 'user_rejected', 'archived'
  )),
  confidence        numeric NOT NULL DEFAULT 0.55 CHECK (confidence >= 0 AND confidence <= 1),
  summary           text NOT NULL DEFAULT '',
  content_md        text NOT NULL DEFAULT '',
  tags              text[] NOT NULL DEFAULT '{}',
  source_refs       jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at     timestamptz,
  last_seen_at      timestamptz,
  last_compiled_at  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_vanguard_wiki_pages_user_type
  ON public.vanguard_wiki_pages (user_id, page_type, status, last_compiled_at DESC);

CREATE INDEX IF NOT EXISTS idx_vanguard_wiki_pages_user_confidence
  ON public.vanguard_wiki_pages (user_id, confidence DESC, last_compiled_at DESC);

CREATE TABLE IF NOT EXISTS public.vanguard_wiki_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id         uuid NOT NULL REFERENCES public.vanguard_wiki_pages(id) ON DELETE CASCADE,
  source_table    text NOT NULL,
  source_id       text NOT NULL,
  source_date     timestamptz,
  quote           text,
  relevance       numeric NOT NULL DEFAULT 0.7 CHECK (relevance >= 0 AND relevance <= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_vanguard_wiki_sources_user_source
  ON public.vanguard_wiki_sources (user_id, source_table, source_id);

CREATE TABLE IF NOT EXISTS public.vanguard_wiki_review_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id         uuid REFERENCES public.vanguard_wiki_pages(id) ON DELETE SET NULL,
  item_type       text NOT NULL CHECK (item_type IN (
    'contradiction', 'stale_claim', 'weak_evidence', 'missing_source',
    'merge_candidate', 'confirmation_needed', 'deep_research'
  )),
  title           text NOT NULL,
  detail          text NOT NULL,
  action          text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'accepted', 'rejected', 'snoozed', 'resolved', 'archived'
  )),
  severity        text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  source_refs     jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vanguard_wiki_review_user_status
  ON public.vanguard_wiki_review_items (user_id, status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vanguard_wiki_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode            text NOT NULL DEFAULT 'incremental',
  source_window   jsonb NOT NULL DEFAULT '{}'::jsonb,
  pages_upserted  integer NOT NULL DEFAULT 0,
  review_created  integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vanguard_wiki_runs_user_created
  ON public.vanguard_wiki_runs (user_id, created_at DESC);

ALTER TABLE public.vanguard_wiki_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_wiki_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_wiki_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vanguard_wiki_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own wiki pages" ON public.vanguard_wiki_pages;
CREATE POLICY "Users manage own wiki pages"
  ON public.vanguard_wiki_pages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role bypass wiki pages" ON public.vanguard_wiki_pages;
CREATE POLICY "Service role bypass wiki pages"
  ON public.vanguard_wiki_pages FOR ALL TO service_role
  USING (true);

DROP POLICY IF EXISTS "Users manage own wiki sources" ON public.vanguard_wiki_sources;
CREATE POLICY "Users manage own wiki sources"
  ON public.vanguard_wiki_sources FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role bypass wiki sources" ON public.vanguard_wiki_sources;
CREATE POLICY "Service role bypass wiki sources"
  ON public.vanguard_wiki_sources FOR ALL TO service_role
  USING (true);

DROP POLICY IF EXISTS "Users manage own wiki review items" ON public.vanguard_wiki_review_items;
CREATE POLICY "Users manage own wiki review items"
  ON public.vanguard_wiki_review_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role bypass wiki review items" ON public.vanguard_wiki_review_items;
CREATE POLICY "Service role bypass wiki review items"
  ON public.vanguard_wiki_review_items FOR ALL TO service_role
  USING (true);

DROP POLICY IF EXISTS "Users read own wiki runs" ON public.vanguard_wiki_runs;
CREATE POLICY "Users read own wiki runs"
  ON public.vanguard_wiki_runs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role bypass wiki runs" ON public.vanguard_wiki_runs;
CREATE POLICY "Service role bypass wiki runs"
  ON public.vanguard_wiki_runs FOR ALL TO service_role
  USING (true);

COMMENT ON TABLE public.vanguard_wiki_pages IS
  'Compiled reasoning layer. LLM-maintained wiki pages derived from canonical evidence; never source-of-truth.';

COMMENT ON COLUMN public.vanguard_wiki_pages.source_refs IS
  'JSON array of cited evidence refs, e.g. [{table:"vanguard_stream", id:"...", date:"...", quote:"..."}].';

COMMENT ON TABLE public.vanguard_wiki_review_items IS
  'Human review queue for contradictions, weak evidence, stale claims, and confirmation needs discovered by the wiki compiler.';
