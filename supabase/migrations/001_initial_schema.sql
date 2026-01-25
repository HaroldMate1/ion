-- Investment Demo App - Initial Database Schema
-- This migration creates all tables, indexes, RLS policies, and functions

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE asset_type AS ENUM ('stock', 'crypto', 'etf');
CREATE TYPE transaction_type AS ENUM ('buy', 'sell');

-- ============================================================================
-- TABLES
-- ============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  initial_balance DECIMAL(15,2) DEFAULT 100000.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Virtual cash balances
CREATE TABLE public.balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_cash DECIMAL(15,2) NOT NULL DEFAULT 100000.00,
  reserved_cash DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_invested DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Current portfolio holdings
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_type asset_type NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  quantity DECIMAL(20,8) NOT NULL CHECK (quantity > 0),
  average_buy_price DECIMAL(15,2) NOT NULL,
  total_invested DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, asset_type)
);

-- Transaction history
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_type asset_type NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  transaction_type transaction_type NOT NULL,
  quantity DECIMAL(20,8) NOT NULL,
  price_per_unit DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watchlists
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_type asset_type NOT NULL,
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, asset_type)
);

-- Portfolio snapshots for historical tracking
CREATE TABLE public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_value DECIMAL(15,2) NOT NULL,
  cash_balance DECIMAL(15,2) NOT NULL,
  portfolio_value DECIMAL(15,2) NOT NULL,
  total_profit_loss DECIMAL(15,2) NOT NULL,
  total_profit_loss_percentage DECIMAL(8,4) NOT NULL,
  snapshot_date TIMESTAMPTZ DEFAULT NOW()
);

-- Price cache to reduce API calls
CREATE TABLE public.price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  asset_type asset_type NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  change_24h DECIMAL(8,4),
  volume_24h DECIMAL(20,2),
  market_cap DECIMAL(20,2),
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, asset_type)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_watchlists_user_id ON public.watchlists(user_id);
CREATE INDEX idx_portfolio_snapshots_user_id ON public.portfolio_snapshots(user_id);
CREATE INDEX idx_portfolio_snapshots_date ON public.portfolio_snapshots(snapshot_date DESC);
CREATE INDEX idx_price_cache_symbol ON public.price_cache(symbol, asset_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Balances policies
CREATE POLICY "Users can view own balance" ON public.balances
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own balance" ON public.balances
  FOR UPDATE USING (auth.uid() = user_id);

-- Portfolios policies
CREATE POLICY "Users can view own portfolio" ON public.portfolios
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio" ON public.portfolios
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio" ON public.portfolios
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio" ON public.portfolios
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Watchlists policies
CREATE POLICY "Users can manage own watchlist" ON public.watchlists
  FOR ALL USING (auth.uid() = user_id);

-- Portfolio snapshots policies
CREATE POLICY "Users can view own snapshots" ON public.portfolio_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert snapshots" ON public.portfolio_snapshots
  FOR INSERT WITH CHECK (true);

-- Price cache is public read
CREATE POLICY "Anyone can read price cache" ON public.price_cache
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage price cache" ON public.price_cache
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create balance with initial $100,000
  INSERT INTO public.balances (user_id, available_cash)
  VALUES (NEW.id, 100000.00);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_balances
  BEFORE UPDATE ON public.balances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_portfolios
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Insert some popular assets into price cache (will be updated by API)
INSERT INTO public.price_cache (symbol, asset_type, price, change_24h, volume_24h, market_cap, cached_at)
VALUES
  ('AAPL', 'stock', 180.00, 0.50, 50000000, 2800000000000, NOW()),
  ('TSLA', 'stock', 250.00, 1.20, 80000000, 800000000000, NOW()),
  ('GOOGL', 'stock', 140.00, -0.30, 25000000, 1750000000000, NOW()),
  ('MSFT', 'stock', 380.00, 0.80, 22000000, 2850000000000, NOW()),
  ('SPY', 'etf', 475.00, 0.25, 70000000, NULL, NOW()),
  ('QQQ', 'etf', 400.00, 0.60, 40000000, NULL, NOW()),
  ('BTC', 'crypto', 45000.00, 2.50, 25000000000, 880000000000, NOW()),
  ('ETH', 'crypto', 2500.00, 3.20, 12000000000, 300000000000, NOW()),
  ('BNB', 'crypto', 320.00, 1.50, 1200000000, 50000000000, NOW()),
  ('SOL', 'crypto', 110.00, 5.00, 800000000, 48000000000, NOW())
ON CONFLICT (symbol, asset_type) DO NOTHING;
