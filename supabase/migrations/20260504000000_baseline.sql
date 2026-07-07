


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "public";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'polish'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION public.polish (COPY = pg_catalog.simple);
  END IF;
END $$;

ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."endmyopia_eye_enum" AS ENUM (
    'left',
    'right',
    'both'
);


ALTER TYPE "public"."endmyopia_eye_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_recompute_daily_nutrition"("p_user_id" "uuid", "p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.daily_nutrition (user_id, date, calories, protein, carbs, fat, fiber, sugar, insulin_load)
  SELECT
    p_user_id,
    p_date,
    SUM(calories),
    SUM(protein),
    SUM(carbs),
    SUM(fat),
    SUM(fiber),
    SUM(sugar),
    SUM(insulin_load)
  FROM public.daily_food_entries
  WHERE user_id = p_user_id AND date = p_date
  ON CONFLICT (user_id, date) DO UPDATE SET
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    fiber = excluded.fiber,
    sugar = excluded.sugar,
    insulin_load = excluded.insulin_load;
END;
$$;


ALTER FUNCTION "public"."_recompute_daily_nutrition"("p_user_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_food_entry"("p_user_id" "uuid", "p_date" "date", "p_grams" integer, "p_entry" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id uuid;
  v_scale numeric := p_grams::numeric / 100;
  v_group uuid;
BEGIN
  -- Service role (Telegram): auth.uid() IS NULL — allow when JWT is service role
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_date::text, 0));

  v_group := NULLIF(p_entry->>'meal_group_id', '')::uuid;

  INSERT INTO public.daily_food_entries (
    user_id, date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, meal_type, amount, logged_at, meal_group_id, parse_meta
  ) VALUES (
    p_user_id, p_date,
    p_entry->>'name', p_entry->>'brand',
    ROUND((p_entry->>'calories')::numeric * v_scale)::integer,
    ROUND((p_entry->>'protein')::numeric * v_scale, 1),
    ROUND((p_entry->>'carbs')::numeric * v_scale, 1),
    ROUND((p_entry->>'fat')::numeric * v_scale, 1),
    ROUND((p_entry->>'fiber')::numeric * v_scale, 1),
    ROUND((p_entry->>'sugar')::numeric * v_scale, 1),
    p_entry->>'meal_type', p_grams || ' g', now(), v_group,
    p_entry->'parse_meta'
  )
  RETURNING id INTO v_id;

  INSERT INTO public.food_favorites (
    user_id, barcode, name, brand, calories, protein, carbs, fat, fiber, sugar, default_grams, is_pinned
  )
  VALUES (
    p_user_id, p_entry->>'barcode', p_entry->>'name', p_entry->>'brand',
    (p_entry->>'calories')::integer, (p_entry->>'protein')::numeric,
    (p_entry->>'carbs')::numeric, (p_entry->>'fat')::numeric,
    (p_entry->>'fiber')::numeric, (p_entry->>'sugar')::numeric,
    p_grams, false
  )
  ON CONFLICT (user_id, name, (COALESCE(brand, ''))) DO UPDATE SET
    use_count = food_favorites.use_count + 1,
    last_used = now(),
    default_grams = p_grams,
    barcode = COALESCE(excluded.barcode, food_favorites.barcode),
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    fiber = excluded.fiber,
    sugar = excluded.sugar,
    is_pinned = food_favorites.is_pinned;

  PERFORM public._recompute_daily_nutrition(p_user_id, p_date);

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."add_food_entry"("p_user_id" "uuid", "p_date" "date", "p_grams" integer, "p_entry" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cache_food_to_library"("p_user_id" "uuid", "p_name" "text", "p_brand" "text", "p_barcode" "text", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_fiber" numeric, "p_sugar" numeric, "p_default_grams" integer) RETURNS "void"
    LANGUAGE "sql"
    AS $$
  INSERT INTO public.food_library
    (user_id, name, brand, barcode, calories, protein, carbs, fat, fiber, sugar, default_grams, source)
  VALUES
    (p_user_id, p_name, p_brand, p_barcode, p_calories, p_protein, p_carbs, p_fat, p_fiber, p_sugar, p_default_grams, 'logged')
  ON CONFLICT (user_id, name, COALESCE(brand, '')) DO NOTHING;
$$;


ALTER FUNCTION "public"."cache_food_to_library"("p_user_id" "uuid", "p_name" "text", "p_brand" "text", "p_barcode" "text", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_fiber" numeric, "p_sugar" numeric, "p_default_grams" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_vanguard_relation_ontology"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count integer;
BEGIN
  NEW.relation := btrim(NEW.relation);

  IF NEW.relation IS NULL OR NEW.relation = '' THEN
    RAISE EXCEPTION 'Graph relation cannot be empty';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vanguard_relation_ontology
    WHERE relation = NEW.relation
  ) THEN
    SELECT count(*) INTO v_count FROM public.vanguard_relation_ontology;
    RAISE EXCEPTION 'Graph relation "%" is outside vanguard_relation_ontology (% allowed relations)', NEW.relation, v_count;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_vanguard_relation_ontology"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_navy_bf"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_height numeric;
  v_sex    text;
  v_bf     numeric;
  v_diff   numeric;
BEGIN
  -- Wymagane: neck + waist
  IF NEW.neck IS NULL OR NEW.waist IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT height_cm, UPPER(COALESCE(sex, 'M'))
  INTO v_height, v_sex
  FROM nutrition_profile
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_height IS NULL OR v_height <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_sex = 'F' AND NEW.hips IS NOT NULL THEN
    v_diff := NEW.waist + NEW.hips - NEW.neck;
    IF v_diff <= 0 THEN RETURN NEW; END IF;
    v_bf := 495.0 / (1.29579 - 0.35004 * LOG(v_diff) + 0.22100 * LOG(v_height)) - 450.0;
  ELSE
    v_diff := NEW.waist - NEW.neck;
    IF v_diff <= 0 THEN RETURN NEW; END IF;
    v_bf := 495.0 / (1.0324 - 0.19077 * LOG(v_diff) + 0.15456 * LOG(v_height)) - 450.0;
  END IF;

  -- Sanity clamp 3–50%
  v_bf := GREATEST(3.0, LEAST(50.0, ROUND(v_bf::numeric, 1)));
  NEW.body_fat := v_bf;

  -- Sync aktualna estymacja do profilu żywieniowego
  UPDATE nutrition_profile
  SET current_body_fat_est = v_bf,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."compute_navy_bf"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deprecate_superseded_facts"("p_user_id" "uuid", "p_source" "text", "p_relation" "text", "p_new_target" "text", "p_new_confidence" double precision, "p_new_episode_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_deprecated_count int := 0;
BEGIN
  IF p_new_confidence < 0.80 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vanguard_singleton_relations
    WHERE relation = p_relation
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.vanguard_entity_links
  SET
    status          = 'deprecated',
    temporal_status = 'historical', -- superseded fact becomes historical
    valid_until     = now(),
    metadata        = metadata || jsonb_build_object(
                        'deprecated_reason',     'singleton_superseding',
                        'deprecated_at',         now(),
                        'superseded_by_episode', p_new_episode_id,
                        'new_target',            p_new_target
                      )
  WHERE
    user_id          = p_user_id
    AND source_entity = p_source
    AND relation      = p_relation
    AND target_entity != p_new_target
    AND status        = 'active'
    AND memory_type   = 'fact'
    AND valid_until   IS NULL
    AND confidence_score < p_new_confidence - 0.05;

  GET DIAGNOSTICS v_deprecated_count = ROW_COUNT;
  RETURN v_deprecated_count;
END;
$$;


ALTER FUNCTION "public"."deprecate_superseded_facts"("p_user_id" "uuid", "p_source" "text", "p_relation" "text", "p_new_target" "text", "p_new_confidence" double precision, "p_new_episode_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_entity_seeds_by_embedding"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer DEFAULT 6) RETURNS TABLE("entity_name" "text", "best_similarity" double precision)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH entity_similarities AS (
    SELECT
      el.source_entity AS entity,
      1 - (el.embedding <=> query_embedding) AS similarity
    FROM public.vanguard_entity_links el
    WHERE el.user_id = match_user_id
      AND el.embedding IS NOT NULL
      AND el.status = 'active'
      AND (el.valid_until IS NULL OR el.valid_until > now())
    
    UNION ALL
    
    SELECT
      el.target_entity AS entity,
      1 - (el.embedding <=> query_embedding) AS similarity
    FROM public.vanguard_entity_links el
    WHERE el.user_id = match_user_id
      AND el.embedding IS NOT NULL
      AND el.status = 'active'
      AND (el.valid_until IS NULL OR el.valid_until > now())
  )
  SELECT
    entity AS entity_name,
    MAX(similarity)::float AS best_similarity
  FROM entity_similarities
  GROUP BY entity
  ORDER BY best_similarity DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."find_entity_seeds_by_embedding"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_mentioned_entities"("query_text" "text", "user_id_param" "uuid") RETURNS TABLE("entity_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_query text := lower(coalesce(query_text, ''));
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT source_entity AS name FROM public.vanguard_entity_links WHERE user_id = user_id_param
    UNION
    SELECT target_entity AS name FROM public.vanguard_entity_links WHERE user_id = user_id_param
    UNION
    SELECT alias AS name FROM public.vanguard_entity_aliases WHERE user_id = user_id_param
  ),
  matched AS (
    SELECT DISTINCT public.canonicalize_vanguard_entity(user_id_param, c.name) AS canonical_name
    FROM candidates c
    WHERE v_query ILIKE '%' || lower(c.name) || '%'
       OR similarity(v_query, lower(c.name)) > 0.35
  )
  SELECT canonical_name
  FROM matched
  WHERE canonical_name IS NOT NULL AND canonical_name <> '';
END;
$$;


ALTER FUNCTION "public"."find_mentioned_entities"("query_text" "text", "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brain_health_report"("user_id_param" "uuid") RETURNS TABLE("table_name" "text", "total_records" bigint, "embedded_records" bigint, "coverage_percent" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.name as table_name,
    t.total as total_records,
    t.embedded as embedded_records,
    CASE WHEN t.total > 0 THEN ROUND((t.embedded::numeric / t.total::numeric) * 100, 2) ELSE 0 END as coverage_percent
  FROM (
    SELECT 'vanguard_stream' as name,
      COUNT(*)::bigint as total,
      COUNT(embedding)::bigint as embedded
    FROM vanguard_stream WHERE user_id = user_id_param

    UNION ALL

    SELECT 'vanguard_knowledge' as name,
      COUNT(*)::bigint as total,
      COUNT(embedding)::bigint as embedded
    FROM vanguard_knowledge WHERE user_id = user_id_param

    UNION ALL

    SELECT 'vanguard_entity_links' as name,
      COUNT(*)::bigint as total,
      COUNT(embedding)::bigint as embedded
    FROM vanguard_entity_links WHERE user_id = user_id_param

    UNION ALL

    SELECT 'daily_wins' as name,
      COUNT(*)::bigint as total,
      COUNT(embedding)::bigint as embedded
    FROM daily_wins WHERE user_id = user_id_param

    UNION ALL

    SELECT 'vanguard_identity' as name,
      COUNT(*)::bigint as total,
      0::bigint as embedded
    FROM vanguard_identity WHERE user_id = user_id_param
  ) t;
END;
$$;


ALTER FUNCTION "public"."get_brain_health_report"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_desktop_dashboard_data"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_today date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to read dashboard data for this user'
      USING ERRCODE = '42501';
  END IF;

  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::date;

  SELECT jsonb_build_object(
    'oura', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, hrv_avg, rhr_avg, total_sleep_hours, readiness_score, sleep_score
        FROM public.oura_daily_summary
        WHERE user_id = p_user_id AND date >= (v_today - 60)
        ORDER BY date ASC
      ) sub
    ),
    'nutrition', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, calories, protein
        FROM public.daily_nutrition
        WHERE user_id = p_user_id AND date >= (v_today - 14)
        ORDER BY date ASC
      ) sub
    ),
    'sessions', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT ws.id, ws.date, ws.workout_day, ws.session_rpe,
          (
            SELECT COALESCE(jsonb_agg(el), '[]'::jsonb)
            FROM (
              SELECT exercise_name, weight, reps, muscle_tags, is_pws_or_msp, rir, rpe
              FROM public.exercise_logs
              WHERE session_id = ws.id
            ) el
          ) AS exercise_logs
        FROM public.workout_sessions ws
        WHERE ws.user_id = p_user_id AND ws.date::date >= (v_today - 91)
        ORDER BY ws.date ASC
      ) sub
    ),
    'body', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, weight, waist, neck, hips, body_fat
        FROM public.body_metrics
        WHERE user_id = p_user_id AND date >= (v_today - 90)
        ORDER BY date ASC
      ) sub
    ),
    'strain', (
      SELECT row_to_json(sub)::jsonb
      FROM (
        SELECT daily_status, main_limiter, strain_score, recovery_score, fueling_score, fueling_provisional
        FROM public.daily_strain
        WHERE user_id = p_user_id
        ORDER BY date DESC
        LIMIT 1
      ) sub
    ),
    'strava', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT sport_type, distance, moving_time, start_date, best_efforts
        FROM public.strava_activities_clean
        WHERE user_id = p_user_id
          AND start_date >= ((v_today - 84)::timestamp AT TIME ZONE 'Europe/Warsaw')
        ORDER BY start_date ASC
      ) sub
    ),
    'projects', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, name, status, goal, color, deadline
        FROM public.projects
        WHERE user_id = p_user_id AND status IN ('active', 'paused')
        ORDER BY created_at DESC
      ) sub
    ),
    'moves', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT
          id,
          title,
          CASE
            WHEN status = 'open' THEN 'todo'
            WHEN status = 'done' THEN 'done'
            ELSE status
          END AS status,
          completed_at,
          due_date AS planned_for,
          project_id
        FROM public.todo_items
        WHERE user_id = p_user_id
          AND status <> 'dropped'
          AND COALESCE(is_milestone, false) = false
        ORDER BY updated_at DESC
        LIMIT 80
      ) sub
    ),
    'goals', (
      SELECT row_to_json(sub)::jsonb
      FROM (
        SELECT goal_cialo, goal_duch, goal_konto, date_cialo, date_duch, date_konto
        FROM public.life_goals
        WHERE user_id = p_user_id
        LIMIT 1
      ) sub
    ),
    'sprintGoals', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, personal_year, sprint_number, goal_text
        FROM public.sprint_goals
        WHERE user_id = p_user_id
        ORDER BY personal_year ASC, sprint_number ASC
      ) sub
    ),
    'stream', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, source, content, classification, category, tags, importance_score, timestamp
        FROM public.vanguard_stream
        WHERE user_id = p_user_id
          AND (source IS NULL OR source <> 'eval_interview')
          AND COALESCE(importance_score, 0) >= 5
          AND timestamp >= ((v_today - 14)::timestamp AT TIME ZONE 'Europe/Warsaw')
        ORDER BY importance_score DESC, timestamp DESC
        LIMIT 14
      ) sub
    ),
    'patterns', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, title, evidence_text, pattern_type, occurrence_count, confidence, last_seen, status
        FROM public.vanguard_behavioral_patterns
        WHERE user_id = p_user_id AND status = 'active'
        ORDER BY occurrence_count DESC
        LIMIT 10
      ) sub
    ),
    'wins', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT date, mood_score, daily_rpe, journal_entry, tags
        FROM public.daily_wins
        WHERE user_id = p_user_id AND date >= (v_today - 14)
        ORDER BY date ASC
      ) sub
    ),
    'wiki', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, title, page_type, summary, confidence, updated_at
        FROM public.vanguard_wiki_pages
        WHERE user_id = p_user_id AND status = 'active' AND summary IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 6
      ) sub
    ),
    'knowledge', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT id, title, content, category, importance_score, tags
        FROM public.vanguard_knowledge
        WHERE user_id = p_user_id AND is_verified = true AND COALESCE(importance_score, 0) >= 7
        ORDER BY importance_score DESC
        LIMIT 6
      ) sub
    ),
    'lenieLogs', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT hl.date, hl.logged_at, hl.final_stimulus, hl.context_note,
          jsonb_build_object('name', h.name, 'is_positive', h.is_positive) AS habits
        FROM public.habit_logs hl
        JOIN public.habits h ON hl.habit_id = h.id
        WHERE hl.user_id = p_user_id
          AND h.is_positive = false
          AND h.name ILIKE '%lenie%'
        ORDER BY hl.date DESC
        LIMIT 10
      ) sub
    ),
    'habits', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT *
        FROM public.habits
        WHERE user_id = p_user_id
        ORDER BY created_at ASC
      ) sub
    ),
    'habitLogs', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT *
        FROM public.habit_logs
        WHERE user_id = p_user_id AND date::date >= (v_today - 30)
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_desktop_dashboard_data"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vanguard_graph_context"("start_entities" "text"[], "max_depth" integer DEFAULT 2, "user_id_param" "uuid" DEFAULT NULL::"uuid", "p_layer" "text" DEFAULT NULL::"text", "p_include_historical" boolean DEFAULT false, "p_as_of" timestamp with time zone DEFAULT "now"(), "p_min_confidence" double precision DEFAULT 0.0) RETURNS TABLE("source_entity" "text", "relation" "text", "target_entity" "text", "depth" integer, "path" "text"[], "evidence_count" integer, "confidence_score" double precision, "status" "text", "layer" "text", "fact_text" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE seeds AS (
    SELECT DISTINCT public.canonicalize_vanguard_entity(user_id_param, unnest(start_entities)) AS entity
  ),
  graph_path AS (
    SELECT
      l.source_entity, l.relation, l.target_entity,
      1 AS depth,
      ARRAY[l.source_entity, l.target_entity] AS path,
      l.evidence_count, l.confidence_score, l.status, l.layer, l.fact_text
    FROM public.vanguard_entity_links l
    WHERE l.user_id = user_id_param
      AND (l.source_entity IN (SELECT entity FROM seeds) OR l.target_entity IN (SELECT entity FROM seeds))
      AND l.evidence_count >= 1
      AND coalesce(l.confidence_score, 0.0) >= p_min_confidence
      AND (p_layer IS NULL OR l.layer = p_layer)
      AND (
        p_include_historical OR (
          l.status = 'active'
          AND l.temporal_status IN ('current', 'declared')
          AND coalesce(l.valid_from, l.created_at, now()) <= p_as_of
          AND (l.valid_until IS NULL OR l.valid_until > p_as_of)
        )
      )
    UNION ALL
    SELECT
      l.source_entity, l.relation, l.target_entity,
      gp.depth + 1,
      gp.path || l.target_entity,
      l.evidence_count, l.confidence_score, l.status, l.layer, l.fact_text
    FROM public.vanguard_entity_links l
    JOIN graph_path gp ON (l.source_entity = gp.target_entity OR l.target_entity = gp.source_entity)
    WHERE l.user_id = user_id_param
      AND gp.depth < max_depth
      AND l.evidence_count >= 1
      AND coalesce(l.confidence_score, 0.0) >= p_min_confidence
      AND (p_layer IS NULL OR l.layer = p_layer)
      AND NOT (l.target_entity = ANY(gp.path))
      AND (
        p_include_historical OR (
          l.status = 'active'
          AND l.temporal_status IN ('current', 'declared')
          AND coalesce(l.valid_from, l.created_at, now()) <= p_as_of
          AND (l.valid_until IS NULL OR l.valid_until > p_as_of)
        )
      )
  ),
  deduped AS (
    SELECT DISTINCT ON (gp.source_entity, gp.relation, gp.target_entity)
      gp.source_entity, gp.relation, gp.target_entity,
      gp.depth, gp.path, gp.evidence_count, gp.confidence_score, gp.status, gp.layer, gp.fact_text
    FROM graph_path gp
    ORDER BY gp.source_entity, gp.relation, gp.target_entity, gp.depth ASC, gp.evidence_count DESC
  )
  SELECT
    d.source_entity, d.relation, d.target_entity,
    d.depth, d.path, d.evidence_count, d.confidence_score, d.status, d.layer, d.fact_text
  FROM deduped d
  ORDER BY
    CASE WHEN d.source_entity IN (SELECT entity FROM seeds) OR d.target_entity IN (SELECT entity FROM seeds) THEN 0 ELSE 1 END,
    d.depth ASC, d.evidence_count DESC, coalesce(d.confidence_score, 0.0) DESC,
    d.source_entity, d.relation, d.target_entity;
END;
$$;


ALTER FUNCTION "public"."get_vanguard_graph_context"("start_entities" "text"[], "max_depth" integer, "user_id_param" "uuid", "p_layer" "text", "p_include_historical" boolean, "p_as_of" timestamp with time zone, "p_min_confidence" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_kpi_entry_for_week"("p_kpi_id" "uuid", "p_week_start" "date", "p_delta" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.kpi_entries (user_id, kpi_id, week_start, value)
  values (auth.uid(), p_kpi_id, p_week_start, p_delta)
  on conflict (kpi_id, week_start)
  do update set value = coalesce(kpi_entries.value, 0) + excluded.value;
end;
$$;


ALTER FUNCTION "public"."increment_kpi_entry_for_week"("p_kpi_id" "uuid", "p_week_start" "date", "p_delta" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_vanguard_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_id_param" "uuid", "max_age_days" integer DEFAULT 90) RETURNS TABLE("id" "uuid", "table_name" "text", "content" "text", "source_date" "date", "similarity" double precision, "importance_score" integer, "hybrid_score" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH all_content AS (
        -- 1. FUNDAMENT (no age filter — identity is permanent)
        SELECT
            uf.user_id as r_id,
            'user_fundament'::text as r_table,
            COALESCE(uf.identity,'') || ' ' || COALESCE(uf.philosophy,'') || ' ' || COALESCE(uf.vision,'') as r_content,
            uf.updated_at::date as r_date,
            10 as r_importance,
            (uf.embedding <=> query_embedding) as r_dist,
            0.4 as r_priority_boost
        FROM user_fundament uf
        WHERE uf.user_id = user_id_param
          AND uf.embedding IS NOT NULL
          AND btrim(COALESCE(uf.identity,'') || COALESCE(uf.philosophy,'')) != ''

        UNION ALL

        -- 2. WIEDZA (hard cutoff at max_age_days)
        SELECT
            vk.id,
            'vanguard_knowledge'::text,
            vk.content,
            vk.created_at::date,
            vk.importance_score,
            (vk.embedding <=> query_embedding),
            CASE WHEN vk.is_verified THEN 0.8 ELSE 0.4 END
        FROM vanguard_knowledge vk
        WHERE vk.user_id = user_id_param
          AND vk.embedding IS NOT NULL
          AND btrim(vk.content) != ''
          AND vk.created_at >= (NOW() - (max_age_days || ' days')::interval)

        UNION ALL

        -- 3. STRUMIEŃ (hard cutoff at max_age_days)
        SELECT
            vs.id,
            'vanguard_stream'::text,
            vs.content,
            vs.created_at::date,
            COALESCE(vs.importance_score, 6),
            (vs.embedding <=> query_embedding),
            0.7
        FROM vanguard_stream vs
        WHERE vs.user_id = user_id_param
          AND vs.embedding IS NOT NULL
          AND btrim(vs.content) != ''
          AND (vs.valid_until IS NULL OR vs.valid_until > now())
          AND vs.created_at >= (NOW() - (max_age_days || ' days')::interval)

        UNION ALL

        -- 4. DZIENNIK (no age filter — journal is archival by nature)
        SELECT
            dw.id,
            'daily_wins'::text,
            COALESCE(dw.journal_entry,'') || ' ' || COALESCE(dw.gratitude_entry,''),
            dw.date,
            5,
            (dw.embedding <=> query_embedding),
            0.5
        FROM daily_wins dw
        WHERE dw.user_id = user_id_param
          AND dw.embedding IS NOT NULL
          AND btrim(COALESCE(dw.journal_entry,'') || COALESCE(dw.gratitude_entry,'')) != ''
    ),
    scored AS (
        SELECT
            ac.*,
            (1 - ac.r_dist) as r_similarity,
            EXP(- (EXTRACT(EPOCH FROM (now() - (ac.r_date::timestamp))) / (86400.0 * 30.0))) as r_recency
        FROM all_content ac
        WHERE (1 - ac.r_dist) > match_threshold
    )
    SELECT
        s.r_id,
        s.r_table,
        s.r_content,
        s.r_date,
        s.r_similarity,
        s.r_importance,
        (
            (s.r_similarity * 0.4) +
            (s.r_priority_boost * 0.4) +
            (s.r_recency * 0.1) +
            ((s.r_importance / 10.0) * 0.1)
        )::float as r_hybrid_score
    FROM scored s
    ORDER BY r_hybrid_score DESC
    LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_vanguard_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_id_param" "uuid", "max_age_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_date date;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT date INTO v_date FROM public.daily_food_entries WHERE id = p_entry_id AND user_id = p_user_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_date::text, 0));

  DELETE FROM public.daily_food_entries WHERE id = p_entry_id AND user_id = p_user_id;

  PERFORM public._recompute_daily_nutrition(p_user_id, v_date);
END;
$$;


ALTER FUNCTION "public"."remove_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."repeat_food_entry"("p_user_id" "uuid", "p_source_entry_id" "uuid", "p_date" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_date::text, 0));

  INSERT INTO public.daily_food_entries (
    user_id, date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, saturated_fat, salt, insulin_load, meal_type, amount, logged_at
  )
  SELECT
    p_user_id, p_date, name, brand, calories, protein, carbs, fat,
    fiber, sugar, saturated_fat, salt, insulin_load, meal_type, amount, now()
  FROM public.daily_food_entries
  WHERE id = p_source_entry_id AND user_id = p_user_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  PERFORM public._recompute_daily_nutrition(p_user_id, p_date);

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."repeat_food_entry"("p_user_id" "uuid", "p_source_entry_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_calendar_window"("p_user_id" "uuid", "p_category" "text", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_events" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_incoming_ids   text[];
  v_incoming_bases text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_category, 0));

  -- Collect all incoming event_ids and their base IDs (part before first '_' in
  -- recurring-instance IDs like "abc123_20260706T080000Z").
  SELECT
    array_agg(e->>'event_id'),
    array_agg(split_part(e->>'event_id', '_', 1))
  INTO v_incoming_ids, v_incoming_bases
  FROM jsonb_array_elements(p_events) AS e;

  -- 1. Delete events in the window that belong to the sync category (google_sync)
  DELETE FROM public.vanguard_calendar
  WHERE user_id = p_user_id
    AND category = p_category
    AND start_time >= p_start
    AND start_time <= p_end;

  -- 2. Delete stale rows: have a Google event_id, are in the time window, but are
  --    neither an exact match nor the base of any incoming recurring instance.
  DELETE FROM public.vanguard_calendar
  WHERE user_id = p_user_id
    AND start_time >= p_start
    AND start_time <= p_end
    AND event_id IS NOT NULL
    AND event_id <> ALL(COALESCE(v_incoming_ids,  ARRAY[]::text[]))
    AND event_id <> ALL(COALESCE(v_incoming_bases, ARRAY[]::text[]));

  -- 3. Upsert the current set of events, preserving user-changed categories.
  --    For new recurring instances, inherit the category from the base-ID row
  --    (the original one-time event that was converted to a series).
  INSERT INTO public.vanguard_calendar (user_id, event_id, summary, start_time, end_time, category)
  SELECT
    p_user_id,
    e->>'event_id',
    e->>'summary',
    (e->>'start_time')::timestamptz,
    (e->>'end_time')::timestamptz,
    COALESCE(
      -- 1st: keep the category already on this exact row (if user changed it)
      (SELECT vc.category
       FROM public.vanguard_calendar vc
       WHERE vc.user_id = p_user_id
         AND vc.event_id = e->>'event_id'
         AND vc.category <> 'google_sync'
       LIMIT 1),
      -- 2nd: inherit from base-ID row (covers newly-created recurring instances)
      (SELECT vc.category
       FROM public.vanguard_calendar vc
       WHERE vc.user_id = p_user_id
         AND vc.event_id = split_part(e->>'event_id', '_', 1)
         AND vc.category <> 'google_sync'
       LIMIT 1),
      -- fallback: default sync category
      p_category
    )
  FROM jsonb_array_elements(p_events) AS e
  ON CONFLICT (event_id) DO UPDATE SET
    summary    = excluded.summary,
    start_time = excluded.start_time,
    end_time   = excluded.end_time,
    category   = COALESCE(
      NULLIF(vanguard_calendar.category, 'google_sync'),
      excluded.category
    );
END;
$$;


ALTER FUNCTION "public"."replace_calendar_window"("p_user_id" "uuid", "p_category" "text", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_events" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_food_correction"("p_user_id" "uuid", "p_query_name" "text", "p_corrected_grams" integer, "p_corrected_name" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_query_name IS NULL OR trim(p_query_name) = '' OR p_corrected_grams IS NULL OR p_corrected_grams < 1 THEN
    RAISE EXCEPTION 'invalid correction';
  END IF;

  INSERT INTO public.food_corrections (user_id, query_name, corrected_name, corrected_grams)
  VALUES (p_user_id, lower(trim(p_query_name)), NULLIF(trim(p_corrected_name), ''), p_corrected_grams)
  ON CONFLICT (user_id, query_name) DO UPDATE SET
    corrected_name = COALESCE(excluded.corrected_name, food_corrections.corrected_name),
    corrected_grams = excluded.corrected_grams,
    use_count = food_corrections.use_count + 1,
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."save_food_correction"("p_user_id" "uuid", "p_query_name" "text", "p_corrected_grams" integer, "p_corrected_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_workout_atomic"("p_user_id" "uuid", "p_day_key" character varying, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_notes" "text", "p_msp_passed" boolean, "p_logs" "jsonb", "p_session_rpe" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session_id uuid;
  v_log        jsonb;
  v_set_count  integer;
  v_avg_rir    decimal;
  v_importance integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to save workout for this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workout_sessions (
    user_id, workout_day, date,
    start_time, end_time, duration_minutes,
    session_notes, msp_passed, session_rpe
  )
  VALUES (
    p_user_id,
    p_day_key,
    COALESCE((p_start_time AT TIME ZONE 'Europe/Warsaw')::date, (now() AT TIME ZONE 'Europe/Warsaw')::date),
    p_start_time,
    p_end_time,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60))::integer,
    p_notes,
    COALESCE(p_msp_passed, false),
    p_session_rpe
  )
  RETURNING id INTO v_session_id;

  FOR v_log IN SELECT * FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb))
  LOOP
    INSERT INTO public.exercise_logs (
      session_id, user_id, exercise_name, set_number,
      reps, weight, rpe, rir, is_pws_or_msp, muscle_tags
    )
    VALUES (
      v_session_id,
      p_user_id,
      v_log->>'exercise_name',
      (v_log->>'set_number')::integer,
      (v_log->>'reps')::integer,
      NULLIF(v_log->>'weight', '')::decimal,
      NULLIF(v_log->>'rpe', '')::decimal,
      NULLIF(v_log->>'rir', '')::decimal,
      COALESCE((v_log->>'is_pws_or_msp')::boolean, false),
      CASE
        WHEN jsonb_typeof(v_log->'muscle_tags') = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(v_log->'muscle_tags'))
        ELSE '{}'::text[]
      END
    );
  END LOOP;

  SELECT COUNT(*), AVG(NULLIF(el->>'rir', '')::decimal)
  INTO v_set_count, v_avg_rir
  FROM jsonb_array_elements(COALESCE(p_logs, '[]'::jsonb)) el;

  v_importance := 5;
  IF v_set_count >= 15 THEN v_importance := v_importance + 1;
  ELSIF v_set_count <= 4 THEN v_importance := v_importance - 1;
  END IF;
  IF COALESCE(p_msp_passed, false) THEN v_importance := v_importance + 1; END IF;
  IF v_avg_rir IS NOT NULL THEN
    IF v_avg_rir < 1 THEN v_importance := v_importance + 1;
    ELSIF v_avg_rir > 3 THEN v_importance := v_importance - 1;
    END IF;
  END IF;
  IF p_session_rpe IS NOT NULL THEN
    IF p_session_rpe >= 9 THEN v_importance := v_importance + 1;
    ELSIF p_session_rpe <= 4 THEN v_importance := v_importance - 1;
    END IF;
  END IF;
  v_importance := GREATEST(1, LEAST(10, v_importance));

  UPDATE public.workout_sessions SET importance_score = v_importance WHERE id = v_session_id;

  RETURN v_session_id;
END;
$$;


ALTER FUNCTION "public"."save_workout_atomic"("p_user_id" "uuid", "p_day_key" character varying, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_notes" "text", "p_msp_passed" boolean, "p_logs" "jsonb", "p_session_rpe" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_entity_links"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer DEFAULT 15) RETURNS TABLE("source_entity" "text", "relation" "text", "target_entity" "text", "source_type" "text", "target_type" "text", "evidence_count" integer, "similarity" double precision, "confidence_score" double precision, "fact_text" "text", "memory_type" "text")
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    el.source_entity,
    el.relation,
    el.target_entity,
    el.source_type,
    el.target_type,
    el.evidence_count,
    1 - (el.embedding <=> query_embedding) AS similarity,
    el.confidence_score,
    el.fact_text,
    el.memory_type
  FROM public.vanguard_entity_links el
  WHERE el.user_id = match_user_id
    AND el.embedding IS NOT NULL
    AND el.status = 'active'
    AND el.temporal_status IN ('current', 'declared')
    AND (el.valid_until IS NULL OR el.valid_until > now())
  ORDER BY el.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."search_entity_links"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_entity_links_fulltext"("query_text" "text", "match_user_id" "uuid", "match_count" integer DEFAULT 15) RETURNS TABLE("source_entity" "text", "relation" "text", "target_entity" "text", "source_type" "text", "target_type" "text", "fact_text" "text", "evidence_count" integer, "rank" real)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    el.source_entity,
    el.relation,
    el.target_entity,
    el.source_type,
    el.target_type,
    el.fact_text,
    el.evidence_count,
    ts_rank(to_tsvector('simple', COALESCE(el.fact_text, '')),
            plainto_tsquery('simple', query_text)) AS rank
  FROM vanguard_entity_links el
  WHERE el.user_id = match_user_id
    AND el.status = 'active'
    AND el.temporal_status IN ('current', 'declared')
    AND (el.valid_until IS NULL OR el.valid_until > now())
    AND to_tsvector('simple', COALESCE(el.fact_text, '')) @@ plainto_tsquery('simple', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."search_entity_links_fulltext"("query_text" "text", "match_user_id" "uuid", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sprint_info_for_date"("d" "date") RETURNS TABLE("personal_year" integer, "sprint_number" integer, "week_in_sprint" integer)
    LANGUAGE "sql" IMMUTABLE
    AS $$
  with anchor_calc as (
    select case
      when d >= make_date(extract(year from d)::int, 3, 1)
        then make_date(extract(year from d)::int, 3, 1)
      else make_date(extract(year from d)::int - 1, 3, 1)
    end as anchor
  ),
  days_calc as (
    select anchor, (d - anchor) as days_since from anchor_calc
  ),
  weeks_calc as (
    select anchor, days_since, (days_since / 7) as weeks_since from days_calc
  )
  select
    extract(year from anchor)::int as personal_year,
    (weeks_since / 12) + 1 as sprint_number,
    (weeks_since % 12) + 1 as week_in_sprint
  from weeks_calc;
$$;


ALTER FUNCTION "public"."sprint_info_for_date"("d" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_daily_win_tasks_to_daily_wins"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_day_win_id UUID;
    r_task RECORD;
    i INTEGER := 1;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        v_day_win_id := OLD.day_win_id;
    ELSE
        v_day_win_id := NEW.day_win_id;
    END IF;

    -- Reset all task fields in daily_wins
    UPDATE public.daily_wins
    SET
        task_1 = NULL, done_1 = NULL, category_1 = NULL, completed_at_1 = NULL, task_1_todo_id = NULL, task_1_checkpoint_id = NULL, task_1_pin_id = NULL, task_1_project_id = NULL, task_1_target_value = NULL, task_1_time_slot = NULL,
        task_2 = NULL, done_2 = NULL, category_2 = NULL, completed_at_2 = NULL, task_2_todo_id = NULL, task_2_checkpoint_id = NULL, task_2_pin_id = NULL, task_2_project_id = NULL, task_2_target_value = NULL, task_2_time_slot = NULL,
        task_3 = NULL, done_3 = NULL, category_3 = NULL, completed_at_3 = NULL, task_3_todo_id = NULL, task_3_checkpoint_id = NULL, task_3_pin_id = NULL, task_3_project_id = NULL, task_3_target_value = NULL, task_3_time_slot = NULL,
        task_4 = NULL, done_4 = NULL, category_4 = NULL, completed_at_4 = NULL, task_4_todo_id = NULL, task_4_checkpoint_id = NULL, task_4_pin_id = NULL, task_4_project_id = NULL, task_4_target_value = NULL, task_4_time_slot = NULL,
        task_5 = NULL, done_5 = NULL, category_5 = NULL, completed_at_5 = NULL, task_5_todo_id = NULL, task_5_checkpoint_id = NULL, task_5_pin_id = NULL, task_5_project_id = NULL, task_5_target_value = NULL, task_5_time_slot = NULL
    WHERE id = v_day_win_id;

    -- Refill task fields in daily_wins with current active tasks
    FOR r_task IN (
        SELECT * FROM public.daily_win_tasks
        WHERE day_win_id = v_day_win_id
        ORDER BY slot ASC, created_at ASC
        LIMIT 5
    ) LOOP
        IF i = 1 THEN
            UPDATE public.daily_wins SET
                task_1 = r_task.title, done_1 = r_task.done, category_1 = r_task.category, completed_at_1 = r_task.completed_at,
                task_1_todo_id = r_task.todo_id, task_1_checkpoint_id = r_task.checkpoint_id, task_1_pin_id = r_task.pin_id,
                task_1_project_id = r_task.project_id, task_1_target_value = r_task.target_value, task_1_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 2 THEN
            UPDATE public.daily_wins SET
                task_2 = r_task.title, done_2 = r_task.done, category_2 = r_task.category, completed_at_2 = r_task.completed_at,
                task_2_todo_id = r_task.todo_id, task_2_checkpoint_id = r_task.checkpoint_id, task_2_pin_id = r_task.pin_id,
                task_2_project_id = r_task.project_id, task_2_target_value = r_task.target_value, task_2_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 3 THEN
            UPDATE public.daily_wins SET
                task_3 = r_task.title, done_3 = r_task.done, category_3 = r_task.category, completed_at_3 = r_task.completed_at,
                task_3_todo_id = r_task.todo_id, task_3_checkpoint_id = r_task.checkpoint_id, task_3_pin_id = r_task.pin_id,
                task_3_project_id = r_task.project_id, task_3_target_value = r_task.target_value, task_3_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 4 THEN
            UPDATE public.daily_wins SET
                task_4 = r_task.title, done_4 = r_task.done, category_4 = r_task.category, completed_at_4 = r_task.completed_at,
                task_4_todo_id = r_task.todo_id, task_4_checkpoint_id = r_task.checkpoint_id, task_4_pin_id = r_task.pin_id,
                task_4_project_id = r_task.project_id, task_4_target_value = r_task.target_value, task_4_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        ELSIF i = 5 THEN
            UPDATE public.daily_wins SET
                task_5 = r_task.title, done_5 = r_task.done, category_5 = r_task.category, completed_at_5 = r_task.completed_at,
                task_5_todo_id = r_task.todo_id, task_5_checkpoint_id = r_task.checkpoint_id, task_5_pin_id = r_task.pin_id,
                task_5_project_id = r_task.project_id, task_5_target_value = r_task.target_value, task_5_time_slot = r_task.time_slot
            WHERE id = v_day_win_id;
        END IF;
        i := i + 1;
    END LOOP;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_daily_win_tasks_to_daily_wins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_daily_wins_to_daily_win_tasks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    v_user_id := COALESCE(NEW.user_id, auth.uid());
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;

    IF v_user_id IS NOT NULL THEN
        -- Clear previous entries to prevent duplicate conflicts
        DELETE FROM public.daily_win_tasks WHERE day_win_id = NEW.id;

        -- Slot 1
        IF NEW.task_1 IS NOT NULL AND NEW.task_1 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 1, v_user_id, NEW.task_1, COALESCE(NEW.done_1, false), NEW.category_1, NEW.completed_at_1::timestamptz, NEW.task_1_todo_id, NEW.task_1_checkpoint_id, NEW.task_1_pin_id, NEW.task_1_project_id, NEW.task_1_target_value, NEW.task_1_time_slot);
        END IF;
        -- Slot 2
        IF NEW.task_2 IS NOT NULL AND NEW.task_2 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 2, v_user_id, NEW.task_2, COALESCE(NEW.done_2, false), NEW.category_2, NEW.completed_at_2::timestamptz, NEW.task_2_todo_id, NEW.task_2_checkpoint_id, NEW.task_2_pin_id, NEW.task_2_project_id, NEW.task_2_target_value, NEW.task_2_time_slot);
        END IF;
        -- Slot 3
        IF NEW.task_3 IS NOT NULL AND NEW.task_3 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 3, v_user_id, NEW.task_3, COALESCE(NEW.done_3, false), NEW.category_3, NEW.completed_at_3::timestamptz, NEW.task_3_todo_id, NEW.task_3_checkpoint_id, NEW.task_3_pin_id, NEW.task_3_project_id, NEW.task_3_target_value, NEW.task_3_time_slot);
        END IF;
        -- Slot 4
        IF NEW.task_4 IS NOT NULL AND NEW.task_4 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 4, v_user_id, NEW.task_4, COALESCE(NEW.done_4, false), NEW.category_4, NEW.completed_at_4::timestamptz, NEW.task_4_todo_id, NEW.task_4_checkpoint_id, NEW.task_4_pin_id, NEW.task_4_project_id, NEW.task_4_target_value, NEW.task_4_time_slot);
        END IF;
        -- Slot 5
        IF NEW.task_5 IS NOT NULL AND NEW.task_5 <> '' THEN
            INSERT INTO public.daily_win_tasks (day_win_id, slot, user_id, title, done, category, completed_at, todo_id, checkpoint_id, pin_id, project_id, target_value, time_slot)
            VALUES (NEW.id, 5, v_user_id, NEW.task_5, COALESCE(NEW.done_5, false), NEW.category_5, NEW.completed_at_5::timestamptz, NEW.task_5_todo_id, NEW.task_5_checkpoint_id, NEW.task_5_pin_id, NEW.task_5_project_id, NEW.task_5_target_value, NEW.task_5_time_slot);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_daily_wins_to_daily_win_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_friction_proposals"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."sync_friction_proposals"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_link_read_to_growth_pins"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.status = 'read' AND (OLD.status IS NULL OR OLD.status != 'read') THEN
        UPDATE public.learning_week_pins 
        SET done = true, done_at = COALESCE(NEW.updated_at, now())
        WHERE entity_type = 'link' AND entity_id = NEW.id AND done = false;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_link_read_to_growth_pins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_todo_done_to_growth_pins"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
        UPDATE public.learning_week_pins 
        SET done = true, done_at = COALESCE(NEW.updated_at, now())
        WHERE entity_type = 'todo' AND entity_id = NEW.id AND done = false;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_todo_done_to_growth_pins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_vanguard_classification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-auto-classify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_vanguard_classification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_vanguard_telegram_worker"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-telegram-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_vanguard_telegram_worker"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_plan_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_daily_plan_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_entry" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_date date;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT date INTO v_date FROM public.daily_food_entries WHERE id = p_entry_id AND user_id = p_user_id;
  IF v_date IS NULL THEN
    RAISE EXCEPTION 'entry not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_date::text, 0));

  UPDATE public.daily_food_entries SET
    name = COALESCE(p_entry->>'name', name),
    brand = COALESCE(p_entry->>'brand', brand),
    calories = COALESCE((p_entry->>'calories')::integer, calories),
    protein = COALESCE((p_entry->>'protein')::numeric, protein),
    carbs = COALESCE((p_entry->>'carbs')::numeric, carbs),
    fat = COALESCE((p_entry->>'fat')::numeric, fat),
    fiber = COALESCE((p_entry->>'fiber')::numeric, fiber),
    sugar = COALESCE((p_entry->>'sugar')::numeric, sugar),
    meal_type = COALESCE(p_entry->>'meal_type', meal_type),
    amount = COALESCE(p_entry->>'amount', amount)
  WHERE id = p_entry_id AND user_id = p_user_id;

  PERFORM public._recompute_daily_nutrition(p_user_id, v_date);
END;
$$;


ALTER FUNCTION "public"."update_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_entry" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_vanguard_entity_link"("p_user_id" "uuid", "p_source" "text", "p_source_type" "text" DEFAULT NULL::"text", "p_relation" "text" DEFAULT NULL::"text", "p_target" "text" DEFAULT NULL::"text", "p_target_type" "text" DEFAULT NULL::"text", "p_confidence_score" double precision DEFAULT NULL::double precision, "p_memory_type" "text" DEFAULT NULL::"text", "p_layer" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_source_episode_id" "uuid" DEFAULT NULL::"uuid", "p_observed_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_source      text             := public.canonicalize_vanguard_entity(p_user_id, p_source);
  v_target      text             := public.canonicalize_vanguard_entity(p_user_id, p_target);
  v_relation    text             := btrim(coalesce(p_relation, ''));
  v_source_type text             := coalesce(nullif(btrim(p_source_type), ''), 'unknown');
  v_target_type text             := coalesce(nullif(btrim(p_target_type), ''), 'unknown');
  v_confidence  double precision := greatest(0, least(1, coalesce(p_confidence_score, 0.6)));
  v_memory_type text             := coalesce(nullif(p_memory_type, ''), 'fact');
  v_layer       text             := coalesce(nullif(p_layer, ''), 'intelligence');
  v_obs_at      timestamptz      := coalesce(p_observed_at, now());
  v_is_singleton boolean;
  v_new_id      uuid             := gen_random_uuid();
  v_link_id     uuid;
  v_temp_status text;
BEGIN
  -- Walidacja
  IF v_source = '' OR v_target = '' OR v_relation = '' OR v_source = v_target THEN
    RETURN;
  END IF;

  -- Normalizacja typów dla Jakuba
  IF v_source = 'Jakub' THEN v_source_type := 'person'; END IF;
  IF v_target = 'Jakub' THEN v_target_type := 'person'; END IF;

  IF v_memory_type NOT IN ('fact', 'hypothesis', 'preference', 'correlation', 'telemetry') THEN
    v_memory_type := 'fact';
  END IF;

  -- Wyznacz temporal_status na bazie typów i relacji
  IF v_memory_type = 'hypothesis' THEN
    v_temp_status := 'hypothesis';
  ELSIF v_relation = 'deklaruje' THEN
    v_temp_status := 'declared';
  ELSE
    v_temp_status := 'current';
  END IF;

  -- Sprawdź czy relacja jest singletonem
  SELECT EXISTS(
    SELECT 1 FROM public.vanguard_singleton_relations WHERE relation = v_relation
  ) INTO v_is_singleton;

  -- Sprawdź czy wiersz już istnieje, aby użyć jego rzeczywistego ID
  SELECT id INTO v_link_id
  FROM public.vanguard_entity_links
  WHERE user_id = p_user_id
    AND source_entity = v_source
    AND relation = v_relation
    AND target_entity = v_target;

  IF v_link_id IS NULL THEN
    v_link_id := v_new_id;
  END IF;

  -- GRAPHITI PATTERN: zdeprecjonuj stare aktywne linki z innym targetem
  IF v_is_singleton THEN
    UPDATE public.vanguard_entity_links
    SET
      status          = 'deprecated',
      temporal_status = 'historical', -- Zep/Graphiti: superseded fact is historical
      valid_until     = v_obs_at,
      superseded_by   = v_link_id,   -- Używamy v_link_id, który na pewno będzie istniał
      metadata        = metadata || jsonb_build_object(
                          'deprecated_reason', 'superseded by newer fact',
                          'deprecated_at',     now()
                        )
    WHERE
      user_id        = p_user_id
      AND source_entity = v_source
      AND relation      = v_relation
      AND target_entity != v_target
      AND status        = 'active';
  END IF;

  -- Upsert
  INSERT INTO public.vanguard_entity_links (
    id, user_id, source_entity, source_type, relation, target_entity, target_type,
    weight, evidence_count, first_seen, last_seen, observed_at, valid_from, status,
    confidence_score, memory_type, layer, metadata, source_episode_id, temporal_status
  ) VALUES (
    v_link_id, p_user_id,
    v_source, v_source_type, v_relation, v_target, v_target_type,
    1.0, 1, CURRENT_DATE, CURRENT_DATE, v_obs_at, v_obs_at, 'active',
    v_confidence, v_memory_type, v_layer,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_upserted_at', now()),
    p_source_episode_id, v_temp_status
  )
  ON CONFLICT (user_id, source_entity, relation, target_entity) DO UPDATE SET
    evidence_count    = public.vanguard_entity_links.evidence_count + 1,
    weight            = LEAST(5.0, public.vanguard_entity_links.weight + 0.2),
    last_seen         = CURRENT_DATE,
    observed_at       = v_obs_at,
    status            = 'active', -- Reactivate if re-observed
    temporal_status   = CASE
                          WHEN EXCLUDED.memory_type = 'hypothesis' THEN 'hypothesis'
                          WHEN public.vanguard_entity_links.relation = 'deklaruje' THEN 'declared'
                          ELSE 'current'
                        END,
    valid_until       = NULL,
    confidence_score  = GREATEST(
                          public.vanguard_entity_links.confidence_score,
                          EXCLUDED.confidence_score
                        ),
    memory_type       = CASE
                          WHEN public.vanguard_entity_links.memory_type = 'fact' THEN 'fact'
                          ELSE EXCLUDED.memory_type
                        END,
    layer             = EXCLUDED.layer,
    source_episode_id = COALESCE(
                          EXCLUDED.source_episode_id,
                          public.vanguard_entity_links.source_episode_id
                        ),
    metadata          = public.vanguard_entity_links.metadata || EXCLUDED.metadata;
END;
$$;


ALTER FUNCTION "public"."upsert_vanguard_entity_link"("p_user_id" "uuid", "p_source" "text", "p_source_type" "text", "p_relation" "text", "p_target" "text", "p_target_type" "text", "p_confidence_score" double precision, "p_memory_type" "text", "p_layer" "text", "p_metadata" "jsonb", "p_source_episode_id" "uuid", "p_observed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vanguard_graph_cleanup"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."vanguard_graph_cleanup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_vanguard_knowledge"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NEW.is_verified = true THEN
        NEW.importance_score = 10; -- Max ważność dla zweryfikowanych danych
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."verify_vanguard_knowledge"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'warning'::"text" NOT NULL,
    "message" "text",
    "user_id" "uuid",
    "related_table" "text",
    "related_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "audit_events_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aw_daily_summary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "text" NOT NULL,
    "total_active_seconds" integer,
    "total_afk_seconds" integer,
    "top_apps" "jsonb",
    "categories" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "web_domains" "jsonb",
    "time_of_day" "jsonb",
    "productivity_ratio" numeric,
    "phone_active_seconds" integer,
    "phone_top_apps" "jsonb"
);


ALTER TABLE "public"."aw_daily_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."behavior_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "behavior_key" "text" NOT NULL,
    "value" numeric,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."behavior_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_composition_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "measured_at" timestamp with time zone NOT NULL,
    "source" "text" NOT NULL,
    "method" "text" DEFAULT 'BIA'::"text" NOT NULL,
    "reliability" "text" DEFAULT 'estimated'::"text" NOT NULL,
    "weight_kg" numeric,
    "body_fat_pct" numeric,
    "fat_mass_kg" numeric,
    "fat_free_mass_kg" numeric,
    "muscle_mass_kg" numeric,
    "bone_mass_kg" numeric,
    "protein_kg" numeric,
    "total_body_water_kg" numeric,
    "total_body_water_pct" numeric,
    "extracellular_water_kg" numeric,
    "intracellular_water_kg" numeric,
    "visceral_fat_rating" numeric,
    "bmi" numeric,
    "metabolic_age" numeric,
    "bmr_kcal" numeric,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."body_composition_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE,
    "weight" numeric(5,2),
    "waist" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "chest" numeric(5,2),
    "biceps_l" numeric(5,2),
    "biceps_r" numeric(5,2),
    "forearm" numeric(5,2),
    "belly" numeric(5,2),
    "thigh" numeric(5,2),
    "calf" numeric(5,2),
    "hips" numeric(5,2),
    "body_fat" numeric(5,2),
    "muscle_mass" numeric(5,2),
    "bone_mass" numeric(5,2),
    "body_water" numeric(5,2),
    "weight_italia" numeric(5,2),
    "neck" numeric
);


ALTER TABLE "public"."body_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friction_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stream_record_id" "uuid",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_text" "text",
    "friction_type" "text",
    "declared_intention" "text",
    "actual_behavior" "text",
    "deviation" "text",
    "immediate_cost" "text",
    "later_cost" "text",
    "cost_estimate" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "emotional_state" "text",
    "people_involved" "text"[],
    "location_context" "text",
    "confidence_source" "text" DEFAULT 'self_report'::"text",
    "confidence" double precision DEFAULT 0.7,
    "status" "text" DEFAULT 'raw'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "review_status" "text",
    "event_kind" "text",
    "extraction_quality" integer,
    "parser_version" "text",
    "extraction_quality_score" integer,
    "last_reviewed_at" timestamp with time zone,
    "review_notes" "text",
    CONSTRAINT "friction_events_confidence_check" CHECK ((("confidence" >= (0)::double precision) AND ("confidence" <= (1)::double precision))),
    CONSTRAINT "friction_events_confidence_source_check" CHECK (("confidence_source" = ANY (ARRAY['self_report'::"text", 'inferred'::"text", 'biometric'::"text"]))),
    CONSTRAINT "friction_events_event_kind_check" CHECK ((("event_kind" IS NULL) OR ("event_kind" = ANY (ARRAY['friction_event'::"text", 'positive_micro_action'::"text", 'state_observation'::"text", 'micro_behavior_observation'::"text", 'reflection'::"text"])))),
    CONSTRAINT "friction_events_friction_type_check" CHECK (("friction_type" = ANY (ARRAY['avoidance'::"text", 'procrastination'::"text", 'emotional_spike'::"text", 'habit_break'::"text", 'social_withdrawal'::"text", 'sleep_disruption'::"text", 'training_drop'::"text", 'social_hesitation'::"text", 'communication_drift'::"text", 'self_control_break'::"text", 'positive_micro_action'::"text", 'other'::"text"]))),
    CONSTRAINT "friction_events_review_status_check" CHECK (("review_status" = ANY (ARRAY['good'::"text", 'error'::"text", 'to_fix'::"text", 'dismissed'::"text", 'user_confirmed'::"text", 'user_corrected'::"text"]))),
    CONSTRAINT "friction_events_status_check" CHECK (("status" = ANY (ARRAY['raw'::"text", 'reviewed'::"text", 'pattern_candidate'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."friction_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."friction_events"."review_status" IS 'Manual QA label: good | error | to_fix | dismissed. NULL = unreviewed.';



COMMENT ON COLUMN "public"."friction_events"."parser_version" IS 'Version of the prompt/extractor that produced this friction event (e.g. auto-classify-v41).';



COMMENT ON COLUMN "public"."friction_events"."extraction_quality_score" IS 'Manual audit score (0-100) assigned during quality reviews.';



COMMENT ON COLUMN "public"."friction_events"."last_reviewed_at" IS 'Timestamp of the last manual quality review/audit.';



COMMENT ON COLUMN "public"."friction_events"."review_notes" IS 'Notes or annotations from the quality auditor.';



CREATE OR REPLACE VIEW "public"."confirmed_friction_events" WITH ("security_invoker"='true') AS
 SELECT "id",
    "user_id",
    "stream_record_id",
    "occurred_at",
    "raw_text",
    "friction_type",
    "declared_intention",
    "actual_behavior",
    "deviation",
    "immediate_cost",
    "later_cost",
    "cost_estimate",
    "context",
    "emotional_state",
    "people_involved",
    "location_context",
    "confidence_source",
    "confidence",
    "status",
    "created_at",
    "review_status",
    "event_kind",
    "extraction_quality",
    "parser_version",
    "extraction_quality_score",
    "last_reviewed_at",
    "review_notes"
   FROM "public"."friction_events"
  WHERE (("review_status" = ANY (ARRAY['good'::"text", 'user_confirmed'::"text", 'user_corrected'::"text"])) AND (("event_kind" IS NULL) OR ("event_kind" = ANY (ARRAY['friction_event'::"text", 'positive_micro_action'::"text"]))));


ALTER VIEW "public"."confirmed_friction_events" OWNER TO "postgres";


COMMENT ON VIEW "public"."confirmed_friction_events" IS 'High-signal behavioral friction and positive micro-actions only. Primary source for Oracle context, daily reconciliation, weekly synthesis and analyst. event_kind IS NULL allowed until legacy-record backfill is complete.';



CREATE TABLE IF NOT EXISTS "public"."daily_food_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "calories" integer,
    "protein" numeric(5,2),
    "meal_type" "text",
    "amount" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "carbs" numeric(10,2) DEFAULT 0,
    "fat" numeric(10,2) DEFAULT 0,
    "fiber" numeric,
    "sugar" numeric,
    "brand" "text",
    "saturated_fat" numeric,
    "salt" numeric,
    "insulin_load" numeric,
    "logged_at" timestamp with time zone,
    "food_quality_score" integer,
    "quality_reason" "text",
    "meal_group_id" "uuid",
    "parse_meta" "jsonb"
);


ALTER TABLE "public"."daily_food_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_nutrition" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "calories" integer,
    "protein" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "fiber" numeric,
    "sugar" numeric,
    "carbs" numeric,
    "fat" numeric,
    "insulin_load" numeric,
    "avg_food_quality" integer,
    "food_quality_analysis" "text"
);


ALTER TABLE "public"."daily_nutrition" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_reconciliations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "mode" "text" DEFAULT 'full'::"text" NOT NULL,
    "events_count" smallint DEFAULT 0,
    "events_summary" "jsonb" DEFAULT '[]'::"jsonb",
    "telegram_message_id" bigint,
    "user_response" "text",
    "parsed_response" "jsonb",
    "day_score" smallint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "answered_at" timestamp with time zone,
    "planning_status" "text" DEFAULT 'pending'::"text",
    "planning_history" "jsonb" DEFAULT '[]'::"jsonb",
    "planning_summary" "jsonb",
    "midday_status" "text",
    "midday_sent_at" timestamp with time zone,
    "morning_sent_at" timestamp with time zone,
    "morning_clicked_at" timestamp with time zone,
    "morning_action" "text",
    "phone_drift_morning" boolean DEFAULT false,
    "compression_mode_used" boolean DEFAULT false,
    "first_move_started" boolean DEFAULT false,
    "evening_extraction" "jsonb",
    "midday_blocker" "text",
    "morning_ping_sent_at" timestamp with time zone,
    "first_90_started_at" timestamp with time zone,
    "first_90_protected" boolean,
    "analysis_without_deployment" boolean DEFAULT false,
    "p2_parsed" "jsonb",
    "plan_quality" "text",
    "plan_failure_reason" "text",
    "p2_parser_version" "text",
    "evening_extraction_version" "text",
    "week_start" "date" GENERATED ALWAYS AS (("date_trunc"('week'::"text", ("date")::timestamp without time zone))::"date") STORED,
    CONSTRAINT "daily_reconciliations_day_score_check" CHECK ((("day_score" >= 1) AND ("day_score" <= 5))),
    CONSTRAINT "daily_reconciliations_midday_status_check" CHECK (("midday_status" = ANY (ARRAY['done'::"text", 'not_done'::"text", 'stuck'::"text"]))),
    CONSTRAINT "daily_reconciliations_mode_check" CHECK (("mode" = ANY (ARRAY['full'::"text", 'checkin'::"text", 'morning_rescue'::"text", 'reflection'::"text"]))),
    CONSTRAINT "daily_reconciliations_planning_status_check" CHECK (("planning_status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'completed'::"text"]))),
    CONSTRAINT "daily_reconciliations_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'answered'::"text", 'missed'::"text"])))
);


ALTER TABLE "public"."daily_reconciliations" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_reconciliations" IS 'Evening Telegram reconciliation sessions. Sends daily summary of friction_events, collects user corrections. Part of human-in-the-loop correction layer (Sprint 0.8).';



COMMENT ON COLUMN "public"."daily_reconciliations"."p2_parsed" IS 'Structured P2 parser output. Fields: day_score (1-5), biggest_cost, best_move, correction, resource, blocker_candidates (jsonb array), parse_confidence (0.0-1.0), needs_manual_review (bool), unparsed_notes.';



COMMENT ON COLUMN "public"."daily_reconciliations"."p2_parser_version" IS 'Version of the P2 parser prompt (e.g. p2-parser-v1).';



COMMENT ON COLUMN "public"."daily_reconciliations"."evening_extraction_version" IS 'Version of the legacy evening extraction prompt.';



CREATE TABLE IF NOT EXISTS "public"."daily_strain" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "strain_score" numeric,
    "recovery_score" integer,
    "fueling_score" integer,
    "mental_load_score" integer,
    "daily_status" "text",
    "main_limiter" "text",
    "explanation" "text",
    "cardio_load" numeric,
    "strength_load" numeric,
    "leg_load" numeric,
    "cns_load" numeric,
    "steps_load" numeric,
    "fueling_penalty" numeric,
    "components" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fueling_provisional" boolean DEFAULT false NOT NULL,
    "readiness_level" "text",
    "illness_score" numeric,
    "illness_level" "text",
    CONSTRAINT "daily_strain_readiness_level_check" CHECK ((("readiness_level" IS NULL) OR ("readiness_level" = ANY (ARRAY['primed'::"text", 'balanced'::"text", 'strained'::"text", 'rundown'::"text", 'insufficient'::"text"]))))
);


ALTER TABLE "public"."daily_strain" OWNER TO "postgres";


COMMENT ON COLUMN "public"."daily_strain"."fueling_provisional" IS 'TRUE gdy wiersz dotyczy dnia biezacego (Europe/Warsaw) - fueling jeszcze niepelny, nie liczony do strain ani jako limiter calories/carbs.';



COMMENT ON COLUMN "public"."daily_strain"."readiness_level" IS 'ReadinessEngine (NOOP port): primed | balanced | strained | rundown | insufficient. Synthesizes HRV z-score, RHR drift, ACWR, training monotony.';



CREATE TABLE IF NOT EXISTS "public"."daily_win_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_win_id" "uuid" NOT NULL,
    "slot" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "done" boolean DEFAULT false,
    "category" "text",
    "completed_at" timestamp with time zone,
    "todo_id" "uuid",
    "checkpoint_id" "uuid",
    "pin_id" "uuid",
    "project_id" "uuid",
    "target_value" "text",
    "time_slot" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_win_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_wins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE,
    "task_1" "text",
    "category_1" "text",
    "done_1" boolean DEFAULT false,
    "task_2" "text",
    "category_2" "text",
    "done_2" boolean DEFAULT false,
    "task_3" "text",
    "category_3" "text",
    "done_3" boolean DEFAULT false,
    "task_4" "text",
    "category_4" "text",
    "done_4" boolean DEFAULT false,
    "task_5" "text",
    "category_5" "text",
    "done_5" boolean DEFAULT false,
    "result" character varying(1),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "journal_entry" "text",
    "gratitude_entry" "text",
    "embedding" "public"."vector"(1536),
    "importance_score" integer DEFAULT 5,
    "is_intervention" boolean DEFAULT false,
    "completed_at_1" timestamp with time zone,
    "completed_at_2" timestamp with time zone,
    "completed_at_3" timestamp with time zone,
    "completed_at_4" timestamp with time zone,
    "completed_at_5" timestamp with time zone,
    "daily_rpe" integer,
    "tags" "text"[],
    "mood_score" integer,
    "task_1_todo_id" "uuid",
    "task_2_todo_id" "uuid",
    "task_3_todo_id" "uuid",
    "task_4_todo_id" "uuid",
    "task_5_todo_id" "uuid",
    "day_note" "text",
    "task_1_project_id" "uuid",
    "task_2_project_id" "uuid",
    "task_3_project_id" "uuid",
    "task_4_project_id" "uuid",
    "task_5_project_id" "uuid",
    "task_1_pin_id" "uuid",
    "task_2_pin_id" "uuid",
    "task_3_pin_id" "uuid",
    "task_4_pin_id" "uuid",
    "task_5_pin_id" "uuid",
    "task_1_target_value" "text",
    "task_2_target_value" "text",
    "task_3_target_value" "text",
    "task_4_target_value" "text",
    "task_5_target_value" "text",
    "task_1_time_slot" "text",
    "task_2_time_slot" "text",
    "task_3_time_slot" "text",
    "task_4_time_slot" "text",
    "task_5_time_slot" "text",
    "week_start" "date" GENERATED ALWAYS AS (("date_trunc"('week'::"text", ("date")::timestamp without time zone))::"date") STORED,
    "task_1_checkpoint_id" "uuid",
    "task_2_checkpoint_id" "uuid",
    "task_3_checkpoint_id" "uuid",
    "task_4_checkpoint_id" "uuid",
    "task_5_checkpoint_id" "uuid",
    CONSTRAINT "daily_wins_daily_rpe_check" CHECK ((("daily_rpe" >= 1) AND ("daily_rpe" <= 10))),
    CONSTRAINT "daily_wins_task_1_time_slot_check" CHECK ((("task_1_time_slot" IS NULL) OR ("task_1_time_slot" = ANY (ARRAY['morning'::"text", 'noon'::"text", 'afternoon'::"text", 'evening'::"text"])))),
    CONSTRAINT "daily_wins_task_2_time_slot_check" CHECK ((("task_2_time_slot" IS NULL) OR ("task_2_time_slot" = ANY (ARRAY['morning'::"text", 'noon'::"text", 'afternoon'::"text", 'evening'::"text"])))),
    CONSTRAINT "daily_wins_task_3_time_slot_check" CHECK ((("task_3_time_slot" IS NULL) OR ("task_3_time_slot" = ANY (ARRAY['morning'::"text", 'noon'::"text", 'afternoon'::"text", 'evening'::"text"])))),
    CONSTRAINT "daily_wins_task_4_time_slot_check" CHECK ((("task_4_time_slot" IS NULL) OR ("task_4_time_slot" = ANY (ARRAY['morning'::"text", 'noon'::"text", 'afternoon'::"text", 'evening'::"text"])))),
    CONSTRAINT "daily_wins_task_5_time_slot_check" CHECK ((("task_5_time_slot" IS NULL) OR ("task_5_time_slot" = ANY (ARRAY['morning'::"text", 'noon'::"text", 'afternoon'::"text", 'evening'::"text"]))))
);


ALTER TABLE "public"."daily_wins" OWNER TO "postgres";


COMMENT ON COLUMN "public"."daily_wins"."gratitude_entry" IS 'Wpisy wdzięczności użytkownika.';



COMMENT ON COLUMN "public"."daily_wins"."daily_rpe" IS 'Rate of Perceived Exertion (1-10) dla całego dnia.';



COMMENT ON COLUMN "public"."daily_wins"."mood_score" IS 'Subiektywna ocena nastroju (1-5).';



CREATE TABLE IF NOT EXISTS "public"."dreams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" DEFAULT 'inne'::"text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "done_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "is_top5" boolean DEFAULT false NOT NULL,
    "life_goal" "text",
    CONSTRAINT "dreams_category_check" CHECK (("category" = ANY (ARRAY['finanse'::"text", 'ciało'::"text", 'relacje'::"text", 'doświadczenia'::"text", 'wolność'::"text", 'inne'::"text"]))),
    CONSTRAINT "dreams_life_goal_check" CHECK (("life_goal" = ANY (ARRAY['cialo'::"text", 'duch'::"text", 'konto'::"text"])))
);


ALTER TABLE "public"."dreams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."endmyopia_daily_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "active_focus_minutes" integer DEFAULT 0,
    "screen_time_hours" numeric(4,2) DEFAULT 0.0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "outdoor_minutes" integer DEFAULT 0,
    "breaks_taken" integer DEFAULT 0,
    "snellen_left" "text",
    "snellen_right" "text",
    "snellen_both" "text",
    "distance_object_notes" "text",
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."endmyopia_daily_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."endmyopia_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "measured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eye_measured" "public"."endmyopia_eye_enum" NOT NULL,
    "blur_distance_cm" numeric(5,2) NOT NULL,
    "diopters" numeric(5,2) NOT NULL,
    "lighting_condition" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."endmyopia_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."endmyopia_prescriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "sphere_l" numeric,
    "cyl_l" numeric,
    "axis_l" integer,
    "sphere_r" numeric,
    "cyl_r" numeric,
    "axis_r" integer,
    "started_at" "date" NOT NULL,
    "ended_at" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "endmyopia_prescriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'past'::"text"]))),
    CONSTRAINT "endmyopia_prescriptions_type_check" CHECK (("type" = ANY (ARRAY['normalized'::"text", 'differential'::"text"])))
);


ALTER TABLE "public"."endmyopia_prescriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercise_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid",
    "exercise_name" character varying(100) NOT NULL,
    "set_number" integer NOT NULL,
    "reps" integer NOT NULL,
    "weight" numeric(5,2),
    "is_pws_or_msp" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "rpe" numeric(3,1),
    "muscle_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "rir" numeric(3,1)
);


ALTER TABLE "public"."exercise_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."exercise_logs"."muscle_tags" IS 'Muscle tags captured at workout save time. Used by MuscleHeatmap instead of re-deriving tags from exercise_name.';



COMMENT ON COLUMN "public"."exercise_logs"."rir" IS 'Reps in reserve for the set. Legacy rpe remains populated for existing strain/MSP compatibility.';



CREATE TABLE IF NOT EXISTS "public"."fasting_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fasting_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_corrections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "query_name" "text" NOT NULL,
    "corrected_name" "text",
    "corrected_grams" integer NOT NULL,
    "use_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."food_corrections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "barcode" "text",
    "name" "text" NOT NULL,
    "brand" "text",
    "calories" integer,
    "protein" numeric,
    "carbs" numeric,
    "fat" numeric,
    "fiber" numeric,
    "sugar" numeric,
    "last_used" timestamp with time zone DEFAULT "now"() NOT NULL,
    "use_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_grams" integer DEFAULT 100 NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."food_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "brand" "text",
    "barcode" "text",
    "calories" numeric,
    "protein" numeric,
    "carbs" numeric,
    "fat" numeric,
    "fiber" numeric,
    "sugar" numeric,
    "default_grams" integer DEFAULT 100 NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."food_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."food_reference_pl" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "calories" integer NOT NULL,
    "protein" numeric NOT NULL,
    "carbs" numeric NOT NULL,
    "fat" numeric NOT NULL,
    "fiber" numeric,
    "sugar" numeric,
    "source_label" "text" DEFAULT 'curated_pl'::"text" NOT NULL
);


ALTER TABLE "public"."food_reference_pl" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pillar" "text" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" DEFAULT ''::"text" NOT NULL,
    "higher_is_better" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "target" numeric,
    "goal_id" "uuid",
    "project_id" "uuid",
    CONSTRAINT "goal_kpis_pillar_check" CHECK (("pillar" = ANY (ARRAY['cialo'::"text", 'duch'::"text", 'konto'::"text"])))
);


ALTER TABLE "public"."goal_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."habit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "habit_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE,
    "completed" boolean DEFAULT false,
    "final_stimulus" "text",
    "context_note" "text",
    "logged_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."habit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."habits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT '✨'::"text",
    "is_positive" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."habits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intervals_tokens" (
    "user_id" "uuid" NOT NULL,
    "athlete_id" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intervals_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_insight_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "insight" "text",
    "widget_type" "text" DEFAULT 'native'::"text",
    "widget_data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_pinned" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "related_fact_ids" "text"[] DEFAULT '{}'::"text"[],
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_insight_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kpi_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "value" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kpi_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_skill_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learning_skill_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid"
);


ALTER TABLE "public"."learning_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_week_focus" (
    "user_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "skill_id" "uuid",
    "why_text" "text" DEFAULT ''::"text" NOT NULL,
    "target_level" integer,
    "subskill_id" "uuid",
    "drill_text" "text" DEFAULT ''::"text" NOT NULL,
    "rep_target" integer,
    "rep_done" integer DEFAULT 0 NOT NULL,
    "lateral_challenge" "text" DEFAULT ''::"text" NOT NULL,
    "vertical_challenge" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "learning_week_focus_rep_done_check" CHECK ((("rep_done" >= 0) AND ("rep_done" <= 9999))),
    CONSTRAINT "learning_week_focus_rep_target_check" CHECK ((("rep_target" IS NULL) OR (("rep_target" >= 1) AND ("rep_target" <= 999)))),
    CONSTRAINT "learning_week_focus_target_level_check" CHECK ((("target_level" IS NULL) OR (("target_level" >= 0) AND ("target_level" <= 5))))
);


ALTER TABLE "public"."learning_week_focus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_week_pins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "manual_title" "text",
    "manual_resource_type" "text",
    "skill_id" "uuid",
    "slot" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "done" boolean DEFAULT false NOT NULL,
    "done_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid",
    CONSTRAINT "learning_week_pins_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['link'::"text", 'todo'::"text", 'manual'::"text"]))),
    CONSTRAINT "learning_week_pins_manual_title_chk" CHECK ((("entity_type" <> 'manual'::"text") OR (("manual_title" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "manual_title")) > 0)))),
    CONSTRAINT "learning_week_pins_slot_check" CHECK (("slot" = ANY (ARRAY['must'::"text", 'active'::"text"])))
);


ALTER TABLE "public"."learning_week_pins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."life_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "goal_cialo" "text" DEFAULT 'Zdefiniuj cel dla ciała'::"text",
    "goal_duch" "text" DEFAULT 'Zdefiniuj cel dla ducha'::"text",
    "goal_konto" "text" DEFAULT 'Zdefiniuj cel dla konta'::"text",
    "date_cialo" "date" DEFAULT (CURRENT_DATE + '90 days'::interval),
    "date_duch" "date" DEFAULT (CURRENT_DATE + '90 days'::interval),
    "date_konto" "date" DEFAULT (CURRENT_DATE + '90 days'::interval),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "about_me" "text",
    "vault_content" "text" DEFAULT ''::"text",
    "bhag_pillar" "text",
    CONSTRAINT "life_goals_bhag_pillar_check" CHECK (("bhag_pillar" = ANY (ARRAY['cialo'::"text", 'duch'::"text", 'konto'::"text"])))
);


ALTER TABLE "public"."life_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "accuracy" double precision,
    "place_name" "text",
    "is_manual" boolean DEFAULT false
);


ALTER TABLE "public"."location_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_servers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "api_key" "text",
    "status" "text" DEFAULT 'active'::"text",
    "last_error" "text",
    "last_ping_at" timestamp with time zone,
    CONSTRAINT "mcp_servers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'error'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."mcp_servers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_date" "date" NOT NULL,
    "document_type" "text" NOT NULL,
    "source_name" "text" NOT NULL,
    "source_path" "text",
    "provider" "text",
    "clinical_validity" "text" DEFAULT 'clinical'::"text" NOT NULL,
    "summary" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."medical_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_lab_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "result_date" "date" NOT NULL,
    "marker_key" "text" NOT NULL,
    "marker_name" "text" NOT NULL,
    "category" "text",
    "value" numeric NOT NULL,
    "unit" "text",
    "ref_low" numeric,
    "ref_high" numeric,
    "ref_text" "text",
    "flag" "text",
    "source_name" "text" NOT NULL,
    "provider" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."medical_lab_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month_start" "date" NOT NULL,
    "pattern_note" "text",
    "leverage_note" "text",
    "correction_note" "text",
    "month_theme" "text",
    "carry_over" "text",
    "ai_recap" "jsonb",
    "ritual_stats" "jsonb",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."monthly_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morning_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "text" NOT NULL,
    "content" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."morning_briefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_profile" (
    "user_id" "uuid" NOT NULL,
    "height_cm" numeric,
    "birth_date" "date",
    "sex" "text",
    "goal_body_fat" numeric,
    "current_body_fat_est" numeric,
    "goal_target_date" "date",
    "event_name" "text",
    "event_date" "date",
    "protein_g_per_kg" numeric DEFAULT 2.0 NOT NULL,
    "weekly_loss_kg" numeric DEFAULT 0.35 NOT NULL,
    "philosophy_note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."nutrition_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nutrition_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "text" NOT NULL,
    "est_maintenance_kcal" integer,
    "target_kcal" integer,
    "protein_floor_g" integer,
    "deficit_kcal" integer,
    "weight_trend_kg_per_week" numeric,
    "underlog_gap_kcal" integer,
    "avg_tdee_oura" integer,
    "avg_intake_logged" integer,
    "inputs" "jsonb",
    "verdict" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "forecast_30d_weight_kg" numeric,
    "forecast_60d_weight_kg" numeric,
    "forecast_90d_weight_kg" numeric,
    "forecast_30d_bf_pct" numeric,
    "forecast_60d_bf_pct" numeric,
    "forecast_90d_bf_pct" numeric,
    "days_to_goal_est" integer,
    "adaptive_correction_kcal" integer
);


ALTER TABLE "public"."nutrition_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oracle_clarification_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "response_type" "text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb",
    "dedupe_key" "text" NOT NULL,
    "evidence_fact_ids" "text"[] DEFAULT '{}'::"text"[],
    "proposed_memory" "text",
    "confidence" double precision DEFAULT 0.5,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "answer" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "answered_at" timestamp with time zone,
    CONSTRAINT "oracle_clarification_requests_response_type_check" CHECK (("response_type" = ANY (ARRAY['confirm'::"text", 'single_choice'::"text", 'multi_choice'::"text", 'short_text'::"text"]))),
    CONSTRAINT "oracle_clarification_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'answered'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."oracle_clarification_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oracle_pending_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    CONSTRAINT "oracle_pending_actions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."oracle_pending_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oura_daily_summary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "readiness_score" integer,
    "total_sleep_hours" numeric(4,2),
    "steps" integer,
    "bedtime_timestamp" timestamp with time zone,
    "is_disciplined" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "hrv_avg" double precision,
    "rhr_avg" double precision,
    "temp_deviation" double precision,
    "deep_sleep_hours" double precision,
    "rem_sleep_hours" double precision,
    "sleep_efficiency" integer,
    "latency_minutes" integer,
    "stress_score" integer,
    "active_calories" integer,
    "total_calories" integer,
    "sleep_score" integer
);


ALTER TABLE "public"."oura_daily_summary" OWNER TO "postgres";


COMMENT ON TABLE "public"."oura_daily_summary" IS 'Przechowuje kompleksowe dane biometryczne z Oura Ring do analizy readiness i stanu układu nerwowego.';



COMMENT ON COLUMN "public"."oura_daily_summary"."active_calories" IS 'Kalorie spalone aktywnie (ruch/trening)';



COMMENT ON COLUMN "public"."oura_daily_summary"."total_calories" IS 'Całkowity wydatek energetyczny dnia (BMR + ruch)';



CREATE TABLE IF NOT EXISTS "public"."oura_enhanced" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "readiness_score" integer,
    "temperature_deviation" double precision,
    "temperature_trend_deviation" double precision,
    "readiness_contributors" "jsonb",
    "sleep_score" integer,
    "sleep_contributors" "jsonb",
    "total_sleep_hours" double precision,
    "time_in_bed_hours" double precision,
    "deep_sleep_hours" double precision,
    "rem_sleep_hours" double precision,
    "light_sleep_hours" double precision,
    "awake_time_minutes" double precision,
    "restless_periods" integer,
    "sleep_efficiency" integer,
    "sleep_latency_minutes" double precision,
    "bedtime_start" timestamp with time zone,
    "bedtime_end" timestamp with time zone,
    "sleep_average_heart_rate" double precision,
    "sleep_lowest_heart_rate" double precision,
    "sleep_average_hrv" double precision,
    "sleep_average_breath" double precision,
    "activity_score" integer,
    "steps" integer,
    "active_calories" integer,
    "total_calories" integer,
    "target_calories" integer,
    "equivalent_walking_distance" integer,
    "high_activity_minutes" double precision,
    "medium_activity_minutes" double precision,
    "low_activity_minutes" double precision,
    "sedentary_minutes" double precision,
    "resting_minutes" double precision,
    "non_wear_minutes" double precision,
    "average_met_minutes" double precision,
    "inactivity_alerts" integer,
    "activity_contributors" "jsonb",
    "stress_high_minutes" double precision,
    "recovery_high_minutes" double precision,
    "stress_day_summary" "text",
    "resilience_level" "text",
    "resilience_contributors" "jsonb",
    "spo2_percentage" double precision,
    "breathing_disturbance_index" double precision,
    "vascular_age" double precision,
    "vo2_max" double precision,
    "raw" "jsonb",
    "wake_up_timestamp" timestamp with time zone
);


ALTER TABLE "public"."oura_enhanced" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oura_heartrate" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ts" timestamp with time zone NOT NULL,
    "bpm" integer,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oura_heartrate" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."oura_hr_zones_daily" WITH ("security_invoker"='on') AS
 WITH "hr" AS (
         SELECT "oura_heartrate"."user_id",
            "oura_heartrate"."ts",
            "oura_heartrate"."bpm",
            (("oura_heartrate"."ts" AT TIME ZONE 'Europe/Warsaw'::"text"))::"date" AS "day",
            "lead"("oura_heartrate"."ts") OVER (PARTITION BY "oura_heartrate"."user_id" ORDER BY "oura_heartrate"."ts") AS "next_ts"
           FROM "public"."oura_heartrate"
        ), "weighted" AS (
         SELECT "hr"."user_id",
            "hr"."day",
            "hr"."bpm",
            LEAST(EXTRACT(epoch FROM ("hr"."next_ts" - "hr"."ts")), (300)::numeric) AS "dur_sec"
           FROM "hr"
          WHERE ("hr"."next_ts" IS NOT NULL)
        )
 SELECT "user_id",
    "day",
    "round"(("sum"("dur_sec") FILTER (WHERE ("bpm" < 98)) / 60.0), 0) AS "spoczynek_min",
    "round"(("sum"("dur_sec") FILTER (WHERE (("bpm" >= 98) AND ("bpm" < 118))) / 60.0), 0) AS "z1_regen_min",
    "round"(("sum"("dur_sec") FILTER (WHERE (("bpm" >= 118) AND ("bpm" < 138))) / 60.0), 0) AS "z2_tlenowa_min",
    "round"(("sum"("dur_sec") FILTER (WHERE (("bpm" >= 138) AND ("bpm" < 157))) / 60.0), 0) AS "z3_tempo_min",
    "round"(("sum"("dur_sec") FILTER (WHERE (("bpm" >= 157) AND ("bpm" < 177))) / 60.0), 0) AS "z4_prog_min",
    "round"(("sum"("dur_sec") FILTER (WHERE ("bpm" >= 177)) / 60.0), 0) AS "z5_max_min",
    "min"("bpm") AS "hr_min",
    "max"("bpm") AS "hr_max",
    "count"(*) AS "odczytow"
   FROM "weighted"
  GROUP BY "user_id", "day";


ALTER VIEW "public"."oura_hr_zones_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oura_sleep_hr_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sleep_id" "text" NOT NULL,
    "day" "date",
    "ts" timestamp with time zone NOT NULL,
    "bpm" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oura_sleep_hr_timeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oura_sleep_hrv_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sleep_id" "text" NOT NULL,
    "day" "date",
    "ts" timestamp with time zone NOT NULL,
    "hrv" double precision,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oura_sleep_hrv_timeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oura_sleep_phase_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sleep_id" "text" NOT NULL,
    "day" "date",
    "ts" timestamp with time zone NOT NULL,
    "phase" "text",
    "phase_code" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oura_sleep_phase_timeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pattern_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pattern_id" "uuid",
    "occurred_on" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pattern_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_usage_daily" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "total_minutes" integer,
    "late_night_minutes" integer,
    "social_minutes" integer,
    "messaging_minutes" integer,
    "entertainment_minutes" integer,
    "ai_minutes" integer,
    "browser_minutes" integer,
    "unlocks" integer,
    "top_apps" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."phone_usage_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."progress_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE,
    "image_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "thumbnail_url" "text"
);


ALTER TABLE "public"."progress_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "goal" "text",
    "deadline" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "color" "text" DEFAULT 'indigo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dream_id" "uuid",
    "retrospective_good" "text",
    "retrospective_improve" "text",
    "retrospective_rating" smallint,
    "goal_id" "uuid",
    "primary_skill_id" "uuid",
    CONSTRAINT "projects_retrospective_rating_check" CHECK ((("retrospective_rating" >= 1) AND ("retrospective_rating" <= 5))),
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "keys_p256dh" "text" NOT NULL,
    "keys_auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sprint_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "personal_year" integer NOT NULL,
    "sprint_number" integer NOT NULL,
    "goal_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "focus_project_ids" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."sprint_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sprint_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "personal_year" integer NOT NULL,
    "sprint_number" integer NOT NULL,
    "reflection" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sprint_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strava_activities" (
    "strava_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "sport_type" "text",
    "start_date" timestamp with time zone,
    "elapsed_time" integer,
    "moving_time" integer,
    "distance" double precision,
    "average_heartrate" double precision,
    "max_heartrate" double precision,
    "average_speed" double precision,
    "max_speed" double precision,
    "total_elevation_gain" double precision,
    "calories" double precision,
    "suffer_score" integer,
    "perceived_exertion" double precision,
    "manual" boolean DEFAULT false,
    "raw_data" "jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "hr_avg" double precision,
    "hr_max" double precision,
    "hr_source" "text",
    "hr_frozen" boolean DEFAULT false,
    "splits_with_hr" "jsonb",
    "gear_name" "text",
    "gear_distance_km" double precision,
    "is_oura_duplicate" boolean DEFAULT false,
    "gc_activity_id" bigint,
    "gc_hr_zones" "jsonb",
    "gc_weather" "jsonb",
    "gc_laps" "jsonb",
    "gc_training_effect_aerobic" numeric(4,2),
    "gc_training_effect_anaerobic" numeric(4,2),
    "gc_vo2max" numeric(5,1),
    "gc_enriched_at" timestamp with time zone,
    "source" "text" DEFAULT 'strava'::"text",
    "icu_activity_id" "text",
    "icu_hr_zone_times" "jsonb",
    "trimp" numeric,
    CONSTRAINT "strava_activities_hr_source_check" CHECK (("hr_source" = ANY (ARRAY['strava'::"text", 'oura'::"text", 'garmin_intervals'::"text"])))
);


ALTER TABLE "public"."strava_activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."strava_activities"."hr_avg" IS 'Resolved HR avg — from Strava (watch) or Oura overlay';



COMMENT ON COLUMN "public"."strava_activities"."hr_max" IS 'Resolved HR max — from Strava (watch) or Oura overlay';



COMMENT ON COLUMN "public"."strava_activities"."hr_source" IS 'Source of HR data: strava (GPS watch) or oura (ring)';



COMMENT ON COLUMN "public"."strava_activities"."hr_frozen" IS 'True when Oura sensor locked — >60% of splits at exactly hr_max';



COMMENT ON COLUMN "public"."strava_activities"."splits_with_hr" IS 'splits_metric from Strava merged with per-split HR from Oura';



COMMENT ON COLUMN "public"."strava_activities"."gear_name" IS 'Resolved shoe name from Strava gear';



COMMENT ON COLUMN "public"."strava_activities"."gear_distance_km" IS 'Total km on this shoe at time of activity';



COMMENT ON COLUMN "public"."strava_activities"."is_oura_duplicate" IS 'True when this is an Oura auto-sync duplicate of a primary activity';



COMMENT ON COLUMN "public"."strava_activities"."source" IS 'Skad przyszedl wiersz: strava (historyczne, do 2026-06-30) albo garmin_intervals (od 2026-07 przez intervals.icu API)';



COMMENT ON COLUMN "public"."strava_activities"."icu_activity_id" IS 'Oryginalne id aktywnosci w intervals.icu (np. i162610403), do debugowania/re-fetchu';



COMMENT ON COLUMN "public"."strava_activities"."icu_hr_zone_times" IS 'Sekundy w kazdej z 7 stref HR, policzone przez intervals.icu (icu_hr_zone_times)';



COMMENT ON COLUMN "public"."strava_activities"."trimp" IS 'TRIMP (training impulse) z intervals.icu - odpowiednik suffer_score ze Stravy';



CREATE OR REPLACE VIEW "public"."strava_activities_clean" WITH ("security_invoker"='true') AS
 WITH "tagged" AS (
         SELECT "strava_activities"."strava_id",
            "strava_activities"."user_id",
            "strava_activities"."name",
            "strava_activities"."sport_type",
            "strava_activities"."start_date",
            "strava_activities"."elapsed_time",
            "strava_activities"."moving_time",
            "strava_activities"."distance",
            "strava_activities"."average_heartrate",
            "strava_activities"."max_heartrate",
            "strava_activities"."average_speed",
            "strava_activities"."max_speed",
            "strava_activities"."total_elevation_gain",
            "strava_activities"."calories",
            "strava_activities"."suffer_score",
            "strava_activities"."perceived_exertion",
            "strava_activities"."manual",
            "strava_activities"."raw_data",
            "strava_activities"."synced_at",
            "strava_activities"."hr_avg",
            "strava_activities"."hr_max",
            "strava_activities"."hr_source",
            "strava_activities"."hr_frozen",
            "strava_activities"."splits_with_hr",
            "strava_activities"."gear_name",
            "strava_activities"."gear_distance_km",
            "strava_activities"."is_oura_duplicate",
            "strava_activities"."gc_activity_id",
            "strava_activities"."gc_hr_zones",
            "strava_activities"."gc_weather",
            "strava_activities"."gc_laps",
            "strava_activities"."gc_training_effect_aerobic",
            "strava_activities"."gc_training_effect_anaerobic",
            "strava_activities"."gc_vo2max",
            "strava_activities"."gc_enriched_at",
            (("strava_activities"."name" ~~* '%oura%'::"text") OR (COALESCE("strava_activities"."is_oura_duplicate", false) = true)) AS "is_oura"
           FROM "public"."strava_activities"
        ), "enriched" AS (
         SELECT "a"."strava_id",
            "a"."user_id",
            "a"."name",
            "a"."sport_type",
            "a"."start_date",
            "a"."elapsed_time",
            "a"."moving_time",
            "a"."distance",
            "a"."average_speed",
            "a"."max_speed",
            "a"."total_elevation_gain",
            "a"."suffer_score",
            "a"."perceived_exertion",
            "a"."manual",
            "a"."is_oura",
            ("a"."elapsed_time" - "a"."moving_time") AS "pause_seconds",
                CASE
                    WHEN ("a"."average_speed" > (0)::double precision) THEN ("round"(((1000.0)::double precision / "a"."average_speed")))::integer
                    ELSE NULL::integer
                END AS "pace_sec_per_km",
                CASE
                    WHEN (("a"."raw_data" ->> 'average_cadence'::"text") IS NOT NULL) THEN ("round"(((("a"."raw_data" ->> 'average_cadence'::"text"))::numeric * (2)::numeric)))::integer
                    ELSE NULL::integer
                END AS "cadence_spm",
            (("a"."raw_data" ->> 'workout_type'::"text"))::integer AS "workout_type",
            "a"."gear_name",
            "a"."gear_distance_km",
            (COALESCE((("a"."raw_data" ->> 'pr_count'::"text"))::integer, 0) > 0) AS "has_pr",
            COALESCE((("a"."raw_data" ->> 'achievement_count'::"text"))::integer, 0) AS "achievement_count",
            ("a"."raw_data" -> 'best_efforts'::"text") AS "best_efforts",
            COALESCE("a"."hr_avg", ( SELECT "o"."hr_avg"
                   FROM "tagged" "o"
                  WHERE (("o"."user_id" = "a"."user_id") AND ("o"."sport_type" = "a"."sport_type") AND ("o"."is_oura" = true) AND ("o"."hr_avg" IS NOT NULL) AND ("abs"(EXTRACT(epoch FROM ("o"."start_date" - "a"."start_date"))) < (120)::numeric))
                  ORDER BY ("abs"(EXTRACT(epoch FROM ("o"."start_date" - "a"."start_date"))))
                 LIMIT 1), "a"."average_heartrate") AS "hr_avg",
            COALESCE("a"."hr_max", ( SELECT "o"."hr_max"
                   FROM "tagged" "o"
                  WHERE (("o"."user_id" = "a"."user_id") AND ("o"."sport_type" = "a"."sport_type") AND ("o"."is_oura" = true) AND ("o"."hr_max" IS NOT NULL) AND ("abs"(EXTRACT(epoch FROM ("o"."start_date" - "a"."start_date"))) < (120)::numeric))
                  ORDER BY ("abs"(EXTRACT(epoch FROM ("o"."start_date" - "a"."start_date"))))
                 LIMIT 1), "a"."max_heartrate") AS "hr_max",
            COALESCE("a"."hr_source",
                CASE
                    WHEN ("a"."average_heartrate" IS NOT NULL) THEN 'strava'::"text"
                    WHEN (EXISTS ( SELECT 1
                       FROM "tagged" "o"
                      WHERE (("o"."user_id" = "a"."user_id") AND ("o"."sport_type" = "a"."sport_type") AND ("o"."is_oura" = true) AND ("o"."hr_avg" IS NOT NULL) AND ("abs"(EXTRACT(epoch FROM ("o"."start_date" - "a"."start_date"))) < (120)::numeric)))) THEN 'oura'::"text"
                    ELSE NULL::"text"
                END) AS "hr_source",
            COALESCE("a"."hr_frozen", false) AS "hr_frozen",
            COALESCE("a"."splits_with_hr", ("a"."raw_data" -> 'splits_metric'::"text")) AS "splits_with_hr",
            "a"."gc_activity_id",
            "a"."gc_hr_zones",
            "a"."gc_weather",
            "a"."gc_laps",
            "a"."gc_training_effect_aerobic",
            "a"."gc_training_effect_anaerobic",
            "a"."gc_vo2max",
            "a"."gc_enriched_at",
            "a"."synced_at"
           FROM "tagged" "a"
          WHERE (NOT (("a"."is_oura" = true) AND (EXISTS ( SELECT 1
                   FROM "tagged" "b"
                  WHERE (("b"."user_id" = "a"."user_id") AND ("b"."sport_type" = "a"."sport_type") AND ("b"."is_oura" = false) AND ("abs"(EXTRACT(epoch FROM ("b"."start_date" - "a"."start_date"))) < (120)::numeric))))))
        )
 SELECT "strava_id",
    "user_id",
    "name",
    "sport_type",
    "start_date",
    "elapsed_time",
    "moving_time",
    "distance",
    "average_speed",
    "max_speed",
    "total_elevation_gain",
    "suffer_score",
    "perceived_exertion",
    "manual",
    "is_oura",
    "pause_seconds",
    "pace_sec_per_km",
    "cadence_spm",
    "workout_type",
    "gear_name",
    "gear_distance_km",
    "has_pr",
    "achievement_count",
    "best_efforts",
    "hr_avg",
    "hr_max",
    "hr_source",
    "hr_frozen",
    "splits_with_hr",
    "gc_activity_id",
    "gc_hr_zones",
    "gc_weather",
    "gc_laps",
    "gc_training_effect_aerobic",
    "gc_training_effect_anaerobic",
    "gc_vo2max",
    "gc_enriched_at",
    "synced_at"
   FROM "enriched";


ALTER VIEW "public"."strava_activities_clean" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."strain_correlations" WITH ("security_invoker"='true') AS
 WITH "strava_day" AS (
         SELECT "strava_activities_clean"."user_id",
            (("strava_activities_clean"."start_date" AT TIME ZONE 'Europe/Warsaw'::"text"))::"date" AS "day",
            "avg"("strava_activities_clean"."hr_avg") AS "run_hr",
            "max"("strava_activities_clean"."perceived_exertion") AS "run_rpe",
            "avg"("strava_activities_clean"."cadence_spm") AS "run_cadence"
           FROM "public"."strava_activities_clean"
          WHERE (("strava_activities_clean"."is_oura" = false) AND ("strava_activities_clean"."sport_type" ~~* '%run%'::"text"))
          GROUP BY "strava_activities_clean"."user_id", ((("strava_activities_clean"."start_date" AT TIME ZONE 'Europe/Warsaw'::"text"))::"date")
        ), "daily" AS (
         SELECT "ds"."user_id",
            "ds"."date" AS "day",
            "ds"."strain_score",
            "ds"."fueling_score",
            "ds"."leg_load",
            "ds"."strength_load",
            "s"."readiness_score",
            "s"."hrv_avg",
            "s"."total_sleep_hours",
            "n"."calories",
            "n"."carbs",
            "sd"."run_hr",
            "sd"."run_rpe",
            "sd"."run_cadence"
           FROM ((("public"."daily_strain" "ds"
             LEFT JOIN "public"."oura_daily_summary" "s" ON ((("s"."user_id" = "ds"."user_id") AND ("s"."date" = "ds"."date"))))
             LEFT JOIN "public"."daily_nutrition" "n" ON ((("n"."user_id" = "ds"."user_id") AND ("n"."date" = "ds"."date"))))
             LEFT JOIN "strava_day" "sd" ON ((("sd"."user_id" = "ds"."user_id") AND ("sd"."day" = "ds"."date"))))
        ), "pairs" AS (
         SELECT "t"."user_id",
            "t"."day",
            "t"."strain_score",
            "t"."fueling_score",
            "t"."leg_load",
            "t"."strength_load",
            "t"."readiness_score",
            "t"."hrv_avg",
            "t"."total_sleep_hours",
            "t"."calories",
            "t"."carbs",
            "t"."run_hr",
            "t"."run_rpe",
            "t"."run_cadence",
            "nx"."hrv_avg" AS "next_hrv",
            "nx"."readiness_score" AS "next_readiness",
            "nx"."run_cadence" AS "next_cadence",
            "nx"."run_hr" AS "next_run_hr"
           FROM ("daily" "t"
             LEFT JOIN "daily" "nx" ON ((("nx"."user_id" = "t"."user_id") AND ("nx"."day" = ("t"."day" + 1)))))
        )
 SELECT "user_id",
    "count"(*) AS "n_dni",
    "round"(("corr"(("strain_score")::double precision, "next_hrv"))::numeric, 2) AS "strain_to_jutro_hrv",
    "round"(("corr"(("strain_score")::double precision, ("next_readiness")::double precision))::numeric, 2) AS "strain_to_jutro_readiness",
    "round"(("corr"(("fueling_score")::double precision, "run_hr"))::numeric, 2) AS "fueling_to_hr_biegu",
    "round"(("corr"(("calories")::double precision, "run_rpe"))::numeric, 2) AS "kcal_to_rpe",
    "round"(("corr"(("carbs")::double precision, "run_rpe"))::numeric, 2) AS "wegle_to_rpe",
    "round"(("corr"(("total_sleep_hours")::double precision, ("readiness_score")::double precision))::numeric, 2) AS "sen_to_readiness",
    "round"(("corr"(("leg_load")::double precision, ("next_cadence")::double precision))::numeric, 2) AS "nogi_to_jutro_kadencja",
    "round"(("corr"(("leg_load")::double precision, "next_run_hr"))::numeric, 2) AS "nogi_to_jutro_hr_biegu"
   FROM "pairs"
  GROUP BY "user_id";


ALTER VIEW "public"."strain_correlations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."strava_tokens" (
    "user_id" "uuid" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "access_token" "text",
    "expires_at" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."strava_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplement_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "supplement_id" "uuid" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "date" "text" NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "note" "text"
);


ALTER TABLE "public"."supplement_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" DEFAULT '💊'::"text" NOT NULL,
    "unit" "text" DEFAULT 'kapsułka'::"text" NOT NULL,
    "dose_per_unit" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_date" "date",
    "end_date" "date",
    "reminder_time" time without time zone,
    "reminder_sent_date" "date",
    "skip_qty" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."supplements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "proposal_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "dedupe_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "system_proposals_proposal_type_check" CHECK (("proposal_type" = ANY (ARRAY['friction_cluster'::"text", 'clarification'::"text", 'schedule_edit'::"text"]))),
    CONSTRAINT "system_proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."system_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "todo_item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" integer,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."todo_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "section_id" "uuid",
    "title" "text" NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ai_bucket" "text",
    "ai_classified_at" timestamp with time zone,
    "recurrence" "text",
    "reminder_at" timestamp with time zone,
    "reminder_sent" boolean DEFAULT false NOT NULL,
    "is_milestone" boolean DEFAULT false NOT NULL,
    "project_id" "uuid",
    "scheduled_time" timestamp with time zone,
    "duration_minutes" integer,
    "is_important" boolean DEFAULT false NOT NULL,
    "parent_task_id" "uuid",
    "category" "text",
    CONSTRAINT "todo_items_ai_bucket_check" CHECK (("ai_bucket" = ANY (ARRAY['today'::"text", 'soon'::"text", 'later'::"text", 'future'::"text"]))),
    CONSTRAINT "todo_items_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "todo_items_recurrence_check" CHECK (("recurrence" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "todo_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'done'::"text", 'dropped'::"text"])))
);


ALTER TABLE "public"."todo_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."todo_items"."scheduled_time" IS 'When this task is scheduled to start (used for calendar view & timeboxing)';



COMMENT ON COLUMN "public"."todo_items"."duration_minutes" IS 'Planned duration in minutes (used for calendar blocks & capacity bar)';



COMMENT ON COLUMN "public"."todo_items"."is_important" IS 'Eisenhower axis: important (true) vs not important (false)';



CREATE TABLE IF NOT EXISTS "public"."todo_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid"
);


ALTER TABLE "public"."todo_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_smart_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT '🔍'::"text",
    "query" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."todo_smart_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_plan_workouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "day_of_week" "text" NOT NULL,
    "planned_date" "date",
    "workout_type" "text" NOT NULL,
    "workout_name" "text" NOT NULL,
    "description" "text",
    "goal" "text",
    "target_duration_min" integer,
    "target_distance_km" double precision,
    "target_hr_max" integer,
    "target_pace_min_km" "text",
    "target_pace_max_km" "text",
    "strava_activity_id" bigint,
    "completed" boolean DEFAULT false,
    "completion_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_plan_workouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_fundament" (
    "user_id" "uuid" NOT NULL,
    "identity" "text" DEFAULT ''::"text",
    "philosophy" "text" DEFAULT ''::"text",
    "vision" "text" DEFAULT ''::"text",
    "finances" "text" DEFAULT ''::"text",
    "knowledge" "text" DEFAULT ''::"text",
    "relationships" "text" DEFAULT ''::"text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "work_edu" "text",
    "embedding" "public"."vector"(1536),
    "importance_score" integer DEFAULT 10
);


ALTER TABLE "public"."user_fundament" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "oura_token" "text",
    "disciplined_streak" integer DEFAULT 0,
    "total_disciplined_days" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "yazio_username" "text",
    "yazio_password" "text",
    "yazio_token" "text",
    "home_lat" numeric(9,6),
    "home_lng" numeric(9,6),
    "todoist_project_id" "text"
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_stream" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "source" "text",
    "content" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "classification" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "public"."vector"(1536),
    "importance_score" smallint,
    "category" "text",
    "tags" "text"[],
    "situation_fingerprint" "public"."vector"(1536),
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    CONSTRAINT "vanguard_stream_importance_score_check" CHECK ((("importance_score" >= 1) AND ("importance_score" <= 10)))
);


ALTER TABLE "public"."vanguard_stream" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_friction_daily_qa" WITH ("security_invoker"='true') AS
 WITH "window_48h" AS (
         SELECT "vs"."id" AS "stream_id",
            "vs"."created_at",
            "fe"."id" AS "friction_id",
            "fe"."friction_type",
            "fe"."immediate_cost",
            "fe"."confidence",
            "fe"."status"
           FROM ("public"."vanguard_stream" "vs"
             LEFT JOIN "public"."friction_events" "fe" ON (("fe"."stream_record_id" = "vs"."id")))
          WHERE ("vs"."created_at" > ("now"() - '48:00:00'::interval))
        ), "daily" AS (
         SELECT "count"(DISTINCT "window_48h"."stream_id") AS "stream_total",
            "count"(DISTINCT "window_48h"."friction_id") AS "friction_created",
            ("count"(DISTINCT "window_48h"."stream_id") - "count"(DISTINCT "window_48h"."friction_id")) AS "no_friction_count",
            "round"(((100.0 * ("count"(DISTINCT "window_48h"."friction_id"))::numeric) / (NULLIF("count"(DISTINCT "window_48h"."stream_id"), 0))::numeric), 1) AS "extraction_rate_pct",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."friction_type" = 'sleep_disruption'::"text")) AS "t_sleep",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."friction_type" = 'avoidance'::"text")) AS "t_avoidance",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."friction_type" = 'procrastination'::"text")) AS "t_procrastination",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."friction_type" = 'social_hesitation'::"text")) AS "t_social_hesitation",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."friction_type" = 'positive_micro_action'::"text")) AS "t_positive",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."friction_type" = 'training_drop'::"text")) AS "t_training",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."friction_type" = 'other'::"text")) AS "t_other",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."immediate_cost" IS NOT NULL)) AS "with_cost",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."immediate_cost" IS NULL)) AS "without_cost",
            "round"(("avg"("window_48h"."confidence"))::numeric, 2) AS "avg_confidence",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."status" = 'raw'::"text")) AS "status_raw",
            "count"(DISTINCT "window_48h"."friction_id") FILTER (WHERE ("window_48h"."status" = 'dismissed'::"text")) AS "status_dismissed"
           FROM "window_48h"
        )
 SELECT ("now"())::"date" AS "report_date",
    "stream_total",
    "friction_created",
    "no_friction_count",
    "extraction_rate_pct",
    "t_sleep",
    "t_avoidance",
    "t_procrastination",
    "t_social_hesitation",
    "t_positive",
    "t_training",
    "t_other",
    "with_cost",
    "without_cost",
    "avg_confidence",
    "status_raw",
    "status_dismissed"
   FROM "daily";


ALTER VIEW "public"."v_friction_daily_qa" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_friction_debug" WITH ("security_invoker"='true') AS
 SELECT "fe"."id",
    "fe"."occurred_at",
    "fe"."friction_type",
    "fe"."status",
    "fe"."confidence",
    "fe"."confidence_source",
    "fe"."declared_intention",
    "fe"."actual_behavior",
    "fe"."deviation",
    "fe"."immediate_cost",
    "fe"."later_cost",
    "fe"."emotional_state",
    "fe"."people_involved",
    "fe"."location_context",
    "fe"."raw_text",
    "fe"."stream_record_id",
    "vs"."content" AS "stream_content",
    "vs"."category" AS "stream_category",
    "vs"."created_at" AS "stream_created_at",
    "fe"."created_at" AS "friction_created_at"
   FROM ("public"."friction_events" "fe"
     LEFT JOIN "public"."vanguard_stream" "vs" ON (("vs"."id" = "fe"."stream_record_id")))
  ORDER BY "fe"."occurred_at" DESC;


ALTER VIEW "public"."v_friction_debug" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_friction_pipeline_status" WITH ("security_invoker"='true') AS
 SELECT "vs"."id" AS "stream_id",
    "vs"."created_at" AS "stream_at",
    "vs"."category",
    "left"("vs"."content", 120) AS "content_preview",
    ("fe"."id" IS NOT NULL) AS "has_friction_event",
    "fe"."friction_type",
    "fe"."status" AS "friction_status",
    "fe"."review_status",
    "fe"."declared_intention",
    "fe"."actual_behavior",
    "fe"."deviation",
    "fe"."immediate_cost",
    "fe"."confidence",
    "fe"."confidence_source",
        CASE
            WHEN (("fe"."id" IS NOT NULL) AND ("fe"."immediate_cost" IS NOT NULL) AND ("fe"."raw_text" IS NOT NULL) AND ("fe"."raw_text" !~~* (('%'::"text" || "fe"."immediate_cost") || '%'::"text"))) THEN true
            ELSE false
        END AS "potential_hallucinated_cost"
   FROM ("public"."vanguard_stream" "vs"
     LEFT JOIN "public"."friction_events" "fe" ON (("fe"."stream_record_id" = "vs"."id")))
  ORDER BY "vs"."created_at" DESC;


ALTER VIEW "public"."v_friction_pipeline_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_friction_review" WITH ("security_invoker"='true') AS
 SELECT "fe"."id",
    "fe"."occurred_at",
    "fe"."friction_type",
    "fe"."review_status",
    "fe"."status" AS "pipeline_status",
    "fe"."confidence",
    "fe"."confidence_source",
    "fe"."declared_intention",
    "fe"."actual_behavior",
    "fe"."deviation",
    "fe"."immediate_cost",
    "fe"."later_cost",
    "fe"."emotional_state",
    "fe"."people_involved",
    "fe"."raw_text",
    "vs"."content" AS "stream_content",
    "vs"."category" AS "stream_category",
    "vs"."created_at" AS "stream_created_at"
   FROM ("public"."friction_events" "fe"
     LEFT JOIN "public"."vanguard_stream" "vs" ON (("vs"."id" = "fe"."stream_record_id")))
  ORDER BY "fe"."occurred_at" DESC
 LIMIT 20;


ALTER VIEW "public"."v_friction_review" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_entity_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_entity" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "relation" "text" NOT NULL,
    "target_entity" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "weight" double precision DEFAULT 1.0,
    "first_seen" "date" DEFAULT CURRENT_DATE,
    "last_seen" "date" DEFAULT CURRENT_DATE,
    "evidence_count" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "layer" "text" DEFAULT 'intelligence'::"text",
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    "observed_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text",
    "confidence_score" double precision DEFAULT 0.6,
    "memory_type" "text" DEFAULT 'fact'::"text",
    "superseded_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "embedding" "public"."vector"(1536),
    "source_episode_id" "uuid",
    "temporal_status" "text" DEFAULT 'current'::"text",
    "fact_text" "text",
    CONSTRAINT "vanguard_entity_links_confidence_check" CHECK ((("confidence_score" >= (0)::double precision) AND ("confidence_score" <= (1)::double precision))),
    CONSTRAINT "vanguard_entity_links_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['fact'::"text", 'hypothesis'::"text", 'preference'::"text", 'correlation'::"text", 'telemetry'::"text"]))),
    CONSTRAINT "vanguard_entity_links_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'historical'::"text", 'disputed'::"text", 'deprecated'::"text"]))),
    CONSTRAINT "vanguard_entity_links_temporal_status_check" CHECK (("temporal_status" = ANY (ARRAY['current'::"text", 'historical'::"text", 'declared'::"text", 'hypothesis'::"text", 'stale'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."vanguard_entity_links" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_graph_temporal_guard" WITH ("security_invoker"='true') AS
 SELECT "temporal_status",
    "status",
    "count"(*) AS "edge_count",
        CASE
            WHEN (("temporal_status" = ANY (ARRAY['unknown'::"text", 'stale'::"text", 'historical'::"text"])) AND ("status" = 'active'::"text")) THEN '⚠ LEGACY ACTIVE — excluded from current retrieval'::"text"
            WHEN (("temporal_status" = ANY (ARRAY['current'::"text", 'declared'::"text"])) AND ("status" = 'active'::"text")) THEN '✅ CURRENT — included in RPC retrieval'::"text"
            WHEN (("temporal_status" = 'hypothesis'::"text") AND ("status" = 'active'::"text")) THEN '🔬 HYPOTHESIS — excluded from default retrieval'::"text"
            ELSE 'deprecated / other'::"text"
        END AS "retrieval_status"
   FROM "public"."vanguard_entity_links"
  GROUP BY "temporal_status", "status"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."v_graph_temporal_guard" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_graph_temporal_guard" IS 'Sanity check: run this after any schema change touching vanguard_entity_links.
Expected: only current/declared rows appear in ✅ CURRENT bucket.
If unknown/stale/historical appear in active status without proper exclusion → temporal collapse risk.';



CREATE TABLE IF NOT EXISTS "public"."vanguard_behavioral_patterns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pattern_type" "text" NOT NULL,
    "signature" "text" NOT NULL,
    "title" "text",
    "evidence_text" "text" NOT NULL,
    "first_seen" "date",
    "last_seen" "date",
    "occurrence_count" integer DEFAULT 1,
    "confidence" numeric DEFAULT 0.6,
    "status" "text" DEFAULT 'pending'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "user_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vanguard_behavioral_patterns_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "vanguard_behavioral_patterns_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'visible'::"text", 'user_confirmed'::"text", 'user_rejected'::"text", 'snoozed'::"text", 'archived'::"text", 'hypothesis'::"text"])))
);


ALTER TABLE "public"."vanguard_behavioral_patterns" OWNER TO "postgres";


COMMENT ON TABLE "public"."vanguard_behavioral_patterns" IS 'Etap 1: Personal Pattern Memory. Stores detected recurring behavioral patterns with user feedback. Written primarily during evening reconciliation. Read by morning-brief, Oracle, and weekly synthesis.';



COMMENT ON COLUMN "public"."vanguard_behavioral_patterns"."signature" IS 'Stable key for deduplication (e.g. normalized blocker text or combination of conditions).';



COMMENT ON COLUMN "public"."vanguard_behavioral_patterns"."status" IS 'pending | visible | user_confirmed | user_rejected | snoozed | archived';



CREATE TABLE IF NOT EXISTS "public"."vanguard_calendar" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "event_id" "text",
    "summary" "text",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_calendar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "workout_day" character varying(50) NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "duration_minutes" integer,
    "session_notes" "text",
    "msp_passed" boolean,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "embedding" "public"."vector"(1536),
    "importance_score" integer DEFAULT 5,
    "session_rpe" integer,
    "hr_avg_bpm" numeric,
    "hr_peak_bpm" numeric,
    "hr_strain_score" numeric,
    "hr_kcal_est" numeric,
    "hr_rescored_at" timestamp with time zone,
    CONSTRAINT "workout_sessions_session_rpe_check" CHECK ((("session_rpe" >= 1) AND ("session_rpe" <= 10)))
);


ALTER TABLE "public"."workout_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vanguard_consolidated_activities" AS
 SELECT "behavior_log"."id",
    "behavior_log"."user_id",
    "behavior_log"."date" AS "event_date",
    'behavior_log'::"text" AS "source_type",
    "behavior_log"."behavior_key" AS "category",
    "behavior_log"."behavior_key" AS "label",
    "behavior_log"."value" AS "metric_value",
    "behavior_log"."note" AS "details",
    "jsonb_build_object"('behavior_key', "behavior_log"."behavior_key", 'value', "behavior_log"."value", 'note', "behavior_log"."note") AS "metadata",
    "behavior_log"."created_at"
   FROM "public"."behavior_log"
UNION ALL
 SELECT "workout_sessions"."id",
    "workout_sessions"."user_id",
    "workout_sessions"."date" AS "event_date",
    'workout_sessions'::"text" AS "source_type",
    'workout'::"text" AS "category",
    "workout_sessions"."workout_day" AS "label",
    ("workout_sessions"."duration_minutes")::numeric AS "metric_value",
    "workout_sessions"."session_notes" AS "details",
    "jsonb_build_object"('workout_day', "workout_sessions"."workout_day", 'duration_minutes', "workout_sessions"."duration_minutes", 'session_rpe', "workout_sessions"."session_rpe", 'hr_avg_bpm', "workout_sessions"."hr_avg_bpm", 'hr_peak_bpm', "workout_sessions"."hr_peak_bpm", 'hr_strain_score', "workout_sessions"."hr_strain_score", 'hr_kcal_est', "workout_sessions"."hr_kcal_est") AS "metadata",
    "workout_sessions"."created_at"
   FROM "public"."workout_sessions";


ALTER VIEW "public"."vanguard_consolidated_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_curiosity_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "hypothesis" "text" NOT NULL,
    "provocation" "text" NOT NULL,
    "confidence_score" double precision,
    "category" "text" DEFAULT 'psychology'::"text",
    "evidence_count" integer DEFAULT 1,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vanguard_curiosity_queue_confidence_score_check" CHECK ((("confidence_score" >= (0)::double precision) AND ("confidence_score" <= (1.0)::double precision)))
);


ALTER TABLE "public"."vanguard_curiosity_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_daily_aggregates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "execution_score" double precision,
    "identity_score" integer,
    "power_list_result" "text",
    "readiness_score" integer,
    "sleep_hours" double precision,
    "hrv_avg" double precision,
    "rhr_avg" double precision,
    "temp_deviation" double precision,
    "screen_time_min" integer,
    "dopamine_load_index" double precision,
    "fragmentation_index" double precision,
    "final_state" "text",
    "state_confidence" double precision,
    "strava_activities_json" "jsonb",
    "condensed" boolean DEFAULT false
);


ALTER TABLE "public"."vanguard_daily_aggregates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_entity_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "canonical" "text" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_entity_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_eval_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "suite" "text" DEFAULT 'core'::"text" NOT NULL,
    "question" "text" NOT NULL,
    "expected_answer" "text",
    "expected_sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "expected_claims" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "difficulty" "text" DEFAULT 'medium'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text" DEFAULT 'fact_recall'::"text",
    CONSTRAINT "vanguard_eval_questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text", 'adversarial'::"text"])))
);


ALTER TABLE "public"."vanguard_eval_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_eval_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid",
    "question" "text" NOT NULL,
    "answer" "text",
    "score" numeric,
    "passed" boolean,
    "sources" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "claims" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "raw_response" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "judge_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text",
    "difficulty" "text" DEFAULT 'medium'::"text",
    CONSTRAINT "vanguard_eval_results_score_check" CHECK ((("score" IS NULL) OR (("score" >= (0)::numeric) AND ("score" <= (1)::numeric))))
);


ALTER TABLE "public"."vanguard_eval_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_eval_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "suite" "text" DEFAULT 'core'::"text" NOT NULL,
    "model" "text",
    "oracle_version" "text",
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "vanguard_eval_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'passed'::"text", 'failed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."vanguard_eval_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "message_id" "text",
    "query" "text",
    "reply" "text",
    "score" integer,
    "correction" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_footprint" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "category" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_footprint" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_identity" (
    "user_id" "uuid" NOT NULL,
    "long_term_mission" "text",
    "pillars" "jsonb" DEFAULT '[]'::"jsonb",
    "avoidance_triggers" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "behavioral_baseline" "jsonb"
);


ALTER TABLE "public"."vanguard_identity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_knowledge" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text",
    "content" "text",
    "source_type" "text",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "importance_score" integer DEFAULT 5,
    "embedding" "public"."vector"(1536),
    "is_verified" boolean DEFAULT false,
    "category" "text" DEFAULT 'pattern'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "valid_until" timestamp with time zone
);


ALTER TABLE "public"."vanguard_knowledge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "takeaways" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "category" "text" DEFAULT 'Inne'::"text" NOT NULL,
    "domain" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "thumbnail_url" "text",
    "channel_name" "text",
    "resource_type" "text",
    "pillar" "text"
);


ALTER TABLE "public"."vanguard_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "color" "text" DEFAULT 'default'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."vanguard_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_oracle_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "query" "text" NOT NULL,
    "intent" "text",
    "answer" "text",
    "confidence" "text",
    "claims" "jsonb" DEFAULT '[]'::"jsonb",
    "sources" "jsonb" DEFAULT '[]'::"jsonb",
    "retrieved_context" "jsonb" DEFAULT '[]'::"jsonb",
    "state_vector" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_oracle_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_raw_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "source_ref" "text",
    "event_type" "text" DEFAULT 'note'::"text" NOT NULL,
    "raw_text" "text",
    "raw_hash" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "language" "text" DEFAULT 'pl'::"text" NOT NULL,
    "occurred_at" timestamp with time zone,
    "ingested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "schema_version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "vanguard_raw_events_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processed'::"text", 'failed'::"text", 'ignored'::"text"]))),
    CONSTRAINT "vanguard_raw_events_source_check" CHECK (("length"("btrim"("source")) > 0))
);


ALTER TABLE "public"."vanguard_raw_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_relation_ontology" (
    "relation" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_relation_ontology" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_telegram_inbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "error_log" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_telegram_inbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_time_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "category" character varying(50) NOT NULL,
    "min_hours" numeric(4,1) DEFAULT NULL::numeric,
    "max_hours" numeric(4,1) DEFAULT NULL::numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_time_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_tokens" (
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_wiki_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "page_type" "text" DEFAULT 'concept'::"text" NOT NULL,
    "status" "text" DEFAULT 'hypothesis'::"text" NOT NULL,
    "confidence" numeric DEFAULT 0.55 NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "content_md" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "source_refs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone,
    "last_compiled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vanguard_wiki_pages_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "vanguard_wiki_pages_page_type_check" CHECK (("page_type" = ANY (ARRAY['identity'::"text", 'behavior_pattern'::"text", 'person'::"text", 'project'::"text", 'training'::"text", 'health'::"text", 'decision'::"text", 'friction_loop'::"text", 'concept'::"text", 'source_summary'::"text", 'operating_model'::"text"]))),
    CONSTRAINT "vanguard_wiki_pages_status_check" CHECK (("status" = ANY (ARRAY['hypothesis'::"text", 'active'::"text", 'needs_review'::"text", 'user_confirmed'::"text", 'user_rejected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."vanguard_wiki_pages" OWNER TO "postgres";


COMMENT ON TABLE "public"."vanguard_wiki_pages" IS 'Compiled reasoning layer. LLM-maintained wiki pages derived from canonical evidence; never source-of-truth.';



COMMENT ON COLUMN "public"."vanguard_wiki_pages"."source_refs" IS 'JSON array of cited evidence refs, e.g. [{table:"vanguard_stream", id:"...", date:"...", quote:"..."}].';



CREATE TABLE IF NOT EXISTS "public"."vanguard_wiki_review_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "page_id" "uuid",
    "item_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "detail" "text" NOT NULL,
    "action" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "source_refs" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vanguard_wiki_review_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['contradiction'::"text", 'stale_claim'::"text", 'weak_evidence'::"text", 'missing_source'::"text", 'merge_candidate'::"text", 'confirmation_needed'::"text", 'deep_research'::"text"]))),
    CONSTRAINT "vanguard_wiki_review_items_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "vanguard_wiki_review_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'accepted'::"text", 'rejected'::"text", 'snoozed'::"text", 'resolved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."vanguard_wiki_review_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."vanguard_wiki_review_items" IS 'Human review queue for contradictions, weak evidence, stale claims, and confirmation needs discovered by the wiki compiler.';



CREATE TABLE IF NOT EXISTS "public"."vanguard_wiki_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mode" "text" DEFAULT 'incremental'::"text" NOT NULL,
    "source_window" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "pages_upserted" integer DEFAULT 0 NOT NULL,
    "review_created" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vanguard_wiki_runs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."vanguard_wiki_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_wiki_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "page_id" "uuid" NOT NULL,
    "source_table" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "source_date" timestamp with time zone,
    "quote" "text",
    "relevance" numeric DEFAULT 0.7 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vanguard_wiki_sources_relevance_check" CHECK ((("relevance" >= (0)::numeric) AND ("relevance" <= (1)::numeric)))
);


ALTER TABLE "public"."vanguard_wiki_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vanguard_world_state" (
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "state_json" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vanguard_world_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."view_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "view_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."view_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vision_board_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'affirmation'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "color" "text" DEFAULT 'indigo'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vision_board_items_type_check" CHECK (("type" = ANY (ARRAY['affirmation'::"text", 'image'::"text", 'word'::"text"])))
);


ALTER TABLE "public"."vision_board_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "week_start" "date" NOT NULL,
    "proud_of" "text",
    "sabotage" "text",
    "do_differently" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "week_sentiment" "text",
    "focus_task_ids" "uuid"[],
    "bottleneck" "text",
    "focus_goal_mappings" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_recap" "jsonb",
    "pillar_scores" "jsonb",
    "obligation" "text",
    "deepening_answers" "jsonb",
    "review_completed_at" timestamp with time zone,
    "week_highlight" "text",
    "new_belief" "text",
    "week_regret" "text",
    "week_intention" "text",
    "week_commitment" "text",
    "week_goal_cialo" "text",
    "week_goal_duch" "text",
    "week_goal_konto" "text"
);


ALTER TABLE "public"."weekly_reviews" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_chat_messages"
    ADD CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aw_daily_summary"
    ADD CONSTRAINT "aw_daily_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aw_daily_summary"
    ADD CONSTRAINT "aw_daily_summary_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."behavior_log"
    ADD CONSTRAINT "behavior_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."behavior_log"
    ADD CONSTRAINT "behavior_log_user_id_date_behavior_key_key" UNIQUE ("user_id", "date", "behavior_key");



ALTER TABLE ONLY "public"."body_composition_measurements"
    ADD CONSTRAINT "body_composition_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_composition_measurements"
    ADD CONSTRAINT "body_composition_measurements_user_id_measured_at_source_key" UNIQUE ("user_id", "measured_at", "source");



ALTER TABLE ONLY "public"."body_metrics"
    ADD CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_metrics"
    ADD CONSTRAINT "body_metrics_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."daily_food_entries"
    ADD CONSTRAINT "daily_food_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_nutrition"
    ADD CONSTRAINT "daily_nutrition_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_nutrition"
    ADD CONSTRAINT "daily_nutrition_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."daily_reconciliations"
    ADD CONSTRAINT "daily_reconciliations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reconciliations"
    ADD CONSTRAINT "daily_reconciliations_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."daily_strain"
    ADD CONSTRAINT "daily_strain_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_strain"
    ADD CONSTRAINT "daily_strain_user_date_unique" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."daily_win_tasks"
    ADD CONSTRAINT "daily_win_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."dreams"
    ADD CONSTRAINT "dreams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."endmyopia_daily_logs"
    ADD CONSTRAINT "endmyopia_daily_logs_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."endmyopia_daily_logs"
    ADD CONSTRAINT "endmyopia_daily_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."endmyopia_measurements"
    ADD CONSTRAINT "endmyopia_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."endmyopia_prescriptions"
    ADD CONSTRAINT "endmyopia_prescriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fasting_logs"
    ADD CONSTRAINT "fasting_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fasting_logs"
    ADD CONSTRAINT "fasting_logs_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."food_corrections"
    ADD CONSTRAINT "food_corrections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_corrections"
    ADD CONSTRAINT "food_corrections_user_id_query_name_key" UNIQUE ("user_id", "query_name");



ALTER TABLE ONLY "public"."food_favorites"
    ADD CONSTRAINT "food_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_library"
    ADD CONSTRAINT "food_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."food_reference_pl"
    ADD CONSTRAINT "food_reference_pl_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."food_reference_pl"
    ADD CONSTRAINT "food_reference_pl_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friction_events"
    ADD CONSTRAINT "friction_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_kpis"
    ADD CONSTRAINT "goal_kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."habit_logs"
    ADD CONSTRAINT "habit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."habit_logs"
    ADD CONSTRAINT "habit_logs_user_id_habit_id_date_key" UNIQUE ("user_id", "habit_id", "date");



ALTER TABLE ONLY "public"."habits"
    ADD CONSTRAINT "habits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intervals_tokens"
    ADD CONSTRAINT "intervals_tokens_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."knowledge_insight_cards"
    ADD CONSTRAINT "knowledge_insight_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_entries"
    ADD CONSTRAINT "kpi_entries_kpi_id_week_start_key" UNIQUE ("kpi_id", "week_start");



ALTER TABLE ONLY "public"."kpi_entries"
    ADD CONSTRAINT "kpi_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_skill_snapshots"
    ADD CONSTRAINT "learning_skill_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_skill_snapshots"
    ADD CONSTRAINT "learning_skill_snapshots_user_id_snapshot_date_key" UNIQUE ("user_id", "snapshot_date");



ALTER TABLE ONLY "public"."learning_skills"
    ADD CONSTRAINT "learning_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_skills"
    ADD CONSTRAINT "learning_skills_user_id_key_key" UNIQUE ("user_id", "key");



ALTER TABLE ONLY "public"."learning_week_focus"
    ADD CONSTRAINT "learning_week_focus_pkey" PRIMARY KEY ("user_id", "week_start");



ALTER TABLE ONLY "public"."learning_week_pins"
    ADD CONSTRAINT "learning_week_pins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."life_goals"
    ADD CONSTRAINT "life_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."life_goals"
    ADD CONSTRAINT "life_goals_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."location_history"
    ADD CONSTRAINT "location_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."location_history"
    ADD CONSTRAINT "location_history_user_id_created_at_key" UNIQUE ("user_id", "created_at");



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_documents"
    ADD CONSTRAINT "medical_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_documents"
    ADD CONSTRAINT "medical_documents_user_id_source_name_document_date_key" UNIQUE ("user_id", "source_name", "document_date");



ALTER TABLE ONLY "public"."medical_lab_results"
    ADD CONSTRAINT "medical_lab_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_lab_results"
    ADD CONSTRAINT "medical_lab_results_user_id_result_date_marker_key_source_n_key" UNIQUE ("user_id", "result_date", "marker_key", "source_name");



ALTER TABLE ONLY "public"."monthly_reviews"
    ADD CONSTRAINT "monthly_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_reviews"
    ADD CONSTRAINT "monthly_reviews_user_id_month_start_key" UNIQUE ("user_id", "month_start");



ALTER TABLE ONLY "public"."morning_briefs"
    ADD CONSTRAINT "morning_briefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morning_briefs"
    ADD CONSTRAINT "morning_briefs_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."nutrition_profile"
    ADD CONSTRAINT "nutrition_profile_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."nutrition_targets"
    ADD CONSTRAINT "nutrition_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nutrition_targets"
    ADD CONSTRAINT "nutrition_targets_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."oracle_clarification_requests"
    ADD CONSTRAINT "oracle_clarification_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oracle_pending_actions"
    ADD CONSTRAINT "oracle_pending_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oura_daily_summary"
    ADD CONSTRAINT "oura_daily_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oura_daily_summary"
    ADD CONSTRAINT "oura_daily_summary_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."oura_enhanced"
    ADD CONSTRAINT "oura_enhanced_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oura_enhanced"
    ADD CONSTRAINT "oura_enhanced_user_date_unique" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."oura_heartrate"
    ADD CONSTRAINT "oura_heartrate_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oura_heartrate"
    ADD CONSTRAINT "oura_hr_unique" UNIQUE ("user_id", "ts", "source");



ALTER TABLE ONLY "public"."oura_sleep_hr_timeline"
    ADD CONSTRAINT "oura_sleep_hr_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oura_sleep_hr_timeline"
    ADD CONSTRAINT "oura_sleep_hr_unique" UNIQUE ("user_id", "sleep_id", "ts");



ALTER TABLE ONLY "public"."oura_sleep_hrv_timeline"
    ADD CONSTRAINT "oura_sleep_hrv_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oura_sleep_hrv_timeline"
    ADD CONSTRAINT "oura_sleep_hrv_unique" UNIQUE ("user_id", "sleep_id", "ts");



ALTER TABLE ONLY "public"."oura_sleep_phase_timeline"
    ADD CONSTRAINT "oura_sleep_phase_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oura_sleep_phase_timeline"
    ADD CONSTRAINT "oura_sleep_phase_unique" UNIQUE ("user_id", "sleep_id", "ts");



ALTER TABLE ONLY "public"."pattern_events"
    ADD CONSTRAINT "pattern_events_pattern_id_occurred_on_key" UNIQUE ("pattern_id", "occurred_on");



ALTER TABLE ONLY "public"."pattern_events"
    ADD CONSTRAINT "pattern_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phone_usage_daily"
    ADD CONSTRAINT "phone_usage_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phone_usage_daily"
    ADD CONSTRAINT "phone_usage_daily_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."progress_photos"
    ADD CONSTRAINT "progress_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."sprint_goals"
    ADD CONSTRAINT "sprint_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprint_goals"
    ADD CONSTRAINT "sprint_goals_unique" UNIQUE ("user_id", "personal_year", "sprint_number");



ALTER TABLE ONLY "public"."sprint_reviews"
    ADD CONSTRAINT "sprint_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sprint_reviews"
    ADD CONSTRAINT "sprint_reviews_user_id_personal_year_sprint_number_key" UNIQUE ("user_id", "personal_year", "sprint_number");



ALTER TABLE ONLY "public"."strava_activities"
    ADD CONSTRAINT "strava_activities_pkey" PRIMARY KEY ("strava_id");



ALTER TABLE ONLY "public"."strava_tokens"
    ADD CONSTRAINT "strava_tokens_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."supplement_logs"
    ADD CONSTRAINT "supplement_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplements"
    ADD CONSTRAINT "supplements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplements"
    ADD CONSTRAINT "supplements_user_id_slug_key" UNIQUE ("user_id", "slug");



ALTER TABLE ONLY "public"."system_proposals"
    ADD CONSTRAINT "system_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_proposals"
    ADD CONSTRAINT "system_proposals_user_id_dedupe_key_key" UNIQUE ("user_id", "dedupe_key");



ALTER TABLE ONLY "public"."todo_attachments"
    ADD CONSTRAINT "todo_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_items"
    ADD CONSTRAINT "todo_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_items"
    ADD CONSTRAINT "todo_items_user_id_section_id_title_key" UNIQUE ("user_id", "section_id", "title");



ALTER TABLE ONLY "public"."todo_sections"
    ADD CONSTRAINT "todo_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_sections"
    ADD CONSTRAINT "todo_sections_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."todo_smart_lists"
    ADD CONSTRAINT "todo_smart_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_plan_workouts"
    ADD CONSTRAINT "training_plan_workouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_entity_links"
    ADD CONSTRAINT "unique_entity_link" UNIQUE ("user_id", "source_entity", "relation", "target_entity");



ALTER TABLE ONLY "public"."user_fundament"
    ADD CONSTRAINT "user_fundament_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."vanguard_behavioral_patterns"
    ADD CONSTRAINT "vanguard_behavioral_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_calendar"
    ADD CONSTRAINT "vanguard_calendar_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."vanguard_calendar"
    ADD CONSTRAINT "vanguard_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_curiosity_queue"
    ADD CONSTRAINT "vanguard_curiosity_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_daily_aggregates"
    ADD CONSTRAINT "vanguard_daily_aggregates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_daily_aggregates"
    ADD CONSTRAINT "vanguard_daily_aggregates_user_id_date_key" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."vanguard_entity_aliases"
    ADD CONSTRAINT "vanguard_entity_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_entity_aliases"
    ADD CONSTRAINT "vanguard_entity_aliases_user_id_alias_key" UNIQUE ("user_id", "alias");



ALTER TABLE ONLY "public"."vanguard_entity_links"
    ADD CONSTRAINT "vanguard_entity_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_eval_questions"
    ADD CONSTRAINT "vanguard_eval_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_eval_results"
    ADD CONSTRAINT "vanguard_eval_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_eval_runs"
    ADD CONSTRAINT "vanguard_eval_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_feedback"
    ADD CONSTRAINT "vanguard_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_footprint"
    ADD CONSTRAINT "vanguard_footprint_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_identity"
    ADD CONSTRAINT "vanguard_identity_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."vanguard_knowledge"
    ADD CONSTRAINT "vanguard_knowledge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_links"
    ADD CONSTRAINT "vanguard_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_notes"
    ADD CONSTRAINT "vanguard_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_oracle_runs"
    ADD CONSTRAINT "vanguard_oracle_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_preferences"
    ADD CONSTRAINT "vanguard_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_preferences"
    ADD CONSTRAINT "vanguard_preferences_user_id_key_key" UNIQUE ("user_id", "key");



ALTER TABLE ONLY "public"."vanguard_raw_events"
    ADD CONSTRAINT "vanguard_raw_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_relation_ontology"
    ADD CONSTRAINT "vanguard_relation_ontology_pkey" PRIMARY KEY ("relation");



ALTER TABLE ONLY "public"."vanguard_stream"
    ADD CONSTRAINT "vanguard_stream_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_telegram_inbox"
    ADD CONSTRAINT "vanguard_telegram_inbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_time_budgets"
    ADD CONSTRAINT "vanguard_time_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_time_budgets"
    ADD CONSTRAINT "vanguard_time_budgets_user_id_category_key" UNIQUE ("user_id", "category");



ALTER TABLE ONLY "public"."vanguard_tokens"
    ADD CONSTRAINT "vanguard_tokens_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."vanguard_wiki_pages"
    ADD CONSTRAINT "vanguard_wiki_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_wiki_pages"
    ADD CONSTRAINT "vanguard_wiki_pages_user_id_slug_key" UNIQUE ("user_id", "slug");



ALTER TABLE ONLY "public"."vanguard_wiki_review_items"
    ADD CONSTRAINT "vanguard_wiki_review_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_wiki_runs"
    ADD CONSTRAINT "vanguard_wiki_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_wiki_sources"
    ADD CONSTRAINT "vanguard_wiki_sources_page_id_source_table_source_id_key" UNIQUE ("page_id", "source_table", "source_id");



ALTER TABLE ONLY "public"."vanguard_wiki_sources"
    ADD CONSTRAINT "vanguard_wiki_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vanguard_world_state"
    ADD CONSTRAINT "vanguard_world_state_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."view_events"
    ADD CONSTRAINT "view_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vision_board_items"
    ADD CONSTRAINT "vision_board_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_reviews"
    ADD CONSTRAINT "weekly_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_reviews"
    ADD CONSTRAINT "weekly_reviews_user_id_week_start_key" UNIQUE ("user_id", "week_start");



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_events_created_at_idx" ON "public"."audit_events" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_events_event_type_idx" ON "public"."audit_events" USING "btree" ("event_type");



CREATE INDEX "audit_events_severity_idx" ON "public"."audit_events" USING "btree" ("severity") WHERE ("severity" = ANY (ARRAY['error'::"text", 'critical'::"text"]));



CREATE INDEX "behavior_log_user_date" ON "public"."behavior_log" USING "btree" ("user_id", "date");



CREATE INDEX "behavior_log_user_key" ON "public"."behavior_log" USING "btree" ("user_id", "behavior_key");



CREATE UNIQUE INDEX "food_favorites_user_name_brand_key" ON "public"."food_favorites" USING "btree" ("user_id", "name", COALESCE("brand", ''::"text"));



CREATE UNIQUE INDEX "food_library_user_name_brand_key" ON "public"."food_library" USING "btree" ("user_id", "name", COALESCE("brand", ''::"text"));



CREATE INDEX "idx_body_composition_measurements_user_date" ON "public"."body_composition_measurements" USING "btree" ("user_id", "measured_at" DESC);



CREATE UNIQUE INDEX "idx_clarification_dedupe" ON "public"."oracle_clarification_requests" USING "btree" ("user_id", "dedupe_key") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_clarification_user_status" ON "public"."oracle_clarification_requests" USING "btree" ("user_id", "status");



CREATE INDEX "idx_daily_reconciliations_midday" ON "public"."daily_reconciliations" USING "btree" ("user_id", "midday_sent_at", "created_at" DESC);



CREATE INDEX "idx_daily_reconciliations_p2_parsed_not_null" ON "public"."daily_reconciliations" USING "btree" ("user_id", "date" DESC) WHERE ("p2_parsed" IS NOT NULL);



CREATE INDEX "idx_daily_reconciliations_planning" ON "public"."daily_reconciliations" USING "btree" ("user_id", "planning_status", "created_at" DESC);



CREATE INDEX "idx_daily_reconciliations_week_start" ON "public"."daily_reconciliations" USING "btree" ("user_id", "week_start");



CREATE INDEX "idx_daily_strain_user_date" ON "public"."daily_strain" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_daily_wins_embedding" ON "public"."daily_wins" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_daily_wins_week_start" ON "public"."daily_wins" USING "btree" ("user_id", "week_start");



CREATE INDEX "idx_dreams_user" ON "public"."dreams" USING "btree" ("user_id", "is_done", "category", "created_at");



CREATE INDEX "idx_endmyopia_daily_date" ON "public"."endmyopia_daily_logs" USING "btree" ("date" DESC);



CREATE INDEX "idx_endmyopia_daily_logs_user_id" ON "public"."endmyopia_daily_logs" USING "btree" ("user_id");



CREATE INDEX "idx_endmyopia_measured_at" ON "public"."endmyopia_measurements" USING "btree" ("measured_at" DESC);



CREATE INDEX "idx_endmyopia_measurements_user_id" ON "public"."endmyopia_measurements" USING "btree" ("user_id");



CREATE INDEX "idx_entity_aliases_user_alias" ON "public"."vanguard_entity_aliases" USING "btree" ("user_id", "lower"("alias"));



CREATE INDEX "idx_entity_links_active_lookup" ON "public"."vanguard_entity_links" USING "btree" ("user_id", "status", "layer", "source_entity", "target_entity") WHERE ("valid_until" IS NULL);



CREATE INDEX "idx_entity_links_embedding" ON "public"."vanguard_entity_links" USING "hnsw" ("embedding" "public"."vector_cosine_ops") WHERE ("embedding" IS NOT NULL);



CREATE INDEX "idx_entity_links_fact_text_fts" ON "public"."vanguard_entity_links" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("fact_text", ''::"text")));



CREATE INDEX "idx_entity_links_layer" ON "public"."vanguard_entity_links" USING "btree" ("layer");



CREATE INDEX "idx_entity_links_metadata" ON "public"."vanguard_entity_links" USING "gin" ("metadata");



CREATE INDEX "idx_entity_links_source_trgm" ON "public"."vanguard_entity_links" USING "gin" ("source_entity" "public"."gin_trgm_ops");



CREATE INDEX "idx_entity_links_target_trgm" ON "public"."vanguard_entity_links" USING "gin" ("target_entity" "public"."gin_trgm_ops");



CREATE INDEX "idx_entity_links_user_source" ON "public"."vanguard_entity_links" USING "btree" ("user_id", "source_entity");



CREATE INDEX "idx_entity_links_user_target" ON "public"."vanguard_entity_links" USING "btree" ("user_id", "target_entity");



CREATE INDEX "idx_exercise_logs_muscle_tags" ON "public"."exercise_logs" USING "gin" ("muscle_tags");



CREATE INDEX "idx_fasting_logs_user_date" ON "public"."fasting_logs" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_feedback_message_id" ON "public"."vanguard_feedback" USING "btree" ("message_id");



CREATE INDEX "idx_feedback_user_id" ON "public"."vanguard_feedback" USING "btree" ("user_id");



CREATE INDEX "idx_food_corrections_user" ON "public"."food_corrections" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_food_entries_user_date" ON "public"."daily_food_entries" USING "btree" ("user_id", "date");



CREATE INDEX "idx_food_favorites_user_last_used" ON "public"."food_favorites" USING "btree" ("user_id", "last_used" DESC);



CREATE INDEX "idx_food_favorites_user_pinned" ON "public"."food_favorites" USING "btree" ("user_id", "is_pinned" DESC, "use_count" DESC);



CREATE INDEX "idx_friction_events_event_kind" ON "public"."friction_events" USING "btree" ("user_id", "event_kind", "occurred_at" DESC);



CREATE INDEX "idx_friction_events_friction_type_idx" ON "public"."friction_events" USING "btree" ("user_id", "friction_type", "occurred_at" DESC);



CREATE INDEX "idx_friction_events_status" ON "public"."friction_events" USING "btree" ("user_id", "status");



CREATE INDEX "idx_friction_events_status_idx" ON "public"."friction_events" USING "btree" ("user_id", "status", "occurred_at" DESC);



CREATE INDEX "idx_friction_events_type" ON "public"."friction_events" USING "btree" ("user_id", "friction_type");



CREATE UNIQUE INDEX "idx_friction_events_unique_stream_record" ON "public"."friction_events" USING "btree" ("stream_record_id") WHERE ("stream_record_id" IS NOT NULL);



CREATE INDEX "idx_friction_events_user_occurred" ON "public"."friction_events" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "idx_habit_logs_user_habit_date" ON "public"."habit_logs" USING "btree" ("user_id", "habit_id", "date" DESC);



CREATE INDEX "idx_insight_cards_user" ON "public"."knowledge_insight_cards" USING "btree" ("user_id", "sort_order", "is_pinned");



CREATE INDEX "idx_learning_skill_snapshots_user_date" ON "public"."learning_skill_snapshots" USING "btree" ("user_id", "snapshot_date" DESC);



CREATE INDEX "idx_learning_skills_parent" ON "public"."learning_skills" USING "btree" ("user_id", "parent_id", "sort_order") WHERE ("active" = true);



CREATE INDEX "idx_learning_skills_user_active" ON "public"."learning_skills" USING "btree" ("user_id", "active", "sort_order");



CREATE INDEX "idx_learning_week_focus_user_week" ON "public"."learning_week_focus" USING "btree" ("user_id", "week_start");



CREATE INDEX "idx_learning_week_pins_project" ON "public"."learning_week_pins" USING "btree" ("project_id");



CREATE INDEX "idx_learning_week_pins_user_week" ON "public"."learning_week_pins" USING "btree" ("user_id", "week_start", "slot", "sort_order");



CREATE INDEX "idx_location_user_date" ON "public"."location_history" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_mcp_servers_user_id" ON "public"."mcp_servers" USING "btree" ("user_id");



CREATE INDEX "idx_medical_lab_results_marker" ON "public"."medical_lab_results" USING "btree" ("user_id", "marker_key", "result_date" DESC);



CREATE INDEX "idx_medical_lab_results_user_date" ON "public"."medical_lab_results" USING "btree" ("user_id", "result_date" DESC);



CREATE INDEX "idx_nutrition_targets_user_date" ON "public"."nutrition_targets" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_opa_user_status" ON "public"."oracle_pending_actions" USING "btree" ("user_id", "status");



CREATE INDEX "idx_oracle_runs_intent" ON "public"."vanguard_oracle_runs" USING "btree" ("intent");



CREATE INDEX "idx_oracle_runs_user_date" ON "public"."vanguard_oracle_runs" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_oura_enhanced_user_date" ON "public"."oura_enhanced" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_oura_hr_user_ts" ON "public"."oura_heartrate" USING "btree" ("user_id", "ts" DESC);



CREATE INDEX "idx_oura_sleep_hr_user_day" ON "public"."oura_sleep_hr_timeline" USING "btree" ("user_id", "day" DESC);



CREATE INDEX "idx_oura_sleep_hrv_user_day" ON "public"."oura_sleep_hrv_timeline" USING "btree" ("user_id", "day" DESC);



CREATE INDEX "idx_oura_sleep_phase_user_day" ON "public"."oura_sleep_phase_timeline" USING "btree" ("user_id", "day" DESC);



CREATE INDEX "idx_oura_user_date_desc" ON "public"."oura_daily_summary" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_projects_primary_skill" ON "public"."projects" USING "btree" ("primary_skill_id") WHERE ("primary_skill_id" IS NOT NULL);



CREATE INDEX "idx_strava_activities_user_date" ON "public"."strava_activities" USING "btree" ("user_id", "start_date" DESC);



CREATE INDEX "idx_strava_hr_source" ON "public"."strava_activities" USING "btree" ("user_id", "hr_source") WHERE ("hr_source" IS NOT NULL);



CREATE INDEX "idx_strava_oura_dup" ON "public"."strava_activities" USING "btree" ("user_id", "is_oura_duplicate", "start_date");



CREATE INDEX "idx_system_proposals_user_pending" ON "public"."system_proposals" USING "btree" ("user_id", "created_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_todo_attachments_todo_item_id" ON "public"."todo_attachments" USING "btree" ("todo_item_id");



CREATE INDEX "idx_todo_attachments_user_id" ON "public"."todo_attachments" USING "btree" ("user_id");



CREATE INDEX "idx_todo_items_ai_bucket" ON "public"."todo_items" USING "btree" ("user_id", "ai_bucket", "status") WHERE ("status" = 'open'::"text");



CREATE INDEX "idx_todo_items_due" ON "public"."todo_items" USING "btree" ("user_id", "due_date") WHERE (("due_date" IS NOT NULL) AND ("status" = 'open'::"text"));



CREATE INDEX "idx_todo_items_parent_task_id" ON "public"."todo_items" USING "btree" ("parent_task_id");



CREATE INDEX "idx_todo_items_scheduled_time" ON "public"."todo_items" USING "btree" ("user_id", "scheduled_time") WHERE ("scheduled_time" IS NOT NULL);



CREATE INDEX "idx_todo_items_section_status" ON "public"."todo_items" USING "btree" ("section_id", "status", "sort_order", "created_at");



CREATE INDEX "idx_todo_items_user_status" ON "public"."todo_items" USING "btree" ("user_id", "status", "priority", "created_at" DESC);



CREATE INDEX "idx_todo_sections_user_order" ON "public"."todo_sections" USING "btree" ("user_id", "is_archived", "sort_order", "created_at");



CREATE INDEX "idx_todo_smart_lists_user_id" ON "public"."todo_smart_lists" USING "btree" ("user_id");



CREATE INDEX "idx_training_plan_user_date" ON "public"."training_plan_workouts" USING "btree" ("user_id", "planned_date");



CREATE INDEX "idx_user_fundament_embedding" ON "public"."user_fundament" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_vanguard_behavioral_patterns_user_status" ON "public"."vanguard_behavioral_patterns" USING "btree" ("user_id", "status", "last_seen" DESC);



CREATE INDEX "idx_vanguard_behavioral_patterns_user_type" ON "public"."vanguard_behavioral_patterns" USING "btree" ("user_id", "pattern_type", "confidence" DESC);



CREATE INDEX "idx_vanguard_curiosity_confidence" ON "public"."vanguard_curiosity_queue" USING "btree" ("confidence_score" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_vanguard_curiosity_queue_user_id" ON "public"."vanguard_curiosity_queue" USING "btree" ("user_id");



CREATE INDEX "idx_vanguard_entity_aliases_user_id" ON "public"."vanguard_entity_aliases" USING "btree" ("user_id");



CREATE INDEX "idx_vanguard_eval_questions_tags" ON "public"."vanguard_eval_questions" USING "gin" ("tags");



CREATE INDEX "idx_vanguard_eval_questions_user_suite" ON "public"."vanguard_eval_questions" USING "btree" ("user_id", "suite", "is_active");



CREATE INDEX "idx_vanguard_eval_results_run" ON "public"."vanguard_eval_results" USING "btree" ("run_id");



CREATE INDEX "idx_vanguard_eval_results_user_created" ON "public"."vanguard_eval_results" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_vanguard_eval_runs_user_started" ON "public"."vanguard_eval_runs" USING "btree" ("user_id", "started_at" DESC);



CREATE INDEX "idx_vanguard_knowledge_category" ON "public"."vanguard_knowledge" USING "btree" ("category");



CREATE INDEX "idx_vanguard_knowledge_embedding" ON "public"."vanguard_knowledge" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_vanguard_knowledge_metadata" ON "public"."vanguard_knowledge" USING "gin" ("metadata");



CREATE INDEX "idx_vanguard_knowledge_user" ON "public"."vanguard_knowledge" USING "btree" ("user_id");



CREATE INDEX "idx_vanguard_links_created_at" ON "public"."vanguard_links" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_vanguard_links_status" ON "public"."vanguard_links" USING "btree" ("status");



CREATE INDEX "idx_vanguard_links_user_id" ON "public"."vanguard_links" USING "btree" ("user_id");



CREATE INDEX "idx_vanguard_links_user_status_created" ON "public"."vanguard_links" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE INDEX "idx_vanguard_notes_created_at" ON "public"."vanguard_notes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_vanguard_notes_is_pinned" ON "public"."vanguard_notes" USING "btree" ("is_pinned" DESC);



CREATE INDEX "idx_vanguard_notes_user_id" ON "public"."vanguard_notes" USING "btree" ("user_id");



CREATE INDEX "idx_vanguard_notes_user_pinned" ON "public"."vanguard_notes" USING "btree" ("user_id", "is_pinned" DESC, "created_at" DESC);



CREATE INDEX "idx_vanguard_preferences_user_id" ON "public"."vanguard_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_vanguard_raw_events_metadata_gin" ON "public"."vanguard_raw_events" USING "gin" ("metadata");



CREATE INDEX "idx_vanguard_raw_events_payload_gin" ON "public"."vanguard_raw_events" USING "gin" ("payload");



CREATE INDEX "idx_vanguard_raw_events_user_ingested" ON "public"."vanguard_raw_events" USING "btree" ("user_id", "ingested_at" DESC);



CREATE INDEX "idx_vanguard_raw_events_user_occurred" ON "public"."vanguard_raw_events" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "idx_vanguard_raw_events_user_source" ON "public"."vanguard_raw_events" USING "btree" ("user_id", "source", "event_type");



CREATE INDEX "idx_vanguard_stream_embedding" ON "public"."vanguard_stream" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE UNIQUE INDEX "idx_vanguard_stream_eval_interview_dedup" ON "public"."vanguard_stream" USING "btree" ("user_id", (("metadata" ->> 'eval_question_id'::"text"))) WHERE (("source" = 'eval_interview'::"text") AND (("metadata" ->> 'eval_question_id'::"text") IS NOT NULL));



CREATE INDEX "idx_vanguard_stream_fingerprint" ON "public"."vanguard_stream" USING "hnsw" ("situation_fingerprint" "public"."vector_cosine_ops");



CREATE INDEX "idx_vanguard_stream_user_created_at" ON "public"."vanguard_stream" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_vanguard_stream_validity" ON "public"."vanguard_stream" USING "btree" ("valid_until") WHERE ("valid_until" IS NULL);



CREATE INDEX "idx_vanguard_time_budgets_user_id" ON "public"."vanguard_time_budgets" USING "btree" ("user_id");



CREATE INDEX "idx_vanguard_wiki_pages_user_confidence" ON "public"."vanguard_wiki_pages" USING "btree" ("user_id", "confidence" DESC, "last_compiled_at" DESC);



CREATE INDEX "idx_vanguard_wiki_pages_user_type" ON "public"."vanguard_wiki_pages" USING "btree" ("user_id", "page_type", "status", "last_compiled_at" DESC);



CREATE INDEX "idx_vanguard_wiki_review_user_status" ON "public"."vanguard_wiki_review_items" USING "btree" ("user_id", "status", "severity", "created_at" DESC);



CREATE INDEX "idx_vanguard_wiki_runs_user_created" ON "public"."vanguard_wiki_runs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_vanguard_wiki_sources_user_source" ON "public"."vanguard_wiki_sources" USING "btree" ("user_id", "source_table", "source_id");



CREATE INDEX "idx_vanguard_world_state_date" ON "public"."vanguard_world_state" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_vbi_user" ON "public"."vision_board_items" USING "btree" ("user_id", "sort_order", "created_at");



CREATE UNIQUE INDEX "idx_vbp_user_signature" ON "public"."vanguard_behavioral_patterns" USING "btree" ("user_id", "signature");



CREATE INDEX "idx_vbp_user_status" ON "public"."vanguard_behavioral_patterns" USING "btree" ("user_id", "status");



CREATE INDEX "idx_vbp_user_type" ON "public"."vanguard_behavioral_patterns" USING "btree" ("user_id", "pattern_type");



CREATE INDEX "idx_vel_deprecation_lookup" ON "public"."vanguard_entity_links" USING "btree" ("user_id", "source_entity", "relation", "status") WHERE (("status" = 'active'::"text") AND ("valid_until" IS NULL));



CREATE INDEX "idx_weekly_reviews_user_week" ON "public"."weekly_reviews" USING "btree" ("user_id", "week_start");



CREATE INDEX "idx_workout_sessions_embedding" ON "public"."workout_sessions" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "kpis_goal_id_idx" ON "public"."goal_kpis" USING "btree" ("goal_id");



CREATE INDEX "monthly_reviews_user_month_idx" ON "public"."monthly_reviews" USING "btree" ("user_id", "month_start" DESC);



CREATE INDEX "projects_goal_id_idx" ON "public"."projects" USING "btree" ("goal_id");



CREATE INDEX "sprint_reviews_user_year_idx" ON "public"."sprint_reviews" USING "btree" ("user_id", "personal_year", "sprint_number");



CREATE INDEX "strava_activities_gc_activity_id_idx" ON "public"."strava_activities" USING "btree" ("gc_activity_id");



CREATE INDEX "supplement_logs_user_date" ON "public"."supplement_logs" USING "btree" ("user_id", "date");



CREATE INDEX "todo_items_is_milestone_idx" ON "public"."todo_items" USING "btree" ("is_milestone");



CREATE INDEX "todo_items_project_id_idx" ON "public"."todo_items" USING "btree" ("project_id");



CREATE INDEX "todo_items_reminder_idx" ON "public"."todo_items" USING "btree" ("reminder_at") WHERE (("reminder_at" IS NOT NULL) AND ("reminder_sent" = false) AND ("status" <> 'done'::"text"));



CREATE UNIQUE INDEX "uq_vanguard_behavioral_patterns_user_signature" ON "public"."vanguard_behavioral_patterns" USING "btree" ("user_id", "signature");



CREATE UNIQUE INDEX "ux_vanguard_eval_results_run_question" ON "public"."vanguard_eval_results" USING "btree" ("run_id", "question_id");



CREATE UNIQUE INDEX "ux_vanguard_raw_events_hash" ON "public"."vanguard_raw_events" USING "btree" ("user_id", "raw_hash") WHERE ("raw_hash" IS NOT NULL);



CREATE UNIQUE INDEX "ux_vanguard_raw_events_source_ref" ON "public"."vanguard_raw_events" USING "btree" ("user_id", "source", "source_ref") WHERE ("source_ref" IS NOT NULL);



CREATE OR REPLACE TRIGGER "tr_vanguard_auto_classify" AFTER INSERT ON "public"."vanguard_stream" FOR EACH ROW WHEN (("new"."source" IS DISTINCT FROM 'system'::"text")) EXECUTE FUNCTION "public"."trigger_vanguard_classification"();



CREATE OR REPLACE TRIGGER "tr_vanguard_telegram_queue" AFTER INSERT ON "public"."vanguard_telegram_inbox" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_vanguard_telegram_worker"();



CREATE OR REPLACE TRIGGER "trg_body_composition_measurements_updated_at" BEFORE UPDATE ON "public"."body_composition_measurements" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_medical_documents_updated_at" BEFORE UPDATE ON "public"."medical_documents" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_medical_lab_results_updated_at" BEFORE UPDATE ON "public"."medical_lab_results" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_navy_bf" BEFORE INSERT OR UPDATE OF "neck", "waist", "hips" ON "public"."body_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."compute_navy_bf"();



CREATE OR REPLACE TRIGGER "trg_nutrition_profile_updated_at" BEFORE UPDATE ON "public"."nutrition_profile" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_nutrition_targets_updated_at" BEFORE UPDATE ON "public"."nutrition_targets" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_daily_win_tasks" AFTER INSERT OR DELETE OR UPDATE ON "public"."daily_win_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."sync_daily_win_tasks_to_daily_wins"();



CREATE OR REPLACE TRIGGER "trg_sync_daily_wins" AFTER INSERT OR UPDATE ON "public"."daily_wins" FOR EACH ROW EXECUTE FUNCTION "public"."sync_daily_wins_to_daily_win_tasks"();



CREATE OR REPLACE TRIGGER "trg_sync_link_read_to_growth_pins" AFTER UPDATE ON "public"."vanguard_links" FOR EACH ROW EXECUTE FUNCTION "public"."sync_link_read_to_growth_pins"();



CREATE OR REPLACE TRIGGER "trg_sync_todo_done_to_growth_pins" AFTER UPDATE ON "public"."todo_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_todo_done_to_growth_pins"();



CREATE OR REPLACE TRIGGER "trg_todo_items_updated_at" BEFORE UPDATE ON "public"."todo_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_todo_sections_updated_at" BEFORE UPDATE ON "public"."todo_sections" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_check_vanguard_relation" BEFORE INSERT OR UPDATE OF "relation" ON "public"."vanguard_entity_links" FOR EACH ROW EXECUTE FUNCTION "public"."check_vanguard_relation_ontology"();



CREATE OR REPLACE TRIGGER "trigger_verify_knowledge" BEFORE INSERT OR UPDATE ON "public"."vanguard_knowledge" FOR EACH ROW EXECUTE FUNCTION "public"."verify_vanguard_knowledge"();



ALTER TABLE ONLY "public"."ai_chat_messages"
    ADD CONSTRAINT "ai_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."aw_daily_summary"
    ADD CONSTRAINT "aw_daily_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."behavior_log"
    ADD CONSTRAINT "behavior_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."body_composition_measurements"
    ADD CONSTRAINT "body_composition_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."body_metrics"
    ADD CONSTRAINT "body_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_food_entries"
    ADD CONSTRAINT "daily_food_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_nutrition"
    ADD CONSTRAINT "daily_nutrition_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_strain"
    ADD CONSTRAINT "daily_strain_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_win_tasks"
    ADD CONSTRAINT "daily_win_tasks_day_win_id_fkey" FOREIGN KEY ("day_win_id") REFERENCES "public"."daily_wins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_win_tasks"
    ADD CONSTRAINT "daily_win_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_1_checkpoint_id_fkey" FOREIGN KEY ("task_1_checkpoint_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_1_pin_id_fkey" FOREIGN KEY ("task_1_pin_id") REFERENCES "public"."learning_week_pins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_1_project_id_fkey" FOREIGN KEY ("task_1_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_1_todo_id_fkey" FOREIGN KEY ("task_1_todo_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_2_checkpoint_id_fkey" FOREIGN KEY ("task_2_checkpoint_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_2_pin_id_fkey" FOREIGN KEY ("task_2_pin_id") REFERENCES "public"."learning_week_pins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_2_project_id_fkey" FOREIGN KEY ("task_2_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_2_todo_id_fkey" FOREIGN KEY ("task_2_todo_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_3_checkpoint_id_fkey" FOREIGN KEY ("task_3_checkpoint_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_3_pin_id_fkey" FOREIGN KEY ("task_3_pin_id") REFERENCES "public"."learning_week_pins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_3_project_id_fkey" FOREIGN KEY ("task_3_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_3_todo_id_fkey" FOREIGN KEY ("task_3_todo_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_4_checkpoint_id_fkey" FOREIGN KEY ("task_4_checkpoint_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_4_pin_id_fkey" FOREIGN KEY ("task_4_pin_id") REFERENCES "public"."learning_week_pins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_4_project_id_fkey" FOREIGN KEY ("task_4_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_4_todo_id_fkey" FOREIGN KEY ("task_4_todo_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_5_checkpoint_id_fkey" FOREIGN KEY ("task_5_checkpoint_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_5_pin_id_fkey" FOREIGN KEY ("task_5_pin_id") REFERENCES "public"."learning_week_pins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_5_project_id_fkey" FOREIGN KEY ("task_5_project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_task_5_todo_id_fkey" FOREIGN KEY ("task_5_todo_id") REFERENCES "public"."todo_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_wins"
    ADD CONSTRAINT "daily_wins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dreams"
    ADD CONSTRAINT "dreams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."endmyopia_daily_logs"
    ADD CONSTRAINT "endmyopia_daily_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."endmyopia_measurements"
    ADD CONSTRAINT "endmyopia_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."endmyopia_prescriptions"
    ADD CONSTRAINT "endmyopia_prescriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercise_logs"
    ADD CONSTRAINT "exercise_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fasting_logs"
    ADD CONSTRAINT "fasting_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."food_library"
    ADD CONSTRAINT "food_library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friction_events"
    ADD CONSTRAINT "friction_events_stream_record_id_fkey" FOREIGN KEY ("stream_record_id") REFERENCES "public"."vanguard_stream"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_kpis"
    ADD CONSTRAINT "goal_kpis_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_kpis"
    ADD CONSTRAINT "goal_kpis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habit_logs"
    ADD CONSTRAINT "habit_logs_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habit_logs"
    ADD CONSTRAINT "habit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."habits"
    ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_insight_cards"
    ADD CONSTRAINT "knowledge_insight_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_entries"
    ADD CONSTRAINT "kpi_entries_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "public"."goal_kpis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_entries"
    ADD CONSTRAINT "kpi_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_skill_snapshots"
    ADD CONSTRAINT "learning_skill_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_skills"
    ADD CONSTRAINT "learning_skills_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."learning_skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_skills"
    ADD CONSTRAINT "learning_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_week_focus"
    ADD CONSTRAINT "learning_week_focus_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."learning_skills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_week_focus"
    ADD CONSTRAINT "learning_week_focus_subskill_id_fkey" FOREIGN KEY ("subskill_id") REFERENCES "public"."learning_skills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_week_focus"
    ADD CONSTRAINT "learning_week_focus_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_week_pins"
    ADD CONSTRAINT "learning_week_pins_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_week_pins"
    ADD CONSTRAINT "learning_week_pins_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."learning_skills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_week_pins"
    ADD CONSTRAINT "learning_week_pins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."life_goals"
    ADD CONSTRAINT "life_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_history"
    ADD CONSTRAINT "location_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."medical_documents"
    ADD CONSTRAINT "medical_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_lab_results"
    ADD CONSTRAINT "medical_lab_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_reviews"
    ADD CONSTRAINT "monthly_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."morning_briefs"
    ADD CONSTRAINT "morning_briefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_profile"
    ADD CONSTRAINT "nutrition_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."nutrition_targets"
    ADD CONSTRAINT "nutrition_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oracle_clarification_requests"
    ADD CONSTRAINT "oracle_clarification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oracle_pending_actions"
    ADD CONSTRAINT "oracle_pending_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oura_daily_summary"
    ADD CONSTRAINT "oura_daily_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oura_enhanced"
    ADD CONSTRAINT "oura_enhanced_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oura_heartrate"
    ADD CONSTRAINT "oura_heartrate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oura_sleep_hr_timeline"
    ADD CONSTRAINT "oura_sleep_hr_timeline_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oura_sleep_hrv_timeline"
    ADD CONSTRAINT "oura_sleep_hrv_timeline_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oura_sleep_phase_timeline"
    ADD CONSTRAINT "oura_sleep_phase_timeline_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pattern_events"
    ADD CONSTRAINT "pattern_events_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "public"."vanguard_behavioral_patterns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_usage_daily"
    ADD CONSTRAINT "phone_usage_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."progress_photos"
    ADD CONSTRAINT "progress_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "public"."dreams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_primary_skill_id_fkey" FOREIGN KEY ("primary_skill_id") REFERENCES "public"."learning_skills"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_goals"
    ADD CONSTRAINT "sprint_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sprint_reviews"
    ADD CONSTRAINT "sprint_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strava_activities"
    ADD CONSTRAINT "strava_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strava_tokens"
    ADD CONSTRAINT "strava_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplement_logs"
    ADD CONSTRAINT "supplement_logs_supplement_id_fkey" FOREIGN KEY ("supplement_id") REFERENCES "public"."supplements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplement_logs"
    ADD CONSTRAINT "supplement_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplements"
    ADD CONSTRAINT "supplements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_proposals"
    ADD CONSTRAINT "system_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_attachments"
    ADD CONSTRAINT "todo_attachments_todo_item_id_fkey" FOREIGN KEY ("todo_item_id") REFERENCES "public"."todo_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_attachments"
    ADD CONSTRAINT "todo_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_items"
    ADD CONSTRAINT "todo_items_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."todo_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_items"
    ADD CONSTRAINT "todo_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_items"
    ADD CONSTRAINT "todo_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."todo_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."todo_items"
    ADD CONSTRAINT "todo_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_sections"
    ADD CONSTRAINT "todo_sections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."todo_sections"
    ADD CONSTRAINT "todo_sections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_smart_lists"
    ADD CONSTRAINT "todo_smart_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plan_workouts"
    ADD CONSTRAINT "training_plan_workouts_strava_activity_id_fkey" FOREIGN KEY ("strava_activity_id") REFERENCES "public"."strava_activities"("strava_id");



ALTER TABLE ONLY "public"."training_plan_workouts"
    ADD CONSTRAINT "training_plan_workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_fundament"
    ADD CONSTRAINT "user_fundament_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_behavioral_patterns"
    ADD CONSTRAINT "vanguard_behavioral_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_calendar"
    ADD CONSTRAINT "vanguard_calendar_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_curiosity_queue"
    ADD CONSTRAINT "vanguard_curiosity_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_daily_aggregates"
    ADD CONSTRAINT "vanguard_daily_aggregates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_entity_aliases"
    ADD CONSTRAINT "vanguard_entity_aliases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_entity_links"
    ADD CONSTRAINT "vanguard_entity_links_relation_fkey" FOREIGN KEY ("relation") REFERENCES "public"."vanguard_relation_ontology"("relation") NOT VALID;



ALTER TABLE ONLY "public"."vanguard_entity_links"
    ADD CONSTRAINT "vanguard_entity_links_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."vanguard_entity_links"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."vanguard_entity_links"
    ADD CONSTRAINT "vanguard_entity_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_eval_questions"
    ADD CONSTRAINT "vanguard_eval_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_eval_results"
    ADD CONSTRAINT "vanguard_eval_results_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."vanguard_eval_questions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vanguard_eval_results"
    ADD CONSTRAINT "vanguard_eval_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."vanguard_eval_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_eval_results"
    ADD CONSTRAINT "vanguard_eval_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_eval_runs"
    ADD CONSTRAINT "vanguard_eval_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_feedback"
    ADD CONSTRAINT "vanguard_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_footprint"
    ADD CONSTRAINT "vanguard_footprint_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_identity"
    ADD CONSTRAINT "vanguard_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_knowledge"
    ADD CONSTRAINT "vanguard_knowledge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_links"
    ADD CONSTRAINT "vanguard_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_notes"
    ADD CONSTRAINT "vanguard_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_oracle_runs"
    ADD CONSTRAINT "vanguard_oracle_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_preferences"
    ADD CONSTRAINT "vanguard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_raw_events"
    ADD CONSTRAINT "vanguard_raw_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_stream"
    ADD CONSTRAINT "vanguard_stream_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vanguard_time_budgets"
    ADD CONSTRAINT "vanguard_time_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_tokens"
    ADD CONSTRAINT "vanguard_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_wiki_pages"
    ADD CONSTRAINT "vanguard_wiki_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_wiki_review_items"
    ADD CONSTRAINT "vanguard_wiki_review_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."vanguard_wiki_pages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vanguard_wiki_review_items"
    ADD CONSTRAINT "vanguard_wiki_review_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_wiki_runs"
    ADD CONSTRAINT "vanguard_wiki_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_wiki_sources"
    ADD CONSTRAINT "vanguard_wiki_sources_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."vanguard_wiki_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_wiki_sources"
    ADD CONSTRAINT "vanguard_wiki_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vanguard_world_state"
    ADD CONSTRAINT "vanguard_world_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."view_events"
    ADD CONSTRAINT "view_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vision_board_items"
    ADD CONSTRAINT "vision_board_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_reviews"
    ADD CONSTRAINT "weekly_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_sessions"
    ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow full access to service_role on endmyopia_daily_logs" ON "public"."endmyopia_daily_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow full access to service_role on endmyopia_measurements" ON "public"."endmyopia_measurements" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow service role access" ON "public"."vanguard_telegram_inbox" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated read relation ontology" ON "public"."vanguard_relation_ontology" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Dashboard read access" ON "public"."vanguard_entity_links" FOR SELECT USING (("user_id" = '165ae341-670c-46ce-82dc-434c4dbfcdfd'::"uuid"));



CREATE POLICY "Service role bypass behavioral patterns" ON "public"."vanguard_behavioral_patterns" TO "service_role" USING (true);



CREATE POLICY "Service role bypass curiosity_queue" ON "public"."vanguard_curiosity_queue" TO "service_role" USING (true);



CREATE POLICY "Service role bypass daily_wins" ON "public"."daily_wins" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass feedback" ON "public"."vanguard_feedback" TO "service_role" USING (true);



CREATE POLICY "Service role bypass friction_events" ON "public"."friction_events" TO "service_role" USING (true);



CREATE POLICY "Service role bypass fundament" ON "public"."user_fundament" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass nutrition" ON "public"."daily_nutrition" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass oura" ON "public"."oura_daily_summary" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role bypass reconciliations" ON "public"."daily_reconciliations" TO "service_role" USING (true);



CREATE POLICY "Service role bypass relation_ontology" ON "public"."vanguard_relation_ontology" TO "service_role" USING (true);



CREATE POLICY "Service role bypass strava_activities" ON "public"."strava_activities" TO "service_role" USING (true);



CREATE POLICY "Service role bypass training_plan" ON "public"."training_plan_workouts" TO "service_role" USING (true);



CREATE POLICY "Service role bypass wiki pages" ON "public"."vanguard_wiki_pages" TO "service_role" USING (true);



CREATE POLICY "Service role bypass wiki review items" ON "public"."vanguard_wiki_review_items" TO "service_role" USING (true);



CREATE POLICY "Service role bypass wiki runs" ON "public"."vanguard_wiki_runs" TO "service_role" USING (true);



CREATE POLICY "Service role bypass wiki sources" ON "public"."vanguard_wiki_sources" TO "service_role" USING (true);



CREATE POLICY "Service role bypass world state" ON "public"."vanguard_world_state" USING (true);



CREATE POLICY "Service role only intervals_tokens" ON "public"."intervals_tokens" TO "service_role" USING (true);



CREATE POLICY "Service role only strava_tokens" ON "public"."strava_tokens" TO "service_role" USING (true);



CREATE POLICY "Users can delete own prescriptions" ON "public"."endmyopia_prescriptions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own prescriptions" ON "public"."endmyopia_prescriptions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own behavioral patterns" ON "public"."vanguard_behavioral_patterns" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own phone usage" ON "public"."phone_usage_daily" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own body metrics" ON "public"."body_metrics" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own chat messages" ON "public"."ai_chat_messages" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own daily wins" ON "public"."daily_wins" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own exercise logs" ON "public"."exercise_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own food entries" ON "public"."daily_food_entries" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own habit logs" ON "public"."habit_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own habits" ON "public"."habits" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own identity" ON "public"."vanguard_identity" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own life goals" ON "public"."life_goals" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own location history" ON "public"."location_history" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own mcp_servers" ON "public"."mcp_servers" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own nutrition data" ON "public"."daily_nutrition" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own photos" ON "public"."progress_photos" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own sessions" ON "public"."workout_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own stream" ON "public"."vanguard_stream" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own time budgets" ON "public"."vanguard_time_budgets" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own weekly reviews" ON "public"."weekly_reviews" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own prescriptions" ON "public"."endmyopia_prescriptions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own prescriptions" ON "public"."endmyopia_prescriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own fundament" ON "public"."user_fundament" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own learning_skill_snapshots" ON "public"."learning_skill_snapshots" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own learning_skills" ON "public"."learning_skills" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own learning_week_focus" ON "public"."learning_week_focus" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own learning_week_pins" ON "public"."learning_week_pins" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own links" ON "public"."vanguard_links" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own notes" ON "public"."vanguard_notes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own oura" ON "public"."oura_daily_summary" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own settings" ON "public"."user_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own wiki pages" ON "public"."vanguard_wiki_pages" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own wiki review items" ON "public"."vanguard_wiki_review_items" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own wiki sources" ON "public"."vanguard_wiki_sources" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage their own endmyopia_daily_logs" ON "public"."endmyopia_daily_logs" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage their own endmyopia_measurements" ON "public"."endmyopia_measurements" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage their own smart lists" ON "public"."todo_smart_lists" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage their own todo attachments" ON "public"."todo_attachments" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users own daily wins" ON "public"."daily_wins" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own entity aliases" ON "public"."vanguard_entity_aliases" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users own eval questions" ON "public"."vanguard_eval_questions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own eval results" ON "public"."vanguard_eval_results" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own eval runs" ON "public"."vanguard_eval_runs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own footprint" ON "public"."vanguard_footprint" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own fundament" ON "public"."user_fundament" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own nutrition" ON "public"."daily_nutrition" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own oracle runs" ON "public"."vanguard_oracle_runs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own oura data" ON "public"."oura_daily_summary" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own preferences" ON "public"."vanguard_preferences" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own raw events" ON "public"."vanguard_raw_events" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users own their links" ON "public"."vanguard_entity_links" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own wiki runs" ON "public"."vanguard_wiki_runs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users see own curiosity queue" ON "public"."vanguard_curiosity_queue" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own feedback" ON "public"."vanguard_feedback" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own friction events" ON "public"."friction_events" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own reconciliations" ON "public"."daily_reconciliations" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own strava activities" ON "public"."strava_activities" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own training plan" ON "public"."training_plan_workouts" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own world state" ON "public"."vanguard_world_state" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_insert" ON "public"."view_events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated_select_own" ON "public"."audit_events" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."aw_daily_summary" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bcm_insert" ON "public"."body_composition_measurements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "bcm_select" ON "public"."body_composition_measurements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "bcm_update" ON "public"."body_composition_measurements" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."behavior_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."body_composition_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."body_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_food_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_nutrition" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_reconciliations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_strain" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_win_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_wins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dreams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dreams_delete" ON "public"."dreams" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "dreams_insert" ON "public"."dreams" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "dreams_select" ON "public"."dreams" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "dreams_update" ON "public"."dreams" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."endmyopia_daily_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."endmyopia_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."endmyopia_prescriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercise_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fasting_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_corrections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."food_reference_pl" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "food_reference_pl_read" ON "public"."food_reference_pl" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."friction_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goal_kpis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_kpis_owner" ON "public"."goal_kpis" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."habit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."habits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intervals_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_insight_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_entries_owner" ON "public"."kpi_entries" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."learning_skill_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_week_focus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_week_pins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."life_goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."location_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manage_own_daily_win_tasks" ON "public"."daily_win_tasks" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."mcp_servers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "md_insert" ON "public"."medical_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "md_select" ON "public"."medical_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "md_update" ON "public"."medical_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."medical_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_lab_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mlr_insert" ON "public"."medical_lab_results" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "mlr_select" ON "public"."medical_lab_results" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "mlr_update" ON "public"."medical_lab_results" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."monthly_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "monthly_reviews_owner" ON "public"."monthly_reviews" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."morning_briefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "np_insert" ON "public"."nutrition_profile" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "np_select" ON "public"."nutrition_profile" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "np_update" ON "public"."nutrition_profile" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "nt_insert" ON "public"."nutrition_targets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "nt_select" ON "public"."nutrition_targets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "nt_update" ON "public"."nutrition_targets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."nutrition_profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nutrition_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oracle_clarification_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oracle_pending_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oura_daily_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oura_enhanced" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oura_heartrate" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oura_sleep_hr_timeline" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oura_sleep_hrv_timeline" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oura_sleep_phase_timeline" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own" ON "public"."morning_briefs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_daily_strain_select" ON "public"."daily_strain" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_data" ON "public"."aw_daily_summary" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_data" ON "public"."daily_food_entries" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "own_data" ON "public"."daily_nutrition" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "own_oura_enhanced_select" ON "public"."oura_enhanced" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_select_oura_heartrate" ON "public"."oura_heartrate" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_select_oura_sleep_hr_timeline" ON "public"."oura_sleep_hr_timeline" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_select_oura_sleep_hrv_timeline" ON "public"."oura_sleep_hrv_timeline" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own_select_oura_sleep_phase_timeline" ON "public"."oura_sleep_phase_timeline" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner" ON "public"."food_corrections" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner" ON "public"."food_favorites" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner" ON "public"."food_library" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "owner_all" ON "public"."oracle_pending_actions" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."system_proposals" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "owner_all" ON "public"."vanguard_behavioral_patterns" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."pattern_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_usage_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."progress_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_owner" ON "public"."projects" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_full" ON "public"."audit_events" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."sprint_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sprint_goals_own" ON "public"."sprint_goals" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."sprint_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sprint_reviews_owner" ON "public"."sprint_reviews" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."strava_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."strava_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplement_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "todo_items_delete" ON "public"."todo_items" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "todo_items_insert" ON "public"."todo_items" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "todo_items_select" ON "public"."todo_items" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "todo_items_update" ON "public"."todo_items" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."todo_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "todo_sections_insert" ON "public"."todo_sections" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "todo_sections_owner" ON "public"."todo_sections" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "todo_sections_select" ON "public"."todo_sections" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "todo_sections_update" ON "public"."todo_sections" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."todo_smart_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_plan_workouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user own" ON "public"."knowledge_insight_cards" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user own" ON "public"."oracle_clarification_requests" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_delete" ON "public"."fasting_logs" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_fundament" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_insert" ON "public"."fasting_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_own_behavior_log" ON "public"."behavior_log" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_own_supplement_logs" ON "public"."supplement_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_own_supplements" ON "public"."supplements" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_select" ON "public"."fasting_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_update" ON "public"."fasting_logs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can select own calendar events" ON "public"."vanguard_calendar" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users can select own daily aggregates" ON "public"."vanguard_daily_aggregates" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."vanguard_behavioral_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_calendar" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_curiosity_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_daily_aggregates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_entity_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_entity_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_eval_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_eval_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_eval_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_footprint" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_identity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_knowledge" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_oracle_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_raw_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_relation_ontology" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_stream" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_telegram_inbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_time_budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_wiki_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_wiki_review_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_wiki_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_wiki_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vanguard_world_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vbi_delete" ON "public"."vision_board_items" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "vbi_insert" ON "public"."vision_board_items" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "vbi_select" ON "public"."vision_board_items" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "vbi_update" ON "public"."vision_board_items" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."view_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vision_board_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_reviews_insert" ON "public"."weekly_reviews" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "weekly_reviews_select" ON "public"."weekly_reviews" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "weekly_reviews_update" ON "public"."weekly_reviews" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."workout_sessions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_recompute_daily_nutrition"("p_user_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."_recompute_daily_nutrition"("p_user_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_recompute_daily_nutrition"("p_user_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_food_entry"("p_user_id" "uuid", "p_date" "date", "p_grams" integer, "p_entry" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_food_entry"("p_user_id" "uuid", "p_date" "date", "p_grams" integer, "p_entry" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_food_entry"("p_user_id" "uuid", "p_date" "date", "p_grams" integer, "p_entry" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cache_food_to_library"("p_user_id" "uuid", "p_name" "text", "p_brand" "text", "p_barcode" "text", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_fiber" numeric, "p_sugar" numeric, "p_default_grams" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cache_food_to_library"("p_user_id" "uuid", "p_name" "text", "p_brand" "text", "p_barcode" "text", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_fiber" numeric, "p_sugar" numeric, "p_default_grams" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cache_food_to_library"("p_user_id" "uuid", "p_name" "text", "p_brand" "text", "p_barcode" "text", "p_calories" numeric, "p_protein" numeric, "p_carbs" numeric, "p_fat" numeric, "p_fiber" numeric, "p_sugar" numeric, "p_default_grams" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_vanguard_relation_ontology"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_vanguard_relation_ontology"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_vanguard_relation_ontology"() TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_navy_bf"() TO "anon";
GRANT ALL ON FUNCTION "public"."compute_navy_bf"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_navy_bf"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deprecate_superseded_facts"("p_user_id" "uuid", "p_source" "text", "p_relation" "text", "p_new_target" "text", "p_new_confidence" double precision, "p_new_episode_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deprecate_superseded_facts"("p_user_id" "uuid", "p_source" "text", "p_relation" "text", "p_new_target" "text", "p_new_confidence" double precision, "p_new_episode_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deprecate_superseded_facts"("p_user_id" "uuid", "p_source" "text", "p_relation" "text", "p_new_target" "text", "p_new_confidence" double precision, "p_new_episode_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_entity_seeds_by_embedding"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_entity_seeds_by_embedding"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_mentioned_entities"("query_text" "text", "user_id_param" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_mentioned_entities"("query_text" "text", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brain_health_report"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_brain_health_report"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brain_health_report"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_desktop_dashboard_data"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_desktop_dashboard_data"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_desktop_dashboard_data"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_vanguard_graph_context"("start_entities" "text"[], "max_depth" integer, "user_id_param" "uuid", "p_layer" "text", "p_include_historical" boolean, "p_as_of" timestamp with time zone, "p_min_confidence" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_vanguard_graph_context"("start_entities" "text"[], "max_depth" integer, "user_id_param" "uuid", "p_layer" "text", "p_include_historical" boolean, "p_as_of" timestamp with time zone, "p_min_confidence" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_kpi_entry_for_week"("p_kpi_id" "uuid", "p_week_start" "date", "p_delta" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_kpi_entry_for_week"("p_kpi_id" "uuid", "p_week_start" "date", "p_delta" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_kpi_entry_for_week"("p_kpi_id" "uuid", "p_week_start" "date", "p_delta" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."match_vanguard_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_id_param" "uuid", "max_age_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_vanguard_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_id_param" "uuid", "max_age_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_vanguard_content"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "user_id_param" "uuid", "max_age_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."repeat_food_entry"("p_user_id" "uuid", "p_source_entry_id" "uuid", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."repeat_food_entry"("p_user_id" "uuid", "p_source_entry_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."repeat_food_entry"("p_user_id" "uuid", "p_source_entry_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_calendar_window"("p_user_id" "uuid", "p_category" "text", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_events" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_calendar_window"("p_user_id" "uuid", "p_category" "text", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_events" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace_calendar_window"("p_user_id" "uuid", "p_category" "text", "p_start" timestamp with time zone, "p_end" timestamp with time zone, "p_events" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_food_correction"("p_user_id" "uuid", "p_query_name" "text", "p_corrected_grams" integer, "p_corrected_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_food_correction"("p_user_id" "uuid", "p_query_name" "text", "p_corrected_grams" integer, "p_corrected_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_food_correction"("p_user_id" "uuid", "p_query_name" "text", "p_corrected_grams" integer, "p_corrected_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_workout_atomic"("p_user_id" "uuid", "p_day_key" character varying, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_notes" "text", "p_msp_passed" boolean, "p_logs" "jsonb", "p_session_rpe" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_workout_atomic"("p_user_id" "uuid", "p_day_key" character varying, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_notes" "text", "p_msp_passed" boolean, "p_logs" "jsonb", "p_session_rpe" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_workout_atomic"("p_user_id" "uuid", "p_day_key" character varying, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_notes" "text", "p_msp_passed" boolean, "p_logs" "jsonb", "p_session_rpe" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_entity_links"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_entity_links"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_entity_links"("query_embedding" "public"."vector", "match_user_id" "uuid", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_entity_links_fulltext"("query_text" "text", "match_user_id" "uuid", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_entity_links_fulltext"("query_text" "text", "match_user_id" "uuid", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_entity_links_fulltext"("query_text" "text", "match_user_id" "uuid", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sprint_info_for_date"("d" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."sprint_info_for_date"("d" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sprint_info_for_date"("d" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_daily_win_tasks_to_daily_wins"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_daily_win_tasks_to_daily_wins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_daily_win_tasks_to_daily_wins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_daily_wins_to_daily_win_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_daily_wins_to_daily_win_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_daily_wins_to_daily_win_tasks"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_friction_proposals"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_friction_proposals"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_friction_proposals"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_friction_proposals"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_link_read_to_growth_pins"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_link_read_to_growth_pins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_link_read_to_growth_pins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_todo_done_to_growth_pins"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_todo_done_to_growth_pins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_todo_done_to_growth_pins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_vanguard_classification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_vanguard_classification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_vanguard_telegram_worker"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_vanguard_telegram_worker"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_vanguard_telegram_worker"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_daily_plan_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_daily_plan_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_daily_plan_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_entry" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_entry" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_food_entry"("p_user_id" "uuid", "p_entry_id" "uuid", "p_entry" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_vanguard_entity_link"("p_user_id" "uuid", "p_source" "text", "p_source_type" "text", "p_relation" "text", "p_target" "text", "p_target_type" "text", "p_confidence_score" double precision, "p_memory_type" "text", "p_layer" "text", "p_metadata" "jsonb", "p_source_episode_id" "uuid", "p_observed_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_vanguard_entity_link"("p_user_id" "uuid", "p_source" "text", "p_source_type" "text", "p_relation" "text", "p_target" "text", "p_target_type" "text", "p_confidence_score" double precision, "p_memory_type" "text", "p_layer" "text", "p_metadata" "jsonb", "p_source_episode_id" "uuid", "p_observed_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."vanguard_graph_cleanup"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."vanguard_graph_cleanup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_vanguard_knowledge"() TO "anon";
GRANT ALL ON FUNCTION "public"."verify_vanguard_knowledge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_vanguard_knowledge"() TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."audit_events" TO "service_role";
GRANT SELECT ON TABLE "public"."audit_events" TO "authenticated";



GRANT ALL ON TABLE "public"."aw_daily_summary" TO "anon";
GRANT ALL ON TABLE "public"."aw_daily_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."aw_daily_summary" TO "service_role";



GRANT ALL ON TABLE "public"."behavior_log" TO "anon";
GRANT ALL ON TABLE "public"."behavior_log" TO "authenticated";
GRANT ALL ON TABLE "public"."behavior_log" TO "service_role";



GRANT ALL ON TABLE "public"."body_composition_measurements" TO "anon";
GRANT ALL ON TABLE "public"."body_composition_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."body_composition_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."body_metrics" TO "anon";
GRANT ALL ON TABLE "public"."body_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."body_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."friction_events" TO "anon";
GRANT ALL ON TABLE "public"."friction_events" TO "authenticated";
GRANT ALL ON TABLE "public"."friction_events" TO "service_role";



GRANT ALL ON TABLE "public"."confirmed_friction_events" TO "anon";
GRANT ALL ON TABLE "public"."confirmed_friction_events" TO "authenticated";
GRANT ALL ON TABLE "public"."confirmed_friction_events" TO "service_role";



GRANT ALL ON TABLE "public"."daily_food_entries" TO "anon";
GRANT ALL ON TABLE "public"."daily_food_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_food_entries" TO "service_role";



GRANT ALL ON TABLE "public"."daily_nutrition" TO "anon";
GRANT ALL ON TABLE "public"."daily_nutrition" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_nutrition" TO "service_role";



GRANT ALL ON TABLE "public"."daily_reconciliations" TO "anon";
GRANT ALL ON TABLE "public"."daily_reconciliations" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_reconciliations" TO "service_role";



GRANT ALL ON TABLE "public"."daily_strain" TO "anon";
GRANT ALL ON TABLE "public"."daily_strain" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_strain" TO "service_role";



GRANT ALL ON TABLE "public"."daily_win_tasks" TO "anon";
GRANT ALL ON TABLE "public"."daily_win_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_win_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."daily_wins" TO "anon";
GRANT ALL ON TABLE "public"."daily_wins" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_wins" TO "service_role";



GRANT ALL ON TABLE "public"."dreams" TO "anon";
GRANT ALL ON TABLE "public"."dreams" TO "authenticated";
GRANT ALL ON TABLE "public"."dreams" TO "service_role";



GRANT ALL ON TABLE "public"."endmyopia_daily_logs" TO "anon";
GRANT ALL ON TABLE "public"."endmyopia_daily_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."endmyopia_daily_logs" TO "service_role";



GRANT ALL ON TABLE "public"."endmyopia_measurements" TO "anon";
GRANT ALL ON TABLE "public"."endmyopia_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."endmyopia_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."endmyopia_prescriptions" TO "anon";
GRANT ALL ON TABLE "public"."endmyopia_prescriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."endmyopia_prescriptions" TO "service_role";



GRANT ALL ON TABLE "public"."exercise_logs" TO "anon";
GRANT ALL ON TABLE "public"."exercise_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."exercise_logs" TO "service_role";



GRANT ALL ON TABLE "public"."fasting_logs" TO "anon";
GRANT ALL ON TABLE "public"."fasting_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."fasting_logs" TO "service_role";



GRANT ALL ON TABLE "public"."food_corrections" TO "anon";
GRANT ALL ON TABLE "public"."food_corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."food_corrections" TO "service_role";



GRANT ALL ON TABLE "public"."food_favorites" TO "anon";
GRANT ALL ON TABLE "public"."food_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."food_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."food_library" TO "anon";
GRANT ALL ON TABLE "public"."food_library" TO "authenticated";
GRANT ALL ON TABLE "public"."food_library" TO "service_role";



GRANT ALL ON TABLE "public"."food_reference_pl" TO "anon";
GRANT ALL ON TABLE "public"."food_reference_pl" TO "authenticated";
GRANT ALL ON TABLE "public"."food_reference_pl" TO "service_role";



GRANT ALL ON TABLE "public"."goal_kpis" TO "anon";
GRANT ALL ON TABLE "public"."goal_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."habit_logs" TO "anon";
GRANT ALL ON TABLE "public"."habit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."habit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."habits" TO "anon";
GRANT ALL ON TABLE "public"."habits" TO "authenticated";
GRANT ALL ON TABLE "public"."habits" TO "service_role";



GRANT ALL ON TABLE "public"."intervals_tokens" TO "anon";
GRANT ALL ON TABLE "public"."intervals_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."intervals_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_insight_cards" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_insight_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_insight_cards" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_entries" TO "anon";
GRANT ALL ON TABLE "public"."kpi_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_entries" TO "service_role";



GRANT ALL ON TABLE "public"."learning_skill_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."learning_skill_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_skill_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."learning_skills" TO "anon";
GRANT ALL ON TABLE "public"."learning_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_skills" TO "service_role";



GRANT ALL ON TABLE "public"."learning_week_focus" TO "anon";
GRANT ALL ON TABLE "public"."learning_week_focus" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_week_focus" TO "service_role";



GRANT ALL ON TABLE "public"."learning_week_pins" TO "anon";
GRANT ALL ON TABLE "public"."learning_week_pins" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_week_pins" TO "service_role";



GRANT ALL ON TABLE "public"."life_goals" TO "anon";
GRANT ALL ON TABLE "public"."life_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."life_goals" TO "service_role";



GRANT ALL ON TABLE "public"."location_history" TO "anon";
GRANT ALL ON TABLE "public"."location_history" TO "authenticated";
GRANT ALL ON TABLE "public"."location_history" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_servers" TO "anon";
GRANT ALL ON TABLE "public"."mcp_servers" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_servers" TO "service_role";



GRANT ALL ON TABLE "public"."medical_documents" TO "anon";
GRANT ALL ON TABLE "public"."medical_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_documents" TO "service_role";



GRANT ALL ON TABLE "public"."medical_lab_results" TO "anon";
GRANT ALL ON TABLE "public"."medical_lab_results" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_lab_results" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_reviews" TO "anon";
GRANT ALL ON TABLE "public"."monthly_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."morning_briefs" TO "anon";
GRANT ALL ON TABLE "public"."morning_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."morning_briefs" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_profile" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_profile" TO "service_role";



GRANT ALL ON TABLE "public"."nutrition_targets" TO "anon";
GRANT ALL ON TABLE "public"."nutrition_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."nutrition_targets" TO "service_role";



GRANT ALL ON TABLE "public"."oracle_clarification_requests" TO "anon";
GRANT ALL ON TABLE "public"."oracle_clarification_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."oracle_clarification_requests" TO "service_role";



GRANT ALL ON TABLE "public"."oracle_pending_actions" TO "anon";
GRANT ALL ON TABLE "public"."oracle_pending_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."oracle_pending_actions" TO "service_role";



GRANT ALL ON TABLE "public"."oura_daily_summary" TO "anon";
GRANT ALL ON TABLE "public"."oura_daily_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."oura_daily_summary" TO "service_role";



GRANT ALL ON TABLE "public"."oura_enhanced" TO "anon";
GRANT ALL ON TABLE "public"."oura_enhanced" TO "authenticated";
GRANT ALL ON TABLE "public"."oura_enhanced" TO "service_role";



GRANT ALL ON TABLE "public"."oura_heartrate" TO "anon";
GRANT ALL ON TABLE "public"."oura_heartrate" TO "authenticated";
GRANT ALL ON TABLE "public"."oura_heartrate" TO "service_role";



GRANT ALL ON TABLE "public"."oura_hr_zones_daily" TO "anon";
GRANT ALL ON TABLE "public"."oura_hr_zones_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."oura_hr_zones_daily" TO "service_role";



GRANT ALL ON TABLE "public"."oura_sleep_hr_timeline" TO "anon";
GRANT ALL ON TABLE "public"."oura_sleep_hr_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."oura_sleep_hr_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."oura_sleep_hrv_timeline" TO "anon";
GRANT ALL ON TABLE "public"."oura_sleep_hrv_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."oura_sleep_hrv_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."oura_sleep_phase_timeline" TO "anon";
GRANT ALL ON TABLE "public"."oura_sleep_phase_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."oura_sleep_phase_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."pattern_events" TO "anon";
GRANT ALL ON TABLE "public"."pattern_events" TO "authenticated";
GRANT ALL ON TABLE "public"."pattern_events" TO "service_role";



GRANT ALL ON TABLE "public"."phone_usage_daily" TO "anon";
GRANT ALL ON TABLE "public"."phone_usage_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_usage_daily" TO "service_role";



GRANT ALL ON TABLE "public"."progress_photos" TO "anon";
GRANT ALL ON TABLE "public"."progress_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."progress_photos" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."sprint_goals" TO "anon";
GRANT ALL ON TABLE "public"."sprint_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."sprint_goals" TO "service_role";



GRANT ALL ON TABLE "public"."sprint_reviews" TO "anon";
GRANT ALL ON TABLE "public"."sprint_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."sprint_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."strava_activities" TO "anon";
GRANT ALL ON TABLE "public"."strava_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."strava_activities" TO "service_role";



GRANT ALL ON TABLE "public"."strava_activities_clean" TO "anon";
GRANT ALL ON TABLE "public"."strava_activities_clean" TO "authenticated";
GRANT ALL ON TABLE "public"."strava_activities_clean" TO "service_role";



GRANT ALL ON TABLE "public"."strain_correlations" TO "anon";
GRANT ALL ON TABLE "public"."strain_correlations" TO "authenticated";
GRANT ALL ON TABLE "public"."strain_correlations" TO "service_role";



GRANT ALL ON TABLE "public"."strava_tokens" TO "anon";
GRANT ALL ON TABLE "public"."strava_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."strava_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."supplement_logs" TO "anon";
GRANT ALL ON TABLE "public"."supplement_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."supplement_logs" TO "service_role";



GRANT ALL ON TABLE "public"."supplements" TO "anon";
GRANT ALL ON TABLE "public"."supplements" TO "authenticated";
GRANT ALL ON TABLE "public"."supplements" TO "service_role";



GRANT ALL ON TABLE "public"."system_proposals" TO "anon";
GRANT ALL ON TABLE "public"."system_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."system_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."todo_attachments" TO "anon";
GRANT ALL ON TABLE "public"."todo_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."todo_items" TO "anon";
GRANT ALL ON TABLE "public"."todo_items" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_items" TO "service_role";



GRANT ALL ON TABLE "public"."todo_sections" TO "anon";
GRANT ALL ON TABLE "public"."todo_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_sections" TO "service_role";



GRANT ALL ON TABLE "public"."todo_smart_lists" TO "anon";
GRANT ALL ON TABLE "public"."todo_smart_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_smart_lists" TO "service_role";



GRANT ALL ON TABLE "public"."training_plan_workouts" TO "anon";
GRANT ALL ON TABLE "public"."training_plan_workouts" TO "authenticated";
GRANT ALL ON TABLE "public"."training_plan_workouts" TO "service_role";



GRANT ALL ON TABLE "public"."user_fundament" TO "anon";
GRANT ALL ON TABLE "public"."user_fundament" TO "authenticated";
GRANT ALL ON TABLE "public"."user_fundament" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_stream" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_stream" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_stream" TO "service_role";



GRANT ALL ON TABLE "public"."v_friction_daily_qa" TO "anon";
GRANT ALL ON TABLE "public"."v_friction_daily_qa" TO "authenticated";
GRANT ALL ON TABLE "public"."v_friction_daily_qa" TO "service_role";



GRANT ALL ON TABLE "public"."v_friction_debug" TO "anon";
GRANT ALL ON TABLE "public"."v_friction_debug" TO "authenticated";
GRANT ALL ON TABLE "public"."v_friction_debug" TO "service_role";



GRANT ALL ON TABLE "public"."v_friction_pipeline_status" TO "anon";
GRANT ALL ON TABLE "public"."v_friction_pipeline_status" TO "authenticated";
GRANT ALL ON TABLE "public"."v_friction_pipeline_status" TO "service_role";



GRANT ALL ON TABLE "public"."v_friction_review" TO "anon";
GRANT ALL ON TABLE "public"."v_friction_review" TO "authenticated";
GRANT ALL ON TABLE "public"."v_friction_review" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_entity_links" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_entity_links" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_entity_links" TO "service_role";



GRANT ALL ON TABLE "public"."v_graph_temporal_guard" TO "anon";
GRANT ALL ON TABLE "public"."v_graph_temporal_guard" TO "authenticated";
GRANT ALL ON TABLE "public"."v_graph_temporal_guard" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_behavioral_patterns" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_behavioral_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_behavioral_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_calendar" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."workout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."workout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_consolidated_activities" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_consolidated_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_consolidated_activities" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_curiosity_queue" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_curiosity_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_curiosity_queue" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_daily_aggregates" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_daily_aggregates" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_daily_aggregates" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_entity_aliases" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_entity_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_entity_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_eval_questions" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_eval_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_eval_questions" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_eval_results" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_eval_results" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_eval_results" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_eval_runs" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_eval_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_eval_runs" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_feedback" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_footprint" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_footprint" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_footprint" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_identity" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_identity" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_identity" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_knowledge" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_links" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_links" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_links" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_notes" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_notes" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_oracle_runs" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_oracle_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_oracle_runs" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_preferences" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_raw_events" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_raw_events" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_raw_events" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_relation_ontology" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_relation_ontology" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_relation_ontology" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_telegram_inbox" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_telegram_inbox" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_telegram_inbox" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_time_budgets" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_time_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_time_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_tokens" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_wiki_pages" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_wiki_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_wiki_pages" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_wiki_review_items" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_wiki_review_items" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_wiki_review_items" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_wiki_runs" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_wiki_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_wiki_runs" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_wiki_sources" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_wiki_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_wiki_sources" TO "service_role";



GRANT ALL ON TABLE "public"."vanguard_world_state" TO "anon";
GRANT ALL ON TABLE "public"."vanguard_world_state" TO "authenticated";
GRANT ALL ON TABLE "public"."vanguard_world_state" TO "service_role";



GRANT ALL ON TABLE "public"."view_events" TO "anon";
GRANT ALL ON TABLE "public"."view_events" TO "authenticated";
GRANT ALL ON TABLE "public"."view_events" TO "service_role";



GRANT ALL ON TABLE "public"."vision_board_items" TO "anon";
GRANT ALL ON TABLE "public"."vision_board_items" TO "authenticated";
GRANT ALL ON TABLE "public"."vision_board_items" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_reviews" TO "anon";
GRANT ALL ON TABLE "public"."weekly_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_reviews" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







