-- ============================================================================
-- Migration 008a: Add 'latam' value to the market_type enum
-- Must be committed BEFORE it can be used in data updates (PostgreSQL rule)
-- ============================================================================

ALTER TYPE market_type ADD VALUE IF NOT EXISTS 'latam';
