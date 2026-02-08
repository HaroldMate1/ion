-- Expert Investors Feature
-- Track and compare portfolios of top real-world investors

-- 1. expert_portfolio: One portfolio per user per investor
CREATE TABLE IF NOT EXISTS expert_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_slug TEXT NOT NULL,
  is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  total_value DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  total_return_pct DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, investor_slug)
);

-- 2. expert_holding: Individual positions within an investor portfolio
CREATE TABLE IF NOT EXISTS expert_holding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES expert_portfolio(id) ON DELETE CASCADE,
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

-- 3. expert_transaction: Transaction history
CREATE TABLE IF NOT EXISTS expert_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES expert_portfolio(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'dividend')),
  quantity DECIMAL(20, 8) NOT NULL,
  price_per_unit DECIMAL(20, 8) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. expert_portfolio_snapshot: Daily portfolio values for performance charts
CREATE TABLE IF NOT EXISTS expert_portfolio_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES expert_portfolio(id) ON DELETE CASCADE,
  total_value DECIMAL(15, 2) NOT NULL,
  total_return_pct DECIMAL(8, 4) NOT NULL,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, snapshot_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expert_portfolio_user ON expert_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_expert_holding_portfolio ON expert_holding(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_expert_transaction_portfolio ON expert_transaction(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_expert_transaction_created ON expert_transaction(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_snapshot_portfolio_date ON expert_portfolio_snapshot(portfolio_id, snapshot_date DESC);

-- Row Level Security
ALTER TABLE expert_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_holding ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_portfolio_snapshot ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expert_portfolio
CREATE POLICY "Users can view their own expert portfolios"
  ON expert_portfolio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own expert portfolios"
  ON expert_portfolio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expert portfolios"
  ON expert_portfolio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expert portfolios"
  ON expert_portfolio FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for expert_holding
CREATE POLICY "Users can view holdings of their expert portfolios"
  ON expert_holding FOR SELECT
  USING (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can create holdings in their expert portfolios"
  ON expert_holding FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can update holdings in their expert portfolios"
  ON expert_holding FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete holdings from their expert portfolios"
  ON expert_holding FOR DELETE
  USING (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));

-- RLS Policies for expert_transaction
CREATE POLICY "Users can view transactions of their expert portfolios"
  ON expert_transaction FOR SELECT
  USING (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can create transactions in their expert portfolios"
  ON expert_transaction FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));

-- RLS Policies for expert_portfolio_snapshot
CREATE POLICY "Users can view snapshots of their expert portfolios"
  ON expert_portfolio_snapshot FOR SELECT
  USING (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can create snapshots for their expert portfolios"
  ON expert_portfolio_snapshot FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM expert_portfolio WHERE user_id = auth.uid()));

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_expert_portfolio_updated_at ON expert_portfolio;
CREATE TRIGGER update_expert_portfolio_updated_at
  BEFORE UPDATE ON expert_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expert_holding_updated_at ON expert_holding;
CREATE TRIGGER update_expert_holding_updated_at
  BEFORE UPDATE ON expert_holding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
