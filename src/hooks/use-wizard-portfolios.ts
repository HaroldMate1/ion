/**
 * Wizard Portfolio React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WizardStrategy } from '@/config/wizard-strategies';
import type { InitializeWizardPortfolioResponse } from '@/types/wizard-portfolio.types';

export const wizardPortfolioKeys = {
  all: ['wizard-portfolios'] as const,
  list: () => [...wizardPortfolioKeys.all, 'list'] as const,
  detail: (id: string) => [...wizardPortfolioKeys.all, 'detail', id] as const,
};

/**
 * Fetch all wizard portfolios (Merlin + Houdini)
 */
export function useWizardPortfolios() {
  return useQuery({
    queryKey: wizardPortfolioKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/wizard/portfolios');
      if (!res.ok) throw new Error('Failed to fetch wizard portfolios');
      return res.json();
    },
  });
}

/**
 * Fetch a single wizard portfolio with enriched holdings
 * Refetches every 60 seconds for live price updates
 */
export function useWizardPortfolio(id: string | null) {
  return useQuery({
    queryKey: wizardPortfolioKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Portfolio ID required');
      const res = await fetch(`/api/wizard/portfolios/${id}`);
      if (!res.ok) throw new Error('Failed to fetch wizard portfolio');
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 60_000,
  });
}

/**
 * Initialize a wizard portfolio (runs the stock screener + buys top 30)
 */
export function useInitializeWizardPortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (strategy: WizardStrategy): Promise<InitializeWizardPortfolioResponse> => {
      const res = await fetch('/api/wizard/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to initialize portfolio');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wizardPortfolioKeys.list() });
    },
  });
}
