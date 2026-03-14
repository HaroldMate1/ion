-- Enable trading portfolios and daily logs

-- 1. Drop existing check constraint on provider
ALTER TABLE llm_portfolio DROP CONSTRAINT IF EXISTS llm_portfolio_provider_check;

-- 2. Add updated check constraint including trading providers
ALTER TABLE llm_portfolio ADD CONSTRAINT llm_portfolio_provider_check 
  CHECK (provider IN (
    'claude', 'chatgpt', 'gemini', 'perplexity', 'grok',
    'claude-trading', 'chatgpt-trading', 'gemini-trading'
  ));

-- 3. Create table for daily text logs
CREATE TABLE IF NOT EXISTS llm_daily_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES llm_portfolio(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS on new table
ALTER TABLE llm_daily_log ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for llm_daily_log
CREATE POLICY "Users can view logs of their portfolios"
  ON llm_daily_log FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create logs in their portfolios"
  ON llm_daily_log FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

-- 6. Index for performance
CREATE INDEX IF NOT EXISTS idx_llm_daily_log_portfolio ON llm_daily_log(portfolio_id, created_at DESC);
