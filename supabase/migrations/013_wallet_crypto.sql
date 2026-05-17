-- ============================================================
-- 013_wallet_crypto.sql
-- Crypto holdings table for the Wallet feature
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_crypto (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_symbol         TEXT NOT NULL,              -- e.g. BTC, ETH, SOL
  coin_name           TEXT NOT NULL,              -- e.g. Bitcoin, Ethereum
  amount_held         NUMERIC(30, 8) NOT NULL,    -- supports fractional coins
  purchase_price_usd  NUMERIC(20, 2),             -- avg purchase price per coin (USD)
  purchase_date       DATE,
  current_price_usd   NUMERIC(20, 2) DEFAULT 0,  -- manually updated current price (USD)
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE wallet_crypto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own crypto"
  ON wallet_crypto FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS update_wallet_crypto_updated_at ON wallet_crypto;
CREATE TRIGGER update_wallet_crypto_updated_at
  BEFORE UPDATE ON wallet_crypto
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_crypto_user ON wallet_crypto(user_id);
