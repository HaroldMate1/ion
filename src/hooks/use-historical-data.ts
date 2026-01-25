/**
 * Historical Data Hook
 * Fetch historical price data for charts
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { AssetType } from '@/types';

export interface HistoricalDataPoint {
  date: string;
  price: number;
}

export interface HistoricalDataResponse {
  symbol: string;
  asset_type: AssetType;
  data: HistoricalDataPoint[];
}

export function useHistoricalData(
  symbol: string,
  assetType: AssetType,
  days: number = 30,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['historical', symbol, assetType, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/market/historical?symbol=${encodeURIComponent(symbol)}&type=${assetType}&days=${days}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch historical data');
      }

      const data: HistoricalDataResponse = await response.json();
      return data.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
