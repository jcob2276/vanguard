CREATE OR REPLACE FUNCTION public.vanguard_graph_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    r RECORD;
    r_source RECORD;
    r_target RECORD;
    v_loser_uuid uuid;
    v_winner_uuid uuid;
BEGIN
    -- 1. Entity Resolution loop
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
        -- Get or create entity IDs to map the merge
        v_loser_uuid := public.resolve_entity(r.user_id, r.loser, 'concept');
        v_winner_uuid := public.resolve_entity(r.user_id, r.winner, 'concept');

        IF v_loser_uuid IS NOT NULL AND v_winner_uuid IS NOT NULL AND v_loser_uuid <> v_winner_uuid THEN
            -- Map the soft-merge in public.entities
            UPDATE public.entities
            SET merged_into = v_winner_uuid
            WHERE id = v_loser_uuid;

            -- Add the loser's name as an alias for the winner
            INSERT INTO public.entity_aliases (entity_id, alias)
            VALUES (v_winner_uuid, r.loser)
            ON CONFLICT DO NOTHING;
        END IF;

        -- FOR EACH ROW OF LOSER AS SOURCE -> upsert as winner
        FOR r_source IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND source_entity = r.loser AND status = 'active') LOOP
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

        -- FOR EACH ROW OF LOSER AS TARGET -> upsert as winner
        FOR r_target IN (SELECT * FROM public.vanguard_entity_links WHERE user_id = r.user_id AND target_entity = r.loser AND status = 'active') LOOP
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

        -- SOFT-DEPRECATE THE LOSER LINKS (trigger will automatically deprecate corresponding claims)
        UPDATE public.vanguard_entity_links
        SET status = 'deprecated',
            valid_until = now()
        WHERE user_id = r.user_id 
          AND status = 'active'
          AND (source_entity = r.loser OR target_entity = r.loser);
    END LOOP;

    -- 2. TEMPORAL STATUS TRANSITIONS
    -- a. Mark 'current' facts older than 30 days that have provenance as 'historical'
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

REVOKE ALL ON FUNCTION public.vanguard_graph_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vanguard_graph_cleanup() TO service_role;
