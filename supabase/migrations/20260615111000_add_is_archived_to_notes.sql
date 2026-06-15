-- Add is_archived column to vanguard_notes table
ALTER TABLE public.vanguard_notes ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
