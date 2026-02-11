/**
 * Trading Coach React Query Hooks
 * Hooks for fetching and mutating coach data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CoachConfig,
  CoachSignal,
  CoachPaperTrade,
  CoachDailyReport,
  RunAnalysisResult,
} from '@/lib/coach/types';

// ============================================================================
// Query Keys
// ============================================================================

export const coachKeys = {
  all: ['coach'] as const,
  config: () => [...coachKeys.all, 'config'] as const,
  signals: () => [...coachKeys.all, 'signals'] as const,
  signalsList: (filters: Record<string, any>) =>
    [...coachKeys.signals(), 'list', filters] as const,
  signalDetail: (id: string) => [...coachKeys.signals(), 'detail', id] as const,
  trades: () => [...coachKeys.all, 'trades'] as const,
  tradesList: (filters: Record<string, any>) =>
    [...coachKeys.trades(), 'list', filters] as const,
  reports: () => [...coachKeys.all, 'reports'] as const,
  reportsList: (filters: Record<string, any>) =>
    [...coachKeys.reports(), 'list', filters] as const,
};

// ============================================================================
// Config Hooks
// ============================================================================

export function useCoachConfig() {
  return useQuery({
    queryKey: coachKeys.config(),
    queryFn: async (): Promise<CoachConfig & { isDefault?: boolean }> => {
      const response = await fetch('/api/coach/config');
      if (!response.ok) {
        throw new Error('Failed to fetch coach config');
      }
      return response.json();
    },
  });
}

export function useUpdateCoachConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CoachConfig>) => {
      const response = await fetch('/api/coach/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update config');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachKeys.config() });
    },
  });
}

export function useToggleKillSwitch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (killSwitch: boolean) => {
      const response = await fetch('/api/coach/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killSwitch }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle kill switch');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachKeys.config() });
    },
  });
}

// ============================================================================
// Analysis Hooks
// ============================================================================

export function useRunAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: {
      symbols?: string[];
      forceRun?: boolean;
    }): Promise<RunAnalysisResult> => {
      const response = await fetch('/api/coach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to run analysis');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachKeys.signals() });
      queryClient.invalidateQueries({ queryKey: coachKeys.trades() });
    },
  });
}

// ============================================================================
// Signals Hooks
// ============================================================================

interface SignalsFilters {
  symbol?: string;
  action?: string;
  acknowledged?: boolean;
  limit?: number;
  offset?: number;
}

interface SignalsResponse {
  signals: CoachSignal[];
  total: number;
  limit: number;
  offset: number;
}

export function useCoachSignals(filters: SignalsFilters = {}) {
  return useQuery({
    queryKey: coachKeys.signalsList(filters),
    queryFn: async (): Promise<SignalsResponse> => {
      const params = new URLSearchParams();
      if (filters.symbol) params.set('symbol', filters.symbol);
      if (filters.action) params.set('action', filters.action);
      if (filters.acknowledged !== undefined)
        params.set('acknowledged', String(filters.acknowledged));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));

      const response = await fetch(`/api/coach/signals?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch signals');
      }
      return response.json();
    },
  });
}

export function useCoachSignal(id: string) {
  return useQuery({
    queryKey: coachKeys.signalDetail(id),
    queryFn: async (): Promise<CoachSignal> => {
      const response = await fetch(`/api/coach/signals/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch signal');
      }
      return response.json();
    },
    enabled: !!id,
  });
}

export function useAcknowledgeSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      acknowledged,
    }: {
      id: string;
      acknowledged: boolean;
    }) => {
      const response = await fetch(`/api/coach/signals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to acknowledge signal');
      }
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: coachKeys.signals() });
      queryClient.invalidateQueries({ queryKey: coachKeys.signalDetail(id) });
    },
  });
}

// ============================================================================
// Paper Trades Hooks
// ============================================================================

interface TradesFilters {
  status?: string;
  symbol?: string;
  limit?: number;
  offset?: number;
}

interface TradesResponse {
  trades: CoachPaperTrade[];
  total: number;
  limit: number;
  offset: number;
}

export function useCoachTrades(filters: TradesFilters = {}) {
  return useQuery({
    queryKey: coachKeys.tradesList(filters),
    queryFn: async (): Promise<TradesResponse> => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.symbol) params.set('symbol', filters.symbol);
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));

      const response = await fetch(`/api/coach/trades?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trades');
      }
      return response.json();
    },
  });
}

export function useCreatePaperTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trade: {
      signalId?: string;
      symbol: string;
      assetType: 'stock' | 'etf' | 'crypto';
      market?: 'us' | 'europe' | 'colombia';
      side: 'BUY' | 'SELL';
      entryPrice: number;
      sizeUsd: number;
      stopLoss?: number;
      takeProfitJson?: any[];
      notes?: string;
    }) => {
      const response = await fetch('/api/coach/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trade),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create trade');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachKeys.trades() });
      queryClient.invalidateQueries({ queryKey: coachKeys.signals() });
    },
  });
}

export function useClosePaperTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tradeId,
      exitPrice,
      notes,
    }: {
      tradeId: string;
      exitPrice: number;
      notes?: string;
    }) => {
      const response = await fetch(`/api/coach/trades/${tradeId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exitPrice, notes }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close trade');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachKeys.trades() });
    },
  });
}

// ============================================================================
// Reports Hooks
// ============================================================================

interface ReportsResponse {
  reports: CoachDailyReport[];
  total: number;
  limit: number;
  offset: number;
}

export function useCoachReports(filters: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: coachKeys.reportsList(filters),
    queryFn: async (): Promise<ReportsResponse> => {
      const params = new URLSearchParams();
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));

      const response = await fetch(`/api/coach/reports?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      return response.json();
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date?: string) => {
      const response = await fetch('/api/coach/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachKeys.reports() });
    },
  });
}

// ============================================================================
// Balance Hooks
// ============================================================================

interface CoachBalance {
  initialBalance: number;
  totalValue: number;
  availableCash: number;
  capitalInUse: number;
  totalReturnPct: number;
  todayPnL: number;
  todayPnLPercent: number;
  openPositions: number;
}

export function useCoachBalance() {
  return useQuery({
    queryKey: [...coachKeys.all, 'balance'] as const,
    queryFn: async (): Promise<CoachBalance> => {
      const response = await fetch('/api/coach/balance');
      if (!response.ok) {
        throw new Error('Failed to fetch coach balance');
      }
      return response.json();
    },
  });
}

// ============================================================================
// Summary Hooks
// ============================================================================

export function useCoachSummary() {
  const { data: config, isLoading: configLoading } = useCoachConfig();
  const { data: signalsData, isLoading: signalsLoading } = useCoachSignals({
    acknowledged: false,
    limit: 100,
  });
  const { data: tradesData, isLoading: tradesLoading } = useCoachTrades({
    status: 'open',
    limit: 100,
  });

  const isLoading = configLoading || signalsLoading || tradesLoading;

  const unacknowledgedSignals = signalsData?.signals?.filter(
    (s) => !s.acknowledged
  ).length || 0;

  const openTrades = tradesData?.trades?.length || 0;

  const unrealizedPnL = tradesData?.trades?.reduce(
    (sum, t) => sum + (t.pnlUsd || 0),
    0
  ) || 0;

  const actionableSignals = signalsData?.signals?.filter(
    (s) => !s.acknowledged && s.consensusAction !== 'HOLD'
  ).length || 0;

  return {
    isLoading,
    config,
    unacknowledgedSignals,
    actionableSignals,
    openTrades,
    unrealizedPnL,
    killSwitchActive: config?.killSwitch || false,
  };
}
