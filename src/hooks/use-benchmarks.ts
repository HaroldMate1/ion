/**
 * Benchmark Portfolios React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BenchmarkSlug } from '@/config/benchmark-indexes';

export const benchmarkKeys = {
  all: ['benchmarks'] as const,
  list: () => [...benchmarkKeys.all, 'list'] as const,
};

export function useBenchmarkPortfolios() {
  return useQuery({
    queryKey: benchmarkKeys.list(),
    queryFn: async () => {
      const response = await fetch('/api/benchmark/portfolios');
      if (!response.ok) throw new Error('Failed to fetch benchmarks');
      return response.json();
    },
    refetchInterval: 60000, // Live price updates every 60s
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
