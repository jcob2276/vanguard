-- system_proposals: pending evidence-based proposals (friction clusters, etc.)
-- Only-me Vanguard — sync via RPC, no new edge function.

CREATE TABLE IF NOT EXISTS public.system_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_type text NOT NULL CHECK (proposal_type IN ('friction_cluster', 'clarification', 'schedule_edit')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  dedupe_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (user_id, dedupe_key)
);

ALTER TABLE public.system_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.system_proposals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_system_proposals_user_pending
  ON public.system_proposals (user_id, created_at DESC)
  WHERE status = 'pending';

-- Aggregate confirmed friction (N>=3 / 7d Warsaw) → upsert pending proposals.
CREATE OR REPLACE FUNCTION public.sync_friction_proposals(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  cutoff timestamptz;
  week_key text;
  rec record;
  sample_ids jsonb;
  sample_snippets jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  cutoff := ((now() AT TIME ZONE 'Europe/Warsaw')::date - 7)::timestamptz;
  week_key := to_char((now() AT TIME ZONE 'Europe/Warsaw')::date, 'IYYY-"W"IW');

  FOR rec IN
    SELECT
      e.friction_type,
      count(*)::int AS cnt
    FROM public.confirmed_friction_events e
    WHERE e.user_id = p_user_id
      AND e.occurred_at >= cutoff
      AND e.friction_type IS NOT NULL
      AND btrim(e.friction_type) <> ''
    GROUP BY e.friction_type
    HAVING count(*) >= 3
  LOOP
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb)
    INTO sample_ids
    FROM (
      SELECT id
      FROM public.confirmed_friction_events
      WHERE user_id = p_user_id
        AND friction_type = rec.friction_type
        AND occurred_at >= cutoff
      ORDER BY occurred_at DESC
      LIMIT 5
    ) s;

    SELECT coalesce(jsonb_agg(snippet), '[]'::jsonb)
    INTO sample_snippets
    FROM (
      SELECT left(coalesce(nullif(btrim(deviation), ''), nullif(btrim(raw_text), ''), '—'), 140) AS snippet
      FROM public.confirmed_friction_events
      WHERE user_id = p_user_id
        AND friction_type = rec.friction_type
        AND occurred_at >= cutoff
      ORDER BY occurred_at DESC
      LIMIT 3
    ) t;

    INSERT INTO public.system_proposals (
      user_id, proposal_type, dedupe_key, title, body, payload
    ) VALUES (
      p_user_id,
      'friction_cluster',
      'friction:' || rec.friction_type || ':' || week_key,
      'Powtarzająca się obserwacja (' || rec.cnt || '×)',
      'Typ «' || rec.friction_type || '» — ' || rec.cnt || ' potwierdzone wpisy w ostatnich 7 dniach.',
      jsonb_build_object(
        'friction_type', rec.friction_type,
        'count', rec.cnt,
        'window_days', 7,
        'event_ids', sample_ids,
        'snippets', sample_snippets
      )
    )
    ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      payload = EXCLUDED.payload
    WHERE public.system_proposals.status = 'pending';

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_friction_proposals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_friction_proposals(uuid) TO authenticated, service_role;
