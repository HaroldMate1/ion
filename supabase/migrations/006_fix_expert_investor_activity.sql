-- Fix migration: drop old index/policies and replace with named constraint
-- Run this if 006_expert_investor_activity.sql partially ran and left conflicts

-- 1. Drop old unique index (if it was created as an index instead of constraint)
DROP INDEX IF EXISTS public.expert_investor_activity_dedup;

-- 2. Drop the named constraint if it somehow already exists
ALTER TABLE public.expert_investor_activity
  DROP CONSTRAINT IF EXISTS expert_investor_activity_dedup;

-- 3. Add the named unique constraint (required for Supabase upsert onConflict)
ALTER TABLE public.expert_investor_activity
  ADD CONSTRAINT expert_investor_activity_dedup
  UNIQUE (investor_slug, event_date, symbol, action, source);

-- 4. Drop and recreate policies cleanly
DROP POLICY IF EXISTS "Anyone authenticated can read activity" ON public.expert_investor_activity;
DROP POLICY IF EXISTS "Service role can insert activity" ON public.expert_investor_activity;

CREATE POLICY "Anyone authenticated can read activity"
  ON public.expert_investor_activity
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert activity"
  ON public.expert_investor_activity
  FOR INSERT
  TO service_role
  WITH CHECK (true);
