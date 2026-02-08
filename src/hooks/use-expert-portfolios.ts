/**
 * Expert Investor Portfolios React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InvestorSlug } from '@/config/expert-investors';
import type {
  ExpertPortfolio,
  ExpertPortfolioWithHoldings,
  InitializeExpertPortfolioResponse,
} from '@/types/expert-portfolio.types';

export const expertPortfolioKeys = {
  all: ['expert-portfolios'] as const,
  list: () => [...expertPortfolioKeys.all, 'list'] as const,
  detail: (id: string) => [...expertPortfolioKeys.all, 'detail', id] as const,
};

interface ExpertPortfolioListItem extends ExpertPortfolio {
  displayName: string;
  fullName: string;
  title: string;
  description: string;
  strategy: string;
  dataSource: string;
  lastUpdated: string;
}

interface ListExpertPortfoliosResponse {
  portfolios: ExpertPortfolioListItem[];
}

interface GetExpertPortfolioResponse {
  portfolio: ExpertPortfolioWithHoldings & {
    displayName: string;
    fullName: string;
    title: string;
    description: string;
    strategy: string;
    dataSource: string;
    lastUpdated: string;
  };
}

/**
 * Fetch all expert investor portfolios
 */
export function useExpertPortfolios() {
  return useQuery({
    queryKey: expertPortfolioKeys.list(),
    queryFn: async (): Promise<ListExpertPortfoliosResponse> => {
      const response = await fetch('/api/expert/portfolios');
      if (!response.ok) throw new Error('Failed to fetch expert portfolios');
      return response.json();
    },
  });
}

/**
 * Fetch a single expert portfolio with enriched holdings
 * Refetches every 60 seconds for live price updates
 */
export function useExpertPortfolio(id: string | null) {
  return useQuery({
    queryKey: expertPortfolioKeys.detail(id || ''),
    queryFn: async (): Promise<GetExpertPortfolioResponse> => {
      if (!id) throw new Error('Portfolio ID required');
      const response = await fetch(`/api/expert/portfolios/${id}`);
      if (!response.ok) throw new Error('Failed to fetch expert portfolio');
      return response.json();
    },
    enabled: !!id,
    refetchInterval: 60000, // Refetch every 60s for live prices
  });
}

/**
 * Initialize an expert investor portfolio
 */
export function useInitializeExpertPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (investorSlug: InvestorSlug): Promise<InitializeExpertPortfolioResponse> => {
      const response = await fetch('/api/expert/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investorSlug }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initialize portfolio');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expertPortfolioKeys.list() });
    },
  });
}
