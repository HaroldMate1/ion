/**
 * Expert Investor Portfolio Types
 */

import type { InvestorSlug, AssetCategory } from '@/config/expert-investors';

export interface ExpertPortfolio {
  id: string;
  userId: string;
  investorSlug: InvestorSlug;
  isInitialized: boolean;
  totalValue: number;
  cashBalance: number;
  totalReturnPct: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertHolding {
  id: string;
  portfolioId: string;
  symbol: string;
  assetName: string | null;
  assetType: AssetCategory;
  market: string;
  targetAllocationPct: number;
  quantity: number;
  averageBuyPrice: number;
  totalInvested: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertHoldingEnriched extends ExpertHolding {
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPct: number | null;
  actualAllocationPct: number | null;
}

export interface ExpertTransaction {
  id: string;
  portfolioId: string;
  symbol: string;
  transactionType: 'buy' | 'sell' | 'dividend';
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
}

export interface ExpertPortfolioWithHoldings extends ExpertPortfolio {
  holdings: ExpertHoldingEnriched[];
}

// Database row types (snake_case)
export interface ExpertPortfolioRow {
  id: string;
  user_id: string;
  investor_slug: string;
  is_initialized: boolean;
  total_value: string;
  cash_balance: string;
  total_return_pct: string;
  created_at: string;
  updated_at: string;
}

export interface ExpertHoldingRow {
  id: string;
  portfolio_id: string;
  symbol: string;
  asset_name: string | null;
  asset_type: string;
  market: string;
  target_allocation_pct: string;
  quantity: string;
  average_buy_price: string;
  total_invested: string;
  created_at: string;
  updated_at: string;
}

export function transformExpertPortfolioRow(row: ExpertPortfolioRow): ExpertPortfolio {
  return {
    id: row.id,
    userId: row.user_id,
    investorSlug: row.investor_slug as InvestorSlug,
    isInitialized: row.is_initialized,
    totalValue: parseFloat(row.total_value),
    cashBalance: parseFloat(row.cash_balance),
    totalReturnPct: parseFloat(row.total_return_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function transformExpertHoldingRow(row: ExpertHoldingRow): ExpertHolding {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    symbol: row.symbol,
    assetName: row.asset_name,
    assetType: row.asset_type as AssetCategory,
    market: row.market,
    targetAllocationPct: parseFloat(row.target_allocation_pct),
    quantity: parseFloat(row.quantity),
    averageBuyPrice: parseFloat(row.average_buy_price),
    totalInvested: parseFloat(row.total_invested),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface InitializeExpertPortfolioResponse {
  success: boolean;
  portfolio: ExpertPortfolio;
  holdingsCreated: number;
  transactionsCreated: number;
  errors?: string[];
}
