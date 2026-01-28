-- Migration: Trading Coach Feature
-- Adds tables for AI-powered trading suggestions (paper trades only)

-- Coach Configuration Table (user preferences and settings)
CREATE TABLE IF NOT EXISTS coach_config (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Kill switch
    kill_switch BOOLEAN DEFAULT FALSE,

    -- Agent weights (0-1)
    weight_indicator DECIMAL(3,2) DEFAULT 0.40,
    weight_price_action DECIMAL(3,2) DEFAULT 0.35,
    weight_news DECIMAL(3,2) DEFAULT 0.25,

    -- Consensus thresholds
    min_confidence DECIMAL(3,2) DEFAULT 0.60,
    min_consensus_score DECIMAL(3,2) DEFAULT 0.55,

    -- Risk parameters
    max_allocation_pct DECIMAL(5,2) DEFAULT 10.00,
    max_open_positions INTEGER DEFAULT 4,
    use_leverage BOOLEAN DEFAULT FALSE,

    -- Stop loss defaults (percentage)
    stop_loss_stock_pct DECIMAL(5,2) DEFAULT 2.50,
    stop_loss_crypto_pct DECIMAL(5,2) DEFAULT 6.00,
    stop_loss_atr_multiplier DECIMAL(4,2) DEFAULT 1.50,

    -- Take profit settings
    tp1_pct DECIMAL(5,2) DEFAULT 50.00,  -- % of position to close at 1R
    tp2_pct DECIMAL(5,2) DEFAULT 25.00,  -- % at 2R
    runner_pct DECIMAL(5,2) DEFAULT 25.00,  -- % to let run
    trailing_atr_multiplier DECIMAL(4,2) DEFAULT 1.00,

    -- Circuit breaker
    daily_drawdown_limit_pct DECIMAL(5,2) DEFAULT 3.00,
    max_consecutive_losses INTEGER DEFAULT 3,

    -- Universe selection
    watch_symbols JSONB DEFAULT '[]'::JSONB,

    -- Run cadence (minutes between runs, 0 = manual only)
    run_cadence_minutes INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coach Signals Table (generated recommendations)
CREATE TABLE IF NOT EXISTS coach_signal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Asset info
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(10) NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto')),
    market VARCHAR(20) DEFAULT 'us',

    -- Timing
    timeframe VARCHAR(10) DEFAULT '1D',
    signal_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Consensus result
    consensus_action VARCHAR(10) NOT NULL CHECK (consensus_action IN ('BUY', 'SELL', 'HOLD')),
    consensus_score DECIMAL(5,4) NOT NULL,  -- 0 to 1

    -- Trade plan
    entry_low DECIMAL(20,8),
    entry_high DECIMAL(20,8),
    stop_loss DECIMAL(20,8),
    take_profit_json JSONB,  -- {tp1: price, tp2: price, runner_trailing: atr_mult}

    -- Agent votes
    agent_votes_json JSONB NOT NULL,  -- [{agent, action, confidence, rationale, metrics}]

    -- Summary
    rationale TEXT,
    expected_return_pct DECIMAL(8,4),
    expected_risk_pct DECIMAL(8,4),
    risk_reward_ratio DECIMAL(6,2),

    -- Market state
    market_open BOOLEAN DEFAULT TRUE,
    current_price DECIMAL(20,8),

    -- Status
    is_stale BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coach Paper Trades Table (simulated trades)
CREATE TABLE IF NOT EXISTS coach_paper_trade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES coach_signal(id) ON DELETE SET NULL,

    -- Asset info
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(10) NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto')),
    market VARCHAR(20) DEFAULT 'us',

    -- Trade details
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    entry_price DECIMAL(20,8) NOT NULL,
    size_usd DECIMAL(20,2) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,

    -- Risk management
    stop_loss DECIMAL(20,8),
    take_profit_json JSONB,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped', 'tp_hit')),

    -- Timing
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,

    -- Results (filled on close)
    exit_price DECIMAL(20,8),
    pnl_usd DECIMAL(20,2),
    pnl_pct DECIMAL(8,4),

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coach Daily Reports Table
CREATE TABLE IF NOT EXISTS coach_daily_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,

    -- Metrics
    metrics_json JSONB NOT NULL,
    -- Expected structure:
    -- {
    --   signals_generated: number,
    --   signals_by_action: {BUY: n, SELL: n, HOLD: n},
    --   paper_trades_opened: number,
    --   paper_trades_closed: number,
    --   realized_pnl_usd: number,
    --   unrealized_pnl_usd: number,
    --   win_rate: number (0-1),
    --   avg_risk_reward: number,
    --   top_performers: [{symbol, pnl_pct}],
    --   worst_performers: [{symbol, pnl_pct}],
    --   circuit_breaker_triggered: boolean,
    --   notes: string
    -- }

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, report_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coach_signal_user_ts ON coach_signal(user_id, signal_ts DESC);
CREATE INDEX IF NOT EXISTS idx_coach_signal_user_symbol ON coach_signal(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_coach_signal_action ON coach_signal(user_id, consensus_action);
CREATE INDEX IF NOT EXISTS idx_coach_paper_trade_user_status ON coach_paper_trade(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_paper_trade_user_opened ON coach_paper_trade(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_daily_report_user_date ON coach_daily_report(user_id, report_date DESC);

-- Enable Row Level Security
ALTER TABLE coach_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_signal ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_paper_trade ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_daily_report ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data

-- coach_config policies
CREATE POLICY "Users can view own coach_config"
    ON coach_config FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coach_config"
    ON coach_config FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coach_config"
    ON coach_config FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- coach_signal policies
CREATE POLICY "Users can view own coach_signal"
    ON coach_signal FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coach_signal"
    ON coach_signal FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coach_signal"
    ON coach_signal FOR UPDATE
    USING (auth.uid() = user_id);

-- coach_paper_trade policies
CREATE POLICY "Users can view own coach_paper_trade"
    ON coach_paper_trade FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coach_paper_trade"
    ON coach_paper_trade FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coach_paper_trade"
    ON coach_paper_trade FOR UPDATE
    USING (auth.uid() = user_id);

-- coach_daily_report policies
CREATE POLICY "Users can view own coach_daily_report"
    ON coach_daily_report FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coach_daily_report"
    ON coach_daily_report FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_coach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS coach_config_updated_at ON coach_config;
CREATE TRIGGER coach_config_updated_at
    BEFORE UPDATE ON coach_config
    FOR EACH ROW
    EXECUTE FUNCTION update_coach_updated_at();

DROP TRIGGER IF EXISTS coach_paper_trade_updated_at ON coach_paper_trade;
CREATE TRIGGER coach_paper_trade_updated_at
    BEFORE UPDATE ON coach_paper_trade
    FOR EACH ROW
    EXECUTE FUNCTION update_coach_updated_at();
