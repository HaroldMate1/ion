-- Benchmark Indexes Feature
-- Track S&P 500 and NASDAQ 100 with individual stock holdings

CREATE TABLE IF NOT EXISTS benchmark_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benchmark_slug TEXT NOT NULL CHECK (benchmark_slug IN ('sp500', 'nasdaq100')),
  is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  total_value DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  total_return_pct DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, benchmark_slug)
);

CREATE TABLE IF NOT EXISTS benchmark_holding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES benchmark_portfolio(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_name TEXT,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'etf')),
  target_allocation_pct DECIMAL(5, 2) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_invested DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol)
);

CREATE TABLE IF NOT EXISTS benchmark_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES benchmark_portfolio(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity DECIMAL(20, 8) NOT NULL,
  price_per_unit DECIMAL(20, 8) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benchmark_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES benchmark_portfolio(id) ON DELETE CASCADE,
  total_value DECIMAL(15, 2) NOT NULL,
  total_return_pct DECIMAL(8, 4) NOT NULL,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, snapshot_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_benchmark_portfolio_user ON benchmark_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_holding_portfolio ON benchmark_holding(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_transaction_portfolio ON benchmark_transaction(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_snapshot_portfolio_date ON benchmark_snapshot(portfolio_id, snapshot_date DESC);

-- RLS
ALTER TABLE benchmark_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_holding ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_snapshot ENABLE ROW LEVEL SECURITY;

-- benchmark_portfolio policies
CREATE POLICY "Users can view their own benchmark portfolios"
  ON benchmark_portfolio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own benchmark portfolios"
  ON benchmark_portfolio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own benchmark portfolios"
  ON benchmark_portfolio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own benchmark portfolios"
  ON benchmark_portfolio FOR DELETE USING (auth.uid() = user_id);

-- benchmark_holding policies
CREATE POLICY "Users can view their benchmark holdings"
  ON benchmark_holding FOR SELECT
  USING (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can create benchmark holdings"
  ON benchmark_holding FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can update benchmark holdings"
  ON benchmark_holding FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete benchmark holdings"
  ON benchmark_holding FOR DELETE
  USING (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));

-- benchmark_transaction policies
CREATE POLICY "Users can view their benchmark transactions"
  ON benchmark_transaction FOR SELECT
  USING (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can create benchmark transactions"
  ON benchmark_transaction FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));

-- benchmark_snapshot policies
CREATE POLICY "Users can view their benchmark snapshots"
  ON benchmark_snapshot FOR SELECT
  USING (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));
CREATE POLICY "Users can create benchmark snapshots"
  ON benchmark_snapshot FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM benchmark_portfolio WHERE user_id = auth.uid()));

-- Triggers
DROP TRIGGER IF EXISTS update_benchmark_portfolio_updated_at ON benchmark_portfolio;
CREATE TRIGGER update_benchmark_portfolio_updated_at
  BEFORE UPDATE ON benchmark_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_benchmark_holding_updated_at ON benchmark_holding;
CREATE TRIGGER update_benchmark_holding_updated_at
  BEFORE UPDATE ON benchmark_holding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
