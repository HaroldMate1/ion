/**
 * Benchmark Portfolios React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BenchmarkSlug } from '@/config/benchmark-indexes';

export const benchmarkKeys = {
  all: ['benchmarks'] as const,
  list: () => [...benchmarkKeys.all, 'list'] as const,
  detail: (id: string) => [...benchmarkKeys.all, 'detail', id] as const,
};

export function useBenchmarkPortfolios() {
  return useQuery({
    queryKey: benchmarkKeys.list(),
    queryFn: async () => {
      const response = await fetch('/api/benchmark/portfolios');
      if (!response.ok) throw new Error('Failed to fetch benchmarks');
      return response.json();
    },
  });
}

/**
 * Fetch a single benchmark portfolio with enriched holdings
 * Refetches every 60 seconds for live price updates
 */
export function useBenchmarkPortfolio(id: string | null) {
  return useQuery({
    queryKey: benchmarkKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Portfolio ID required');
      const response = await fetch(`/api/benchmark/portfolios/${id}`);
      if (!response.ok) throw new Error('Failed to fetch benchmark portfolio');
      return response.json();
    },
    enabled: !!id,
    refetchInterval: 60000,
  });
}

export function useInitializeBenchmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (benchmarkSlug: BenchmarkSlug) => {
      const response = await fetch('/api/benchmark/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmarkSlug }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initialize benchmark');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: benchmarkKeys.list() });
    },
  });
}
