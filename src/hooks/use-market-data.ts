/**
 * Market Data Hooks
 * React Query hooks for fetching market data
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { AssetType, MarketQuote, AssetSearchResult } from '@/types';

/**
 * Search for assets
 */
export function useAssetSearch(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['asset-search', query],
    queryFn: async () => {
      if (!query || query.length < 1) return { stocks: [], cryptos: [], all: [] };

      const response = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: enabled && query.length >= 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get market quote for an asset
 */
export function useMarketQuote(symbol: string, assetType: AssetType, enabled: boolean = true) {
  return useQuery<MarketQuote>({
    queryKey: ['market-quote', symbol, assetType],
    queryFn: async () => {
      const response = await fetch(
        `/api/market/quote?symbol=${encodeURIComponent(symbol)}&type=${assetType}`
      );
      if (!response.ok) throw new Error('Failed to fetch quote');
      return response.json();
    },
    enabled: enabled && !!symbol && !!assetType,
    staleTime: 5 * 60 * 1000, // 5 minutes - match refetch interval
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    retry: 2, // Retry failed requests only twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}

/**
 * Get multiple quotes at once
 */
export function useMarketQuotes(
  assets: Array<{ symbol: string; assetType: AssetType }>,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['market-quotes', assets],
    queryFn: async () => {
      const promises = assets.map((asset) =>
        fetch(`/api/market/quote?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.assetType}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null) // Don't fail entire batch if one fails
      );

      const results = await Promise.all(promises);
      return results.filter((result) => result !== null);
    },
    enabled: enabled && assets.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - match refetch interval
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    retry: 1, // Only retry once for batch requests
    retryDelay: 2000, // 2 second delay before retry
  });
}

/**
 * Get historical price data
 */
export function useHistoricalPrices(
  symbol: string,
  assetType: AssetType,
  days: number = 30,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['historical-prices', symbol, assetType, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/market/historical?symbol=${encodeURIComponent(symbol)}&type=${assetType}&days=${days}`
      );
      if (!response.ok) throw new Error('Failed to fetch historical data');
      return response.json();
    },
    enabled: enabled && !!symbol && !!assetType,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
