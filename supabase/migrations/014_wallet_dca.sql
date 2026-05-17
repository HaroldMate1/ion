-- ============================================================
-- 014_wallet_dca.sql
-- Dollar-Cost Averaging (DCA) plans for the Wallet feature
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_dca (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,              -- e.g. "S&P 500 Index", "Bitcoin"
  ticker          TEXT,                       -- optional symbol: SPY, BTC, etc.
  monthly_amount  NUMERIC(20, 2) NOT NULL,    -- fixed monthly investment
  currency        TEXT DEFAULT 'USD',
  start_date      DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE wallet_dca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dca"
  ON wallet_dca FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS update_wallet_dca_updated_at ON wallet_dca;
CREATE TRIGGER update_wallet_dca_updated_at
  BEFORE UPDATE ON wallet_dca
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index
CREATE INDEX IF NOT EXISTS idx_wallet_dca_user ON wallet_dca(user_id);
