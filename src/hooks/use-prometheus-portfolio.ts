'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PrometheusBalance {
  initialBalance: number;
  totalValue: number;
  availableCash: number;
  capitalInUse: number;
  totalReturnPct: number;
  todayPnL: number;
  openPositions: number;
  totalTrades: number;
}

export interface PrometheusTrade {
  id: string;
  user_id: string;
  symbol: string;
  drug_name: string | null;
  signal_rationale: string | null;
  side: 'BUY' | 'SELL';
  entry_price: number;
  size_usd: number;
  quantity: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: 'open' | 'closed' | 'stopped' | 'tp_hit';
  opened_at: string;
  closed_at: string | null;
  exit_price: number | null;
  pnl_usd: number | null;
  pnl_pct: number | null;
  notes: string | null;
}

export interface PrometheusConfig {
  id: string;
  user_id: string;
  kill_switch: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchBalance(): Promise<PrometheusBalance> {
  const res = await fetch('/api/prometheus/balance');
  if (!res.ok) throw new Error('Failed to fetch Prometheus balance');
  return res.json();
}

async function fetchTrades(status?: string): Promise<{ trades: PrometheusTrade[] }> {
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`/api/prometheus/trades${qs}`);
  if (!res.ok) throw new Error('Failed to fetch Prometheus trades');
  return res.json();
}

async function fetchConfig(): Promise<{ config: PrometheusConfig | null }> {
  const res = await fetch('/api/prometheus/config');
  if (!res.ok) throw new Error('Failed to fetch Prometheus config');
  return res.json();
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePrometheusBalance() {
  return useQuery({
    queryKey: ['prometheus-balance'],
    queryFn:  fetchBalance,
    refetchInterval: 60_000,
  });
}

export function usePrometheusTrades(status?: string) {
  return useQuery({
    queryKey: ['prometheus-trades', status],
    queryFn:  () => fetchTrades(status),
    refetchInterval: 60_000,
  });
}

export function usePrometheusConfig() {
  return useQuery({
    queryKey: ['prometheus-config'],
    queryFn:  fetchConfig,
  });
}

export function useUpdatePrometheusConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Pick<PrometheusConfig, 'kill_switch' | 'is_active'>>) => {
      const res = await fetch('/api/prometheus/config', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update config');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prometheus-config'] });
      qc.invalidateQueries({ queryKey: ['prometheus-balance'] });
    },
  });
}

export function useResetPrometheusPortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/prometheus/config', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to reset portfolio');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prometheus-balance'] });
      qc.invalidateQueries({ queryKey: ['prometheus-trades'] });
      qc.invalidateQueries({ queryKey: ['prometheus-config'] });
    },
  });
}
