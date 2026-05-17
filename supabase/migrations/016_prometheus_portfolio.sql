-- Migration 016: Prometheus Autonomous Trading Portfolio
-- $100k paper portfolio driven by FDA/EMA regulatory signals
-- Trades execute automatically on strong_buy / strong_sell signals

-- ── Config (one row per user) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prometheus_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kill_switch  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Trades ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prometheus_trade (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol           TEXT NOT NULL,
  drug_name        TEXT,            -- Brand/generic name of the drug (for context)
  signal_rationale TEXT,            -- Why Prometheus opened this trade
  side             TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  entry_price      NUMERIC(20,8) NOT NULL,
  size_usd         NUMERIC(20,2) NOT NULL,
  quantity         NUMERIC(20,8) NOT NULL,
  stop_loss        NUMERIC(20,8),
  take_profit      NUMERIC(20,8),   -- Single TP for simplicity (regulatory plays)
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped', 'tp_hit')),
  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,
  exit_price       NUMERIC(20,8),
  pnl_usd          NUMERIC(20,2),
  pnl_pct          NUMERIC(10,4),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prometheus_trade_user_status  ON prometheus_trade (user_id, status);
CREATE INDEX IF NOT EXISTS idx_prometheus_trade_symbol       ON prometheus_trade (user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_prometheus_trade_opened_at   ON prometheus_trade (user_id, opened_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE prometheus_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE prometheus_trade  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prometheus config"
  ON prometheus_config FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own prometheus trades"
  ON prometheus_trade FOR ALL USING (auth.uid() = user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_prometheus_config_updated_at ON prometheus_config;
CREATE TRIGGER update_prometheus_config_updated_at
  BEFORE UPDATE ON prometheus_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prometheus_trade_updated_at ON prometheus_trade;
CREATE TRIGGER update_prometheus_trade_updated_at
  BEFORE UPDATE ON prometheus_trade
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
