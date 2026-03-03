/**
 * TypeScript types for Wizard portfolio feature
 */

import type { WizardStrategy } from '@/config/wizard-strategies';

// ── Database row shapes ────────────────────────────────────────────────────

export interface WizardPortfolioRow {
  id: string;
  user_id: string;
  strategy: WizardStrategy;
  is_initialized: boolean;
  total_value: string | number;
  cash_balance: string | number;
  total_return_pct: string | number;
  companies_screened: number | null;
  screening_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface WizardHoldingRow {
  id: string;
  portfolio_id: string;
  symbol: string;
  asset_name: string | null;
  pe_ratio: string | number | null;
  earnings_yield: string | number | null;
  return_on_equity: string | number | null;
  magic_rank: number | null;
  target_allocation_pct: string | number;
  quantity: string | number;
  average_buy_price: string | number;
  total_invested: string | number;
  created_at: string;
  updated_at: string;
}

// ── Application-level types ────────────────────────────────────────────────

export interface WizardPortfolio {
  id: string;
  userId: string;
  strategy: WizardStrategy;
  isInitialized: boolean;
  totalValue: number;
  cashBalance: number;
  totalReturnPct: number;
  companiesScreened: number | null;
  screeningDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WizardHolding {
  id: string;
  portfolioId: string;
  symbol: string;
  assetName: string | null;
  peRatio: number | null;
  earningsYield: number | null;
  returnOnEquity: number | null;
  magicRank: number | null;
  targetAllocationPct: number;
  quantity: number;
  averageBuyPrice: number;
  totalInvested: number;
}

export interface WizardHoldingEnriched extends WizardHolding {
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPct: number | null;
  actualAllocationPct: number | null;
  notes: string | null;
}

export interface InitializeWizardPortfolioResponse {
  success: boolean;
  holdingsCreated: number;
  companiesScreened: number;
  errors?: string[];
}

// ── Transforms ─────────────────────────────────────────────────────────────

export function transformWizardPortfolioRow(row: WizardPortfolioRow): WizardPortfolio {
  return {
    id: row.id,
    userId: row.user_id,
    strategy: row.strategy,
    isInitialized: row.is_initialized,
    totalValue: Number(row.total_value),
    cashBalance: Number(row.cash_balance),
    totalReturnPct: Number(row.total_return_pct),
    companiesScreened: row.companies_screened,
    screeningDate: row.screening_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function transformWizardHoldingRow(row: WizardHoldingRow): WizardHolding {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    symbol: row.symbol,
    assetName: row.asset_name,
    peRatio: row.pe_ratio != null ? Number(row.pe_ratio) : null,
    earningsYield: row.earnings_yield != null ? Number(row.earnings_yield) : null,
    returnOnEquity: row.return_on_equity != null ? Number(row.return_on_equity) : null,
    magicRank: row.magic_rank,
    targetAllocationPct: Number(row.target_allocation_pct),
    quantity: Number(row.quantity),
    averageBuyPrice: Number(row.average_buy_price),
    totalInvested: Number(row.total_invested),
  };
}
