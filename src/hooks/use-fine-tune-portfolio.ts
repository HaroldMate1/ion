/**
 * Fine-Tune Portfolio Hooks
 * Independent portfolio that trades with fine-tuned agent weights.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useFineTuneConfig() {
  return useQuery({
    queryKey: ['fine-tune-config'],
    queryFn: async () => {
      const res = await fetch('/api/fine-tune/config');
      if (!res.ok) throw new Error('Failed to fetch fine-tune config');
      return res.json();
    },
  });
}

export function useFineTuneBalance() {
  return useQuery({
    queryKey: ['fine-tune-balance'],
    queryFn: async () => {
      const res = await fetch('/api/fine-tune/balance');
      if (!res.ok) throw new Error('Failed to fetch fine-tune balance');
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

export function useFineTuneTrades() {
  return useQuery({
    queryKey: ['fine-tune-trades'],
    queryFn: async () => {
      const res = await fetch('/api/fine-tune/trades');
      if (!res.ok) throw new Error('Failed to fetch fine-tune trades');
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

export function useApplyFineTuneWeights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weights: { indicator: number; priceAction: number; news: number }) => {
      const res = await fetch('/api/fine-tune/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to apply weights');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fine-tune-config'] });
      qc.invalidateQueries({ queryKey: ['fine-tune-balance'] });
    },
  });
}

export function useResetFineTune() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fine-tune/config', { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset fine-tune portfolio');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fine-tune-config'] });
      qc.invalidateQueries({ queryKey: ['fine-tune-balance'] });
      qc.invalidateQueries({ queryKey: ['fine-tune-trades'] });
    },
  });
}

export function useRunFineTuneAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fine-tune/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to run analysis');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fine-tune-balance'] });
      qc.invalidateQueries({ queryKey: ['fine-tune-trades'] });
    },
  });
}

export function useFineTuneReports({ limit = 30 }: { limit?: number } = {}) {
  return useQuery({
    queryKey: ['fine-tune-reports', limit],
    queryFn: async () => {
      const res = await fetch(`/api/fine-tune/reports?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch fine-tune reports');
      return res.json();
    },
  });
}

export function useGenerateFineTuneReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/fine-tune/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate report');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fine-tune-reports'] });
    },
  });
}

