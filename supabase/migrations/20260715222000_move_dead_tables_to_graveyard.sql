-- ============================================================================
-- Migration: Move Dead Tables to Graveyard Schema
-- Date: 2026-07-15
--
-- This migration moves completely dead and unused tables from the public schema
-- to a dedicated 'graveyard' schema. This keeps the public schema clean and 
-- reduces schema noise for AI agents and database clients.
-- ============================================================================

-- 1. Create the graveyard schema if it does not exist
CREATE SCHEMA IF NOT EXISTS graveyard;

-- 2. Move morning_briefs to graveyard schema
ALTER TABLE IF EXISTS public.morning_briefs SET SCHEMA graveyard;

-- 3. Move endmyopia_daily_logs to graveyard schema
ALTER TABLE IF EXISTS public.endmyopia_daily_logs SET SCHEMA graveyard;
