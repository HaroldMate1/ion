/**
 * Apply the trading portfolios migration to the live Supabase instance.
 * Uses the Supabase Management API (pg_meta) to execute raw SQL.
 * Run: node scripts/apply-trading-migration.mjs
 */

const SUPABASE_URL = 'https://ysvfnjyagrypqilaqksq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzdmZuanlhZ3J5cHFpbGFxa3NxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4NTI4NSwiZXhwIjoyMDg0ODYxMjg1fQ.6sC8syTfGZL0aIkb_esnPBMAvFPJx7v6jiDq9rgVRFg';

const SQL = `
-- 1. Drop existing check constraint on provider
ALTER TABLE llm_portfolio DROP CONSTRAINT IF EXISTS llm_portfolio_provider_check;

-- 2. Add updated check constraint including trading providers
ALTER TABLE llm_portfolio ADD CONSTRAINT llm_portfolio_provider_check
  CHECK (provider IN (
    'claude', 'chatgpt', 'gemini', 'perplexity', 'grok',
    'claude-trading', 'chatgpt-trading', 'gemini-trading'
  ));

-- 3. Create table for daily text logs
CREATE TABLE IF NOT EXISTS llm_daily_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES llm_portfolio(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS on new table
ALTER TABLE llm_daily_log ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for llm_daily_log (use IF NOT EXISTS pattern via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view logs of their portfolios' AND tablename = 'llm_daily_log') THEN
    CREATE POLICY "Users can view logs of their portfolios"
      ON llm_daily_log FOR SELECT
      USING (
        portfolio_id IN (
          SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create logs in their portfolios' AND tablename = 'llm_daily_log') THEN
    CREATE POLICY "Users can create logs in their portfolios"
      ON llm_daily_log FOR INSERT
      WITH CHECK (
        portfolio_id IN (
          SELECT id FROM llm_portfolio WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 6. Index for performance
CREATE INDEX IF NOT EXISTS idx_llm_daily_log_portfolio ON llm_daily_log(portfolio_id, created_at DESC);
`;

async function applyMigration() {
  console.log('Applying trading portfolios migration...');

  // Use the Supabase pg_meta query endpoint
  const response = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'X-Connection-Encrypted': 'true',
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Migration failed:', response.status, text);
    
    // Fallback: try individual statements via PostgREST-compatible RPC
    console.log('\nFallback: Trying statements individually...');
    await tryIndividualStatements();
    return;
  }

  const result = await response.json();
  console.log('Migration applied successfully:', result);
}

async function tryIndividualStatements() {
  const statements = [
    "ALTER TABLE llm_portfolio DROP CONSTRAINT IF EXISTS llm_portfolio_provider_check",
    "ALTER TABLE llm_portfolio ADD CONSTRAINT llm_portfolio_provider_check CHECK (provider IN ('claude', 'chatgpt', 'gemini', 'perplexity', 'grok', 'claude-trading', 'chatgpt-trading', 'gemini-trading'))",
    "CREATE TABLE IF NOT EXISTS llm_daily_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), portfolio_id UUID NOT NULL REFERENCES llm_portfolio(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "ALTER TABLE llm_daily_log ENABLE ROW LEVEL SECURITY",
    "CREATE INDEX IF NOT EXISTS idx_llm_daily_log_portfolio ON llm_daily_log(portfolio_id, created_at DESC)",
  ];

  for (const sql of statements) {
    try {
      const response = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      if (response.ok) {
        console.log(`✅ ${sql.substring(0, 60)}...`);
      } else {
        const text = await response.text();
        console.warn(`⚠️ ${sql.substring(0, 60)}... -> ${text}`);
      }
    } catch (err) {
      console.warn(`❌ ${sql.substring(0, 60)}... -> ${err}`);
    }
  }
}

applyMigration().catch(console.error);
