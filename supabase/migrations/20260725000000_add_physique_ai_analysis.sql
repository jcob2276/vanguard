-- Migration: Add ai_analysis JSONB column to progress_photos table
ALTER TABLE "public"."progress_photos"
ADD COLUMN IF NOT EXISTS "ai_analysis" jsonb DEFAULT NULL;

COMMENT ON COLUMN "public"."progress_photos"."ai_analysis" IS 'AI physique vision analysis result (overall score, body fat %, muscle breakdown, coaching recommendations)';
