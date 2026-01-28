-- Migration: Add market field to portfolios and transactions tables
-- This allows tracking which market (US, Europe, Colombia) an asset belongs to

-- Create market enum type
DO $$ BEGIN
    CREATE TYPE market_type AS ENUM ('us', 'europe', 'colombia');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add market column to portfolios table with default 'us'
ALTER TABLE portfolios
ADD COLUMN IF NOT EXISTS market market_type DEFAULT 'us';

-- Add market column to transactions table with default 'us'
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS market market_type DEFAULT 'us';

-- Update existing records to have 'us' market (they were all US before)
UPDATE portfolios SET market = 'us' WHERE market IS NULL;
UPDATE transactions SET market = 'us' WHERE market IS NULL;

-- Drop old unique constraint if exists and create new one including market
-- First, find and drop the existing constraint
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'portfolios'::regclass
    AND contype = 'u'
    AND conname LIKE '%user_id%symbol%asset_type%'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END IF;
END $$;

-- Create new unique constraint including market
ALTER TABLE portfolios
ADD CONSTRAINT portfolios_user_id_symbol_asset_type_market_key
UNIQUE (user_id, symbol, asset_type, market);

-- Add index for faster market-based queries
CREATE INDEX IF NOT EXISTS idx_portfolios_market ON portfolios(market);
CREATE INDEX IF NOT EXISTS idx_transactions_market ON transactions(market);
