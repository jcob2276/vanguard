-- Same ambiguous-overload bug as match_vanguard_content: two versions of
-- get_vanguard_graph_context coexist with identical named parameters
-- (p_include_historical/p_as_of just declared in a different order), so
-- every named-arg call from vanguard-oracle is ambiguous. It was masked
-- because match_vanguard_content failed earlier in the same Promise.all,
-- short-circuiting before this RPC ever ran — fixing that bug today would
-- have unmasked this one on the very next Oracle query.
--
-- Keep the newer overload (has temporal_status filtering + fact_text in
-- the result set, which vanguard-oracle's graph formatting code reads).
-- Drop the older one (no temporal_status check, no fact_text column).
DROP FUNCTION IF EXISTS public.get_vanguard_graph_context(
  text[], integer, uuid, text, timestamp with time zone, boolean, double precision
);
