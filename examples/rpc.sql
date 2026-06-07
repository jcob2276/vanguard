-- Canonical Vanguard RPC pattern.
--
-- Key invariants:
--   1. SECURITY DEFINER so the function runs as owner (bypasses RLS for writes)
--      but validate auth.uid() explicitly — never trust caller to pass correct user_id
--   2. Warsaw timezone for date computation
--   3. RETURNS jsonb — callers get structured { success, error, data }
--   4. Exception block with SQLSTATE / SQLERRM for meaningful error propagation
--   5. SET search_path = '' for SECURITY DEFINER functions (prevents hijacking)

CREATE OR REPLACE FUNCTION save_example_atomic(
  p_user_id   uuid,
  p_value     numeric,
  p_notes     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today   text;
  v_id      uuid;
BEGIN
  -- 1. Auth check — caller must be the authenticated user or service role
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: user_id mismatch';
  END IF;

  -- 2. Warsaw today
  v_today := (now() AT TIME ZONE 'Europe/Warsaw')::date::text;

  -- 3. Upsert — idempotent on (user_id, date)
  INSERT INTO public.example_entries (user_id, date, value, notes)
  VALUES (p_user_id, v_today, p_value, p_notes)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    value      = EXCLUDED.value,
    notes      = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'date', v_today);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION save_example_atomic(uuid, numeric, text)
  TO authenticated, service_role;
