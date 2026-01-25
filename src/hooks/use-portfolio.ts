/**
 * Portfolio Hook
 * Fetch and manage user's portfolio with real-time prices
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './use-auth';
import { useMarketQuotes } from './use-market-data';
import type { Portfolio, PortfolioSummary } from '@/types';

/**
 * Get user's portfolio holdings
 */
export function usePortfolio() {
  const { user } = useAuth();
  const supabase = createClient();

  const { data: holdings = [], ...query } = useQuery({
    queryKey: ['portfolio', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Get current prices for all holdings
  const assets = holdings.map((h) => ({
    symbol: h.symbol,
    assetType: h.asset_type,
  }));

  const { data: quotes = [] } = useMarketQuotes(assets, holdings.length > 0);

  // Enrich holdings with current prices and P&L
  const enrichedHoldings: Portfolio[] = holdings.map((holding) => {
    const quote = quotes.find(
      (q: any) => q.symbol === holding.symbol && q.asset_type === holding.asset_type
    );

    const currentPrice = quote?.price || 0;
    const currentValue = Number(holding.quantity) * currentPrice;
    const unrealizedPL = currentValue - Number(holding.total_invested);
    const unrealizedPLPercentage =
      Number(holding.total_invested) > 0
        ? (unrealizedPL / Number(holding.total_invested)) * 100
        : 0;

    return {
      id: holding.id,
      symbol: holding.symbol,
      asset_name: holding.asset_name,
      asset_type: holding.asset_type,
      quantity: Number(holding.quantity),
      average_buy_price: Number(holding.average_buy_price),
      total_invested: Number(holding.total_invested),
      current_price: currentPrice,
      current_value: currentValue,
      unrealized_pl: unrealizedPL,
      unrealized_pl_percentage: unrealizedPLPercentage,
    };
  });

  return {
    holdings: enrichedHoldings,
    ...query,
  };
}

/**
 * Get user's balance
 */
export function useBalance() {
  const { user } = useAuth();
  const supabase = createClient();

  return useQuery({
    queryKey: ['balance', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('balances')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      return {
        available_cash: Number(data.available_cash),
        reserved_cash: Number(data.reserved_cash),
        total_invested: Number(data.total_invested),
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get portfolio summary with total value and P&L
 */
export function usePortfolioSummary(): PortfolioSummary | null {
  const { holdings } = usePortfolio();
  const { data: balance } = useBalance();

  if (!balance) return null;

  // Filter holdings with available prices (exclude holdings where price is unavailable)
  const holdingsWithPrices = holdings.filter(h => h.current_price && h.current_price > 0);

  const portfolioValue = holdingsWithPrices.reduce((sum, h) => sum + (h.current_value || 0), 0);
  const totalInvestedInAvailableHoldings = holdingsWithPrices.reduce((sum, h) => sum + h.total_invested, 0);
  const totalValue = balance.available_cash + portfolioValue;
  const totalProfitLoss = portfolioValue - totalInvestedInAvailableHoldings;
  const totalProfitLossPercentage =
    totalInvestedInAvailableHoldings > 0 ? (totalProfitLoss / totalInvestedInAvailableHoldings) * 100 : 0;

  return {
    total_value: totalValue,
    cash_balance: balance.available_cash,
    portfolio_value: portfolioValue,
    total_profit_loss: totalProfitLoss,
    total_profit_loss_percentage: totalProfitLossPercentage,
  };
}

/**
 * Execute a buy trade
 */
export function useBuyTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trade: {
      symbol: string;
      assetType: string;
      assetName: string;
      quantity: number;
    }) => {
      const response = await fetch('/api/trade/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute buy trade');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate portfolio and balance queries
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Execute a sell trade
 */
export function useSellTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trade: {
      symbol: string;
      assetType: string;
      assetName: string;
      quantity: number;
    }) => {
      const response = await fetch('/api/trade/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute sell trade');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate portfolio and balance queries
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
