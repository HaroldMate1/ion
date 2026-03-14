-- ============================================================================
-- Migration 008b: Migrate all 'colombia' data to 'latam'
-- Run AFTER 008a has been committed
-- ============================================================================

-- Enum-typed columns (portfolios, transactions — use market_type enum)
UPDATE portfolios SET market = 'latam' WHERE market = 'colombia';
UPDATE transactions SET market = 'latam' WHERE market = 'colombia';

-- VARCHAR-typed columns (coach tables)
UPDATE coach_signal SET market = 'latam' WHERE market = 'colombia';
UPDATE coach_paper_trade SET market = 'latam' WHERE market = 'colombia';

-- TEXT-typed columns (only _holding tables have a market column)
UPDATE llm_holding SET market = 'latam' WHERE market = 'colombia';
UPDATE expert_holding SET market = 'latam' WHERE market = 'colombia';
