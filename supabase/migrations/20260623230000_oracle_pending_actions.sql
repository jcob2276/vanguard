-- Migration: Create oracle_pending_actions table for mutation gating
-- Date: 2026-06-23

CREATE TABLE IF NOT EXISTS oracle_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'schedule_mutation' | 'insight_cards_mutation' | 'calendar_event'
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE oracle_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON oracle_pending_actions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_opa_user_status ON oracle_pending_actions(user_id, status);
