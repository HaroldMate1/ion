-- LLM Portfolios Feature
-- Compare 5 LLM portfolio strategies with predefined allocations

-- 1. llm_portfolio: One portfolio per user per LLM provider
CREATE TABLE IF NOT EXISTS llm_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('claude', 'chatgpt', 'gemini', 'perplexity', 'grok')),
  is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  total_value DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  total_return_pct DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- 2. llm_holding: Individual positions within a portfolio
CREATE TABLE IF NOT EXISTS llm_holding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES llm_portfolio(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_name TEXT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto', 'bond', 'reit', 'commodity')),
  market TEXT NOT NULL DEFAULT 'us',
  target_allocation_pct DECIMAL(5, 2) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_invested DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol)
);

-- 3. llm_transaction: Transaction history (buys only for this feature)
CREATE TABLE IF NOT EXISTS llm_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES llm_portfolio(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend')),
  quantity DECIMAL(20, 8) NOT NULL,
  price_per_unit DECIMAL(20, 8) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. llm_portfolio_snapshot: Daily portfolio values for performance charts
CREATE TABLE IF NOT EXISTS llm_portfolio_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES llm_portfolio(id) ON DELETE CASCADE,
  total_value DECIMAL(15, 2) NOT NULL,
  total_return_pct DECIMAL(8, 4) NOT NULL,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, snapshot_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_portfolio_user ON llm_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_holding_portfolio ON llm_holding(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_llm_transaction_portfolio ON llm_transaction(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_llm_transaction_created ON llm_transaction(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_snapshot_portfolio_date ON llm_portfolio_snapshot(portfolio_id, snapshot_date DESC);

-- Row Level Security
ALTER TABLE llm_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_holding ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_portfolio_snapshot ENABLE ROW LEVEL SECURITY;

-- RLS Policies for llm_portfolio
CREATE POLICY "Users can view their own LLM portfolios"
  ON llm_portfolio FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own LLM portfolios"
  ON llm_portfolio FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LLM portfolios"
  ON llm_portfolio FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LLM portfolios"
  ON llm_portfolio FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for llm_holding (through portfolio ownership)
CREATE POLICY "Users can view holdings of their portfolios"
  ON llm_holding FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create holdings in their portfolios"
  ON llm_holding FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update holdings in their portfolios"
  ON llm_holding FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete holdings from their portfolios"
  ON llm_holding FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for llm_transaction
CREATE POLICY "Users can view transactions of their portfolios"
  ON llm_transaction FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transactions in their portfolios"
  ON llm_transaction FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for llm_portfolio_snapshot
CREATE POLICY "Users can view snapshots of their portfolios"
  ON llm_portfolio_snapshot FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create snapshots for their portfolios"
  ON llm_portfolio_snapshot FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
    )
  );

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_llm_portfolio_updated_at ON llm_portfolio;
CREATE TRIGGER update_llm_portfolio_updated_at
  BEFORE UPDATE ON llm_portfolio
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_llm_holding_updated_at ON llm_holding;
CREATE TRIGGER update_llm_holding_updated_at
  BEFORE UPDATE ON llm_holding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
