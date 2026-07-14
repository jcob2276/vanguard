-- ============================================================
-- FIX vanguard_behavioral_patterns STATUS CHECK CONSTRAINT
-- ============================================================
-- Ensure that both 'pending' and 'hypothesis' (along with 'visible',
-- 'user_confirmed', 'user_rejected', 'snoozed', 'archived') are accepted
-- by the vanguard_behavioral_patterns status check constraint, matching
-- the baseline schema. This prevents check constraint errors for low-confidence
-- patterns when they are upserted.

ALTER TABLE public.vanguard_behavioral_patterns
DROP CONSTRAINT IF EXISTS vanguard_behavioral_patterns_status_check;

ALTER TABLE public.vanguard_behavioral_patterns
ADD CONSTRAINT vanguard_behavioral_patterns_status_check
CHECK (status = ANY (ARRAY['pending'::text, 'visible'::text, 'user_confirmed'::text, 'user_rejected'::text, 'snoozed'::text, 'archived'::text, 'hypothesis'::text]));
