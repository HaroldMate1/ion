-- Expert Investor Activity Tracking
-- Stores detected trades/changes for Cathie Wood (daily ARK CSV) and Pelosi (House disclosures)

CREATE TABLE IF NOT EXISTS public.expert_investor_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_slug text NOT NULL,
  event_date date NOT NULL,
  symbol text NOT NULL,
  asset_name text,
  action text NOT NULL, -- 'buy' | 'sell' | 'increase' | 'decrease' | 'new_position' | 'closed_position'
  amount_range text,    -- e.g. "$15,001 - $50,000" (House disclosures) or "$2.1M" (ARK)
  shares_change numeric,
  previous_pct numeric,
  new_pct numeric,
  source text NOT NULL, -- 'ark_csv' | 'house_disclosure'
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  -- Named unique constraint (required for Supabase upsert onConflict)
  CONSTRAINT expert_investor_activity_dedup
    UNIQUE (investor_slug, event_date, symbol, action, source)
);

-- Index for fast querying by investor and date (separate from the unique constraint)
CREATE INDEX IF NOT EXISTS expert_investor_activity_slug_date
  ON public.expert_investor_activity(investor_slug, event_date DESC);

-- RLS: authenticated users can read, service role can write
ALTER TABLE public.expert_investor_activity ENABLE ROW LEVEL SECURITY;

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
