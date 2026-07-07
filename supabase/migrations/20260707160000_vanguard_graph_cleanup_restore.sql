-- Restore public.vanguard_graph_cleanup() function and schedule it weekly on Sunday at 05:00 Warsaw time.

CREATE OR REPLACE FUNCTION public.vanguard_graph_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    r_source RECORD;
    r_target RECORD;
BEGIN
    -- 1. Entity Resolution
    FOR r IN (
        SELECT DISTINCT ON (least(e1.name, e2.name), greatest(e1.name, e2.name))
            e1.name as loser,
            e2.name as winner,
            e1.user_id
        FROM (
            SELECT DISTINCT source_entity as name, user_id FROM public.vanguard_entity_links
            UNION
            SELECT DISTINCT target_entity as name, user_id FROM public.vanguard_entity_links
        ) e1
        JOIN (
            SELECT DISTINCT source_entity as name, user_id FROM public.vanguard_entity_links
            UNION
            SELECT DISTINCT target_entity as name, user_id FROM public.vanguard_entity_links
        ) e2 ON e1.user_id = e2.user_id AND e1.name < e2.name
        WHERE similarity(e1.name, e2.name) > 0.85
        ORDER BY least(e1.name, e2.name), greatest(e1.name, e2.name), 
                 (CASE WHEN length(e2.name) >= length(e1.name) THEN 1 ELSE 0 END) DESC
    ) LOOP
        -- DLA KAŻDEGO WIERSZA "LOSERA" JAKO SOURCE
        FOR r_source IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND source_entity = r.loser) LOOP
            INSERT INTO public.vanguard_entity_links (
                user_id, source_entity, source_type, relation, target_entity, target_type, weight, evidence_count, first_seen, last_seen, temporal_status, status, observed_at, valid_from, valid_until
            )
            VALUES (
                r.user_id, r.winner, r_source.source_type, r_source.relation, r_source.target_entity, r_source.target_type, r_source.weight, r_source.evidence_count, r_source.first_seen, r_source.last_seen, r_source.temporal_status, r_source.status, r_source.observed_at, r_source.valid_from, r_source.valid_until
            )
            ON CONFLICT (user_id, source_entity, relation, target_entity)
            DO UPDATE SET
                evidence_count = vanguard_entity_links.evidence_count + EXCLUDED.evidence_count,
                weight = GREATEST(vanguard_entity_links.weight, EXCLUDED.weight),
                last_seen = GREATEST(vanguard_entity_links.last_seen, EXCLUDED.last_seen);
        END LOOP;

        -- DLA KAŻDEGO WIERSZA "LOSERA" JAKO TARGET
        FOR r_target IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND target_entity = r.loser) LOOP
            INSERT INTO public.vanguard_entity_links (
                user_id, source_entity, source_type, relation, target_entity, target_type, weight, evidence_count, first_seen, last_seen, temporal_status, status, observed_at, valid_from, valid_until
            )
            VALUES (
                r.user_id, r_target.source_entity, r_target.source_type, r_target.relation, r.winner, r_target.target_type, r_target.weight, r_target.evidence_count, r_target.first_seen, r_target.last_seen, r_target.temporal_status, r_target.status, r_target.observed_at, r_target.valid_from, r_target.valid_until
            )
            ON CONFLICT (user_id, source_entity, relation, target_entity)
            DO UPDATE SET
                evidence_count = vanguard_entity_links.evidence_count + EXCLUDED.evidence_count,
                weight = GREATEST(vanguard_entity_links.weight, EXCLUDED.weight),
                last_seen = GREATEST(vanguard_entity_links.last_seen, EXCLUDED.last_seen);
        END LOOP;

        -- USUŃ ŚLADY "LOSERA"
        DELETE FROM public.vanguard_entity_links WHERE user_id = r.user_id AND (source_entity = r.loser OR target_entity = r.loser);
    END LOOP;

    -- 2. TEMPORAL STATUS TRANSITIONS
    
    -- a. Mark 'current' facts older than 30 days that have provenance (source_episode_id) as 'historical'
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'historical'
    WHERE temporal_status = 'current'
      AND status = 'active'
      AND source_episode_id IS NOT NULL
      AND (
        last_seen < CURRENT_DATE - 30 
        OR coalesce(valid_from, created_at, now()) < now() - interval '30 days'
      );

    -- b. Mark 'unknown' links older than 60 days as 'stale'
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'stale'
    WHERE temporal_status = 'unknown'
      AND (
        last_seen < CURRENT_DATE - 60 
        OR coalesce(valid_from, created_at, now()) < now() - interval '60 days'
      );

    -- c. Sync deprecated status to historical (if not already historical/stale)
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'historical'
    WHERE status = 'deprecated'
      AND temporal_status NOT IN ('historical', 'stale');

    -- d. Ensure active hypothesis memory types are marked as hypothesis
    UPDATE public.vanguard_entity_links
    SET temporal_status = 'hypothesis'
    WHERE memory_type = 'hypothesis'
      AND status = 'active'
      AND temporal_status != 'hypothesis';
END;
$$;

ALTER FUNCTION public.vanguard_graph_cleanup() SET search_path = public, pg_temp;

-- Revoke all to public and grant execute to service_role
REVOKE ALL ON FUNCTION public.vanguard_graph_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vanguard_graph_cleanup() TO service_role;

-- Safely schedule Sunday 05:00 Warsaw cleanup cron
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule if exists to prevent duplicates
        PERFORM cron.unschedule('vanguard-sunday-cleanup');
        PERFORM cron.schedule('vanguard-sunday-cleanup', '0 5 * * 0', 'SELECT public.vanguard_graph_cleanup()');
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Prevent failures if pg_cron functions fail during migrate run
    NULL;
END $$;
