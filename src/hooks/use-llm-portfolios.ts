/**
 * LLM Portfolios React Query Hooks
 * Hooks for fetching and managing LLM portfolio data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LLMProvider } from '@/config/llm-allocations';
import type {
  LLMPortfolio,
  LLMPortfolioWithHoldings,
  InitializeLLMPortfolioResponse,
} from '@/types/llm-portfolio.types';

// ============================================================================
// Query Keys
// ============================================================================

// ============================================================================
// Query Keys
// ============================================================================

export const llmPortfolioKeys = {
  all: ['llm-portfolios'] as const,
  list: () => [...llmPortfolioKeys.all, 'list'] as const,
  detail: (id: string) => [...llmPortfolioKeys.all, 'detail', id] as const,
  logs: (id: string) => [...llmPortfolioKeys.all, 'logs', id] as const,
};

// ============================================================================
// Types
// ============================================================================

interface LLMPortfolioListItem extends LLMPortfolio {
  displayName: string;
  description: string;
  strategy: string;
}

interface ListPortfoliosResponse {
  portfolios: LLMPortfolioListItem[];
}

interface GetPortfolioResponse {
  portfolio: LLMPortfolioWithHoldings & {
    displayName: string;
    description: string;
    strategy: string;
  };
}

interface DailyLog {
  id: string;
  portfolio_id: string;
  content: string;
  created_at: string;
}

interface ListLogsResponse {
  logs: DailyLog[];
}

interface TradeRequest {
  portfolioId: string;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  assetType?: string;
  market?: string;
}

// ============================================================================
// List Hooks
// ============================================================================

/**
 * Hook to fetch all LLM portfolios for the current user
 * Returns all 5 LLM portfolios (including uninitialized ones)
 */
export function useLLMPortfolios() {
  return useQuery({
    queryKey: llmPortfolioKeys.list(),
    queryFn: async (): Promise<ListPortfoliosResponse> => {
      const response = await fetch('/api/llm/portfolios');
      if (!response.ok) {
        throw new Error('Failed to fetch LLM portfolios');
      }
      return response.json();
    },
  });
}

/**
 * Hook to fetch daily logs for a portfolio
 */
export function useLLMDailyLogs(portfolioId: string | null) {
  return useQuery({
    queryKey: llmPortfolioKeys.logs(portfolioId || ''),
    queryFn: async (): Promise<ListLogsResponse> => {
      if (!portfolioId) throw new Error('Portfolio ID required');
      const response = await fetch(`/api/llm/logs?portfolioId=${portfolioId}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
    enabled: !!portfolioId,
  });
}

// ============================================================================
// Detail Hooks
// ============================================================================

/**
 * Hook to fetch a single LLM portfolio with holdings and enriched market data
 */
export function useLLMPortfolio(id: string | null) {
  return useQuery({
    queryKey: llmPortfolioKeys.detail(id || ''),
    queryFn: async (): Promise<GetPortfolioResponse> => {
      if (!id) throw new Error('Portfolio ID required');

      const response = await fetch(`/api/llm/portfolios/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch LLM portfolio');
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Reset (delete) an LLM portfolio so it can be re-initialized from scratch.
 */
export function useResetLLMPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/llm/portfolios/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset portfolio');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.all });
    },
  });
}

/**
 * Hook to initialize a new LLM portfolio with predefined allocations
 */
export function useInitializeLLMPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: LLMProvider): Promise<InitializeLLMPortfolioResponse> => {
      const response = await fetch('/api/llm/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initialize portfolio');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate the list to refetch all portfolios
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.list() });
    },
  });
}

/**
 * Hook to create a daily log entry
 */
export function useCreateLLMDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ portfolioId, content }: { portfolioId: string; content: string }) => {
      const response = await fetch('/api/llm/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, content }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create log');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.logs(variables.portfolioId) });
    },
  });
}

/**
 * Hook to execute a trade
 */
export function useExecuteLLMTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trade: TradeRequest) => {
      const response = await fetch('/api/llm/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute trade');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.detail(variables.portfolioId) });
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.list() });
    },
  });
}

/**
 * Hook to parse LLM text and auto-execute trades
 * Saves the daily log and executes all detected BUY/SELL instructions.
 */
export interface ParseAndTradeResult {
  symbol: string;
  action: string;
  status: string;
  detail: string;
}

export interface ParseAndTradeResponse {
  success: boolean;
  tradesFound: number;
  results: ParseAndTradeResult[];
  logSaved: boolean;
}

export function useParseAndTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ portfolioId, content }: { portfolioId: string; content: string }): Promise<ParseAndTradeResponse> => {
      const response = await fetch('/api/llm/parse-and-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, content }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse and execute trades');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.detail(variables.portfolioId) });
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.list() });
      queryClient.invalidateQueries({ queryKey: llmPortfolioKeys.logs(variables.portfolioId) });
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to get summary statistics across all LLM portfolios
 */
export function useLLMPortfoliosSummary() {
  const { data, isLoading } = useLLMPortfolios();

  const portfolios = data?.portfolios || [];
  const initializedCount = portfolios.filter(p => p.isInitialized).length;
  const totalValue = portfolios
    .filter(p => p.isInitialized)
    .reduce((sum, p) => sum + p.totalValue, 0);
  const averageReturn = initializedCount > 0
    ? portfolios
        .filter(p => p.isInitialized)
        .reduce((sum, p) => sum + p.totalReturnPct, 0) / initializedCount
    : 0;

  // Find best and worst performing
  const sortedByReturn = [...portfolios]
    .filter(p => p.isInitialized)
    .sort((a, b) => b.totalReturnPct - a.totalReturnPct);

  const bestPerformer = sortedByReturn[0] || null;
  const worstPerformer = sortedByReturn[sortedByReturn.length - 1] || null;

  return {
    isLoading,
    portfolios,
    initializedCount,
    totalValue,
    averageReturn,
    bestPerformer,
    worstPerformer,
  };
}

/**
 * Hook to find a portfolio by provider name
 */
export function useLLMPortfolioByProvider(provider: LLMProvider) {
  const { data, isLoading } = useLLMPortfolios();

  const portfolio = data?.portfolios?.find(p => p.provider === provider) || null;

  return {
    isLoading,
    portfolio,
  };
}
