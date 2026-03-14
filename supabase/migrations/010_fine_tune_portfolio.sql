/**
 * Fine-Tune Portfolio Tables
 * Independent $100k paper portfolio that trades using fine-tuned agent weights.
 * Completely separate from the Coach portfolio.
 */

-- Fine-Tune Portfolio Config (one row per user)
CREATE TABLE IF NOT EXISTS fine_tune_config (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kill_switch          BOOLEAN     NOT NULL DEFAULT FALSE,
  indicator_weight     NUMERIC(5,4) NOT NULL DEFAULT 0.45,
  price_action_weight  NUMERIC(5,4) NOT NULL DEFAULT 0.45,
  news_weight          NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  is_active            BOOLEAN     NOT NULL DEFAULT FALSE,
  last_applied_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Fine-Tune Portfolio Trades
CREATE TABLE IF NOT EXISTS fine_tune_trade (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol           TEXT        NOT NULL,
  asset_type       TEXT        NOT NULL DEFAULT 'stock',
  market           TEXT        NOT NULL DEFAULT 'us',
  side             TEXT        NOT NULL CHECK (side IN ('BUY', 'SELL')),
  entry_price      NUMERIC(20,8) NOT NULL,
  size_usd         NUMERIC(20,2) NOT NULL,
  quantity         NUMERIC(20,8) NOT NULL,
  stop_loss        NUMERIC(20,8),
  take_profit_json JSONB,
  status           TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped', 'tp_hit')),
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,
  exit_price       NUMERIC(20,8),
  pnl_usd          NUMERIC(20,2),
  pnl_pct          NUMERIC(10,4),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE fine_tune_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_tune_trade  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their fine_tune_config"
  ON fine_tune_config FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage their fine_tune_trades"
  ON fine_tune_trade FOR ALL USING (auth.uid() = user_id);

-- Ensure trigger function exists (defined in 003, included here as safeguard)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- updated_at triggers
CREATE TRIGGER update_fine_tune_config_updated_at
  BEFORE UPDATE ON fine_tune_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fine_tune_trade_updated_at
  BEFORE UPDATE ON fine_tune_trade
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fine_tune_trade_user_status ON fine_tune_trade(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fine_tune_trade_symbol      ON fine_tune_trade(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_fine_tune_trade_opened_at   ON fine_tune_trade(user_id, opened_at DESC);
