-- ============================================================
-- 015_wallet_dca_current_value.sql
-- Add current_value to wallet_dca so the portfolio's real
-- market value is tracked and included in total wealth.
-- ============================================================

ALTER TABLE wallet_dca
  ADD COLUMN IF NOT EXISTS current_value NUMERIC(20, 2) DEFAULT 0;
