/**
 * LLM Portfolio Types
 * Types for the LLM portfolio comparison feature
 */

import type { LLMProvider, AssetCategory } from '@/config/llm-allocations';

/**
 * LLM Portfolio - Main portfolio record
 */
export interface LLMPortfolio {
  id: string;
  userId: string;
  provider: LLMProvider;
  isInitialized: boolean;
  totalValue: number;
  cashBalance: number;
  totalReturnPct: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * LLM Holding - Individual position within a portfolio
 */
export interface LLMHolding {
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

/**
 * LLM Holding with enriched market data
 */
export interface LLMHoldingEnriched extends LLMHolding {
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPct: number | null;
  actualAllocationPct: number | null;
}

/**
 * LLM Transaction - Buy/sell record
 */
export interface LLMTransaction {
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

/**
 * LLM Portfolio Snapshot - Daily portfolio value for charts
 */
export interface LLMPortfolioSnapshot {
  id: string;
  portfolioId: string;
  totalValue: number;
  totalReturnPct: number;
  snapshotDate: string;
  createdAt: string;
}

/**
 * LLM Portfolio with holdings (for detail view)
 */
export interface LLMPortfolioWithHoldings extends LLMPortfolio {
  holdings: LLMHoldingEnriched[];
}

/**
 * Database row types (snake_case from Supabase)
 */
export interface LLMPortfolioRow {
  id: string;
  user_id: string;
  provider: string;
  is_initialized: boolean;
  total_value: string;
  cash_balance: string;
  total_return_pct: string;
  created_at: string;
  updated_at: string;
}

export interface LLMHoldingRow {
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

export interface LLMTransactionRow {
  id: string;
  portfolio_id: string;
  symbol: string;
  transaction_type: string;
  quantity: string;
  price_per_unit: string;
  total_amount: string;
  notes: string | null;
  created_at: string;
}

export interface LLMPortfolioSnapshotRow {
  id: string;
  portfolio_id: string;
  total_value: string;
  total_return_pct: string;
  snapshot_date: string;
  created_at: string;
}

/**
 * Transform database row to LLMPortfolio
 */
export function transformPortfolioRow(row: LLMPortfolioRow): LLMPortfolio {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as LLMProvider,
    isInitialized: row.is_initialized,
    totalValue: parseFloat(row.total_value),
    cashBalance: parseFloat(row.cash_balance),
    totalReturnPct: parseFloat(row.total_return_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform database row to LLMHolding
 */
export function transformHoldingRow(row: LLMHoldingRow): LLMHolding {
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

/**
 * Transform database row to LLMTransaction
 */
export function transformTransactionRow(row: LLMTransactionRow): LLMTransaction {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    symbol: row.symbol,
    transactionType: row.transaction_type as 'buy' | 'sell' | 'dividend',
    quantity: parseFloat(row.quantity),
    pricePerUnit: parseFloat(row.price_per_unit),
    totalAmount: parseFloat(row.total_amount),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/**
 * Initialize request payload
 */
export interface InitializeLLMPortfolioRequest {
  provider: LLMProvider;
}

/**
 * Initialize response
 */
export interface InitializeLLMPortfolioResponse {
  success: boolean;
  portfolio: LLMPortfolio;
  holdingsCreated: number;
  transactionsCreated: number;
  errors?: string[];
}

/**
 * List portfolios response
 */
export interface ListLLMPortfoliosResponse {
  portfolios: LLMPortfolio[];
}

/**
 * Get portfolio response
 */
export interface GetLLMPortfolioResponse {
  portfolio: LLMPortfolioWithHoldings;
}
