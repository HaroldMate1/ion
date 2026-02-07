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

export const llmPortfolioKeys = {
  all: ['llm-portfolios'] as const,
  list: () => [...llmPortfolioKeys.all, 'list'] as const,
  detail: (id: string) => [...llmPortfolioKeys.all, 'detail', id] as const,
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
