-- Benchmark Indexes Feature
-- Track S&P 500 and NASDAQ 100 performance with $100k each

CREATE TABLE IF NOT EXISTS benchmark_portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benchmark_slug TEXT NOT NULL CHECK (benchmark_slug IN ('sp500', 'nasdaq100')),
  is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
  total_value DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  total_return_pct DECIMAL(8, 4) NOT NULL DEFAULT 0.0000,
  quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_invested DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, benchmark_slug)
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
CREATE INDEX IF NOT EXISTS idx_benchmark_snapshot_portfolio_date ON benchmark_snapshot(portfolio_id, snapshot_date DESC);

-- RLS
ALTER TABLE benchmark_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own benchmark portfolios"
  ON benchmark_portfolio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own benchmark portfolios"
  ON benchmark_portfolio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own benchmark portfolios"
  ON benchmark_portfolio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own benchmark portfolios"
  ON benchmark_portfolio FOR DELETE USING (auth.uid() = user_id);

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
