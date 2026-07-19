-- Migration to add developmental fields to vanguard_identity for the new /rozwoj view
ALTER TABLE "public"."vanguard_identity"
ADD COLUMN IF NOT EXISTS "development_theme" text,
ADD COLUMN IF NOT EXISTS "development_gap" text,
ADD COLUMN IF NOT EXISTS "current_role" text,
ADD COLUMN IF NOT EXISTS "developed_role" text,
ADD COLUMN IF NOT EXISTS "values_standards" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "confirming_behaviors" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "conflicting_behaviors" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "active_path" jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS "library_items" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "practice_evidences" jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "development_review" jsonb DEFAULT '{}'::jsonb;
