/**
 * Wallet Feature Tables
 * Personal financial tracker: bank accounts, savings/investments, pensions, subscriptions.
 */

-- Bank accounts
CREATE TABLE IF NOT EXISTS wallet_bank_account (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name             TEXT        NOT NULL,
  institution      TEXT        NOT NULL,
  account_type     TEXT        NOT NULL DEFAULT 'checking', -- checking, savings, credit, investment
  currency         TEXT        NOT NULL DEFAULT 'USD',
  current_balance  NUMERIC(20,2) NOT NULL DEFAULT 0,
  last_updated_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly balance snapshots (from CSV/PDF uploads or manual entry)
CREATE TABLE IF NOT EXISTS wallet_monthly_snapshot (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id      UUID        REFERENCES wallet_bank_account(id) ON DELETE CASCADE NOT NULL,
  snapshot_month  DATE        NOT NULL, -- first day of the month
  balance         NUMERIC(20,2) NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'manual', -- manual, csv_upload, pdf_upload
  raw_filename    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, snapshot_month)
);

-- Savings products, fixed deposits, investments, crypto, bonds
CREATE TABLE IF NOT EXISTS wallet_asset (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                 TEXT        NOT NULL,
  asset_type           TEXT        NOT NULL DEFAULT 'savings', -- savings, investment, fixed_deposit, bond, crypto, other
  institution          TEXT,
  current_value        NUMERIC(20,2) NOT NULL,
  initial_investment   NUMERIC(20,2),
  expected_return_pct  NUMERIC(8,4), -- annual percentage
  maturity_date        DATE,
  currency             TEXT        NOT NULL DEFAULT 'USD',
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pension / retirement accounts
CREATE TABLE IF NOT EXISTS wallet_pension (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                    TEXT        NOT NULL,
  provider                TEXT        NOT NULL,
  account_number          TEXT,
  current_value           NUMERIC(20,2) NOT NULL DEFAULT 0,
  monthly_contribution    NUMERIC(20,2) NOT NULL DEFAULT 0,
  employer_contribution   NUMERIC(20,2) NOT NULL DEFAULT 0,
  expected_retirement_age INT,
  currency                TEXT        NOT NULL DEFAULT 'USD',
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurring payments / subscriptions
CREATE TABLE IF NOT EXISTS wallet_subscription (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name              TEXT        NOT NULL,
  provider          TEXT,
  category          TEXT        NOT NULL DEFAULT 'entertainment', -- entertainment, utilities, insurance, software, health, other
  amount            NUMERIC(20,2) NOT NULL,
  currency          TEXT        NOT NULL DEFAULT 'USD',
  billing_cycle     TEXT        NOT NULL DEFAULT 'monthly', -- monthly, yearly, weekly, quarterly
  next_payment_date DATE        NOT NULL,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE wallet_bank_account     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_monthly_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_asset            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_pension          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_subscription     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their wallet_bank_account"
  ON wallet_bank_account FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage their wallet_monthly_snapshot"
  ON wallet_monthly_snapshot FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage their wallet_asset"
  ON wallet_asset FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage their wallet_pension"
  ON wallet_pension FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage their wallet_subscription"
  ON wallet_subscription FOR ALL USING (auth.uid() = user_id);

-- Trigger function (safeguard)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- updated_at triggers
CREATE TRIGGER update_wallet_bank_account_updated_at
  BEFORE UPDATE ON wallet_bank_account
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_asset_updated_at
  BEFORE UPDATE ON wallet_asset
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_pension_updated_at
  BEFORE UPDATE ON wallet_pension
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_subscription_updated_at
  BEFORE UPDATE ON wallet_subscription
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_bank_account_user   ON wallet_bank_account(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_snapshot_account    ON wallet_monthly_snapshot(account_id, snapshot_month DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_snapshot_user       ON wallet_monthly_snapshot(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_asset_user          ON wallet_asset(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_pension_user        ON wallet_pension(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_subscription_user   ON wallet_subscription(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_wallet_subscription_date   ON wallet_subscription(user_id, next_payment_date);
