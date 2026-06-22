-- Two overloads of match_vanguard_content existed since 2026-06-11
-- (4-arg original + 5-arg with max_age_days DEFAULT 90), making every call
-- with the 4 common named args ambiguous. Postgres rejected the call
-- ("Could not choose the best candidate function"), so vanguard-oracle's
-- primary semantic RPC and vanguard-auto-classify's closure detection have
-- been silently failing on every invocation since. No caller passes
-- max_age_days explicitly, so dropping the old 4-arg overload is safe —
-- existing calls resolve to the 5-arg version using its default.
DROP FUNCTION IF EXISTS public.match_vanguard_content(vector, double precision, integer, uuid);
