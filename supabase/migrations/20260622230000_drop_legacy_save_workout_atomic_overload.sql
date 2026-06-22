-- Same ambiguous-overload bug as match_vanguard_content and
-- get_vanguard_graph_context. WorkoutLogger.tsx sends
-- `p_session_rpe: sessionRpe ?? undefined`; when sessionRpe is unset,
-- JSON.stringify drops the undefined key, so the RPC call carries only
-- the 7 common named args — ambiguous between the old 7-arg overload and
-- the newer 8-arg one (which has p_session_rpe DEFAULT NULL). Every
-- workout logged without an RPE value has been throwing on save.
--
-- Keep the newer overload (writes session_rpe, factors it into
-- importance_score). Drop the older 7-arg one.
DROP FUNCTION IF EXISTS public.save_workout_atomic(
  uuid, character varying, timestamp with time zone, timestamp with time zone, text, boolean, jsonb
);
