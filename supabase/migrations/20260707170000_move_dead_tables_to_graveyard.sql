-- Create graveyard schema and move 16 unused/dead tables into it.

CREATE SCHEMA IF NOT EXISTS graveyard;

-- Helper to safely move a table if it exists in the public schema
CREATE OR REPLACE FUNCTION public.safe_move_to_graveyard(t_name text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t_name
    ) THEN
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA graveyard', t_name);
    END IF;
END;
$$;

-- Move the 16 dead tables
SELECT public.safe_move_to_graveyard('daily_habits');
SELECT public.safe_move_to_graveyard('stayfree_usage');
SELECT public.safe_move_to_graveyard('location_history');
SELECT public.safe_move_to_graveyard('push_subscriptions');
SELECT public.safe_move_to_graveyard('endmyopia_daily_logs');
SELECT public.safe_move_to_graveyard('vision_board_items');
SELECT public.safe_move_to_graveyard('learning_skill_snapshots');
SELECT public.safe_move_to_graveyard('learning_week_pins');
SELECT public.safe_move_to_graveyard('vanguard_recipes');
SELECT public.safe_move_to_graveyard('vanguard_stream_closure_proposals');
SELECT public.safe_move_to_graveyard('vanguard_iron_rules');
SELECT public.safe_move_to_graveyard('food_parse_pending');
SELECT public.safe_move_to_graveyard('user_portions');
SELECT public.safe_move_to_graveyard('dreams');
SELECT public.safe_move_to_graveyard('todo_smart_lists');
SELECT public.safe_move_to_graveyard('todo_attachments');

-- Drop the helper function
DROP FUNCTION public.safe_move_to_graveyard(text);
