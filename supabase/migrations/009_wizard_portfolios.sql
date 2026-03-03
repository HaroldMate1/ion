-- Wizard Portfolios Feature
-- Joel Greenblatt's Magic Formula (Merlin) and Enhanced variant (Houdini)

-- 1. wizard_portfolio: one portfolio per user per strategy
CREATE TABLE IF NOT EXISTS wizard_portfolio (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy            TEXT NOT NULL CHECK (strategy IN ('merlin', 'houdini')),
  is_initialized      BOOLEAN NOT NULL DEFAULT FALSE,
  total_value         DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  cash_balance        DECIMAL(15, 2) NOT NULL DEFAULT 100000.00,
  total_return_pct    DECIMAL(8, 4)  NOT NULL DEFAULT 0.0000,
  companies_screened  INT,
  screening_date      DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, strategy)
);

-- 2. wizard_holding: individual positions with magic-formula metadata
CREATE TABLE IF NOT EXISTS wizard_holding (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id         UUID NOT NULL REFERENCES wizard_portfolio(id) ON DELETE CASCADE,
  symbol               TEXT NOT NULL,
  asset_name           TEXT,
  pe_ratio             DECIMAL(12, 4),
  earnings_yield       DECIMAL(12, 6),
  return_on_equity     DECIMAL(12, 6),
  magic_rank           INT,
  target_allocation_pct DECIMAL(5, 2) NOT NULL DEFAULT 3.33,
  quantity             DECIMAL(20, 8) NOT NULL DEFAULT 0,
  average_buy_price    DECIMAL(20, 8) NOT NULL DEFAULT 0,
  total_invested       DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol)
);

-- 3. wizard_transaction: buy/sell history
CREATE TABLE IF NOT EXISTS wizard_transaction (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id      UUID NOT NULL REFERENCES wizard_portfolio(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  transaction_type  TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity          DECIMAL(20, 8) NOT NULL,
  price_per_unit    DECIMAL(20, 8) NOT NULL,
  total_amount      DECIMAL(15, 2) NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wizard_portfolio_user     ON wizard_portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_wizard_holding_portfolio  ON wizard_holding(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_wizard_transaction_portfolio ON wizard_transaction(portfolio_id);

-- Row Level Security
ALTER TABLE wizard_portfolio   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wizard_holding     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wizard_transaction ENABLE ROW LEVEL SECURITY;

-- wizard_portfolio RLS
CREATE POLICY "Users can view own wizard portfolios"
  ON wizard_portfolio FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own wizard portfolios"
  ON wizard_portfolio FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wizard portfolios"
  ON wizard_portfolio FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wizard portfolios"
  ON wizard_portfolio FOR DELETE USING (auth.uid() = user_id);

-- wizard_holding RLS (through portfolio ownership)
CREATE POLICY "Users can view holdings of their wizard portfolios"
  ON wizard_holding FOR SELECT
  USING (portfolio_id IN (SELECT id FROM wizard_portfolio WHERE user_id = auth.uid()));

CREATE POLICY "Users can create holdings in their wizard portfolios"
  ON wizard_holding FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM wizard_portfolio WHERE user_id = auth.uid()));

CREATE POLICY "Users can update holdings in their wizard portfolios"
  ON wizard_holding FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM wizard_portfolio WHERE user_id = auth.uid()));

-- wizard_transaction RLS
CREATE POLICY "Users can view transactions of their wizard portfolios"
  ON wizard_transaction FOR SELECT
  USING (portfolio_id IN (SELECT id FROM wizard_portfolio WHERE user_id = auth.uid()));

CREATE POLICY "Users can create transactions in their wizard portfolios"
  ON wizard_transaction FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM wizard_portfolio WHERE user_id = auth.uid()));

-- updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS update_wizard_portfolio_updated_at ON wizard_portfolio;
CREATE TRIGGER update_wizard_portfolio_updated_at
  BEFORE UPDATE ON wizard_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wizard_holding_updated_at ON wizard_holding;
CREATE TRIGGER update_wizard_holding_updated_at
  BEFORE UPDATE ON wizard_holding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
