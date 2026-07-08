-- ============================================================
-- DATA COVERAGE COUNTER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_data_coverage(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today date;
  v_oura_30 float;
  v_oura_90 float;
  v_nutr_30 float;
  v_nutr_90 float;
  v_wins_30 float;
  v_wins_90 float;
  v_result jsonb;
BEGIN
  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::date;

  -- 1. Oura coverage
  SELECT COALESCE(count(*)::float / 30.0, 0.0) INTO v_oura_30
  FROM public.oura_daily_summary
  WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today;

  SELECT COALESCE(count(*)::float / 90.0, 0.0) INTO v_oura_90
  FROM public.oura_daily_summary
  WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today;

  -- 2. Nutrition coverage (has non-null calories logged)
  SELECT COALESCE(count(*)::float / 30.0, 0.0) INTO v_nutr_30
  FROM public.daily_nutrition
  WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today AND calories > 0;

  SELECT COALESCE(count(*)::float / 90.0, 0.0) INTO v_nutr_90
  FROM public.daily_nutrition
  WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today AND calories > 0;

  -- 3. Wins / Reflection coverage (either has daily_wins or daily_reconciliations)
  WITH wins_recons_30 AS (
    SELECT DISTINCT date FROM public.daily_wins WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today
    UNION
    SELECT DISTINCT date FROM public.daily_reconciliations WHERE user_id = p_user_id AND date >= (v_today - 30) AND date < v_today
  )
  SELECT COALESCE(count(*)::float / 30.0, 0.0) INTO v_wins_30 FROM wins_recons_30;

  WITH wins_recons_90 AS (
    SELECT DISTINCT date FROM public.daily_wins WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today
    UNION
    SELECT DISTINCT date FROM public.daily_reconciliations WHERE user_id = p_user_id AND date >= (v_today - 90) AND date < v_today
  )
  SELECT COALESCE(count(*)::float / 90.0, 0.0) INTO v_wins_90 FROM wins_recons_90;

  -- Format result
  v_result := jsonb_build_object(
    'oura_30', round(v_oura_30::numeric, 2),
    'oura_90', round(v_oura_90::numeric, 2),
    'nutrition_30', round(v_nutr_30::numeric, 2),
    'nutrition_90', round(v_nutr_90::numeric, 2),
    'wins_30', round(v_wins_30::numeric, 2),
    'wins_90', round(v_wins_90::numeric, 2),
    'overall_30', round(((v_oura_30 + v_nutr_30 + v_wins_30) / 3.0)::numeric, 2),
    'overall_90', round(((v_oura_90 + v_nutr_90 + v_wins_90) / 3.0)::numeric, 2)
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_data_coverage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_data_coverage(uuid) TO authenticated, service_role;
