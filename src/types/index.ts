/**
 * Application Types
 */

import type { AssetType, TransactionType } from './database.types';

// Portfolio types
export interface Portfolio {
  id: string;
  symbol: string;
  asset_name: string;
  asset_type: AssetType;
  quantity: number;
  average_buy_price: number;
  total_invested: number;
  current_price?: number;
  current_value?: number;
  unrealized_pl?: number;
  unrealized_pl_percentage?: number;
}

// Transaction types
export interface Transaction {
  id: string;
  symbol: string;
  asset_name: string;
  asset_type: AssetType;
  transaction_type: TransactionType;
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  fee: number;
  created_at: string;
}

// Balance types
export interface Balance {
  available_cash: number;
  reserved_cash: number;
  total_invested: number;
}

// Market data types
export interface MarketQuote {
  symbol: string;
  asset_type: AssetType;
  price: number;
  change_24h?: number;
  volume_24h?: number;
  market_cap?: number;
}

export interface AssetSearchResult {
  symbol: string;
  name: string;
  asset_type: AssetType;
  exchange?: string;
}

// Portfolio summary
export interface PortfolioSummary {
  total_value: number;
  cash_balance: number;
  portfolio_value: number;
  total_profit_loss: number;
  total_profit_loss_percentage: number;
}

// Historical data point
export interface HistoricalDataPoint {
  date: string;
  value: number;
}

export type { AssetType, TransactionType };
