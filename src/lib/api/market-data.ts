/**
 * Unified Market Data API
 * Combines Alpha Vantage (stocks/ETFs) and CoinGecko (crypto) with caching
 */

import type { AssetType, MarketQuote } from '@/types';
import * as alphaVantage from './alpha-vantage';
import * as coinGecko from './coingecko';

/**
 * Get market quote for any asset type
 */
export async function getMarketQuote(
  symbol: string,
  assetType: AssetType
): Promise<MarketQuote | null> {
  try {
    if (assetType === 'crypto') {
      const quote = await coinGecko.getQuoteBySymbol(symbol);
      if (!quote) return null;

      return {
        symbol: quote.symbol,
        asset_type: 'crypto',
        price: quote.price,
        change_24h: quote.change24h,
        volume_24h: quote.volume24h,
        market_cap: quote.marketCap,
      };
    } else {
      // Stock or ETF
      const quote = await alphaVantage.getQuote(symbol);
      if (!quote) return null;

      return {
        symbol: quote.symbol,
        asset_type: assetType,
        price: quote.price,
        change_24h: quote.changePercent,
        volume_24h: quote.volume,
      };
    }
  } catch (error) {
    console.error('Market quote error:', error);
    return null;
  }
}

/**
 * Search for assets across all types
 */
export async function searchAssets(query: string) {
  try {
    const [stockResults, cryptoResults] = await Promise.all([
      alphaVantage.searchSymbol(query),
      coinGecko.searchCrypto(query),
    ]);

    const stocks = stockResults.map((result) => ({
      symbol: result.symbol,
      name: result.name,
      asset_type: (result.type.includes('ETF') ? 'etf' : 'stock') as AssetType,
      exchange: result.region,
    }));

    const cryptos = cryptoResults.map((result) => ({
      symbol: result.symbol,
      name: result.name,
      asset_type: 'crypto' as AssetType,
    }));

    return {
      stocks,
      cryptos,
      all: [...stocks, ...cryptos],
    };
  } catch (error) {
    console.error('Asset search error:', error);
    return { stocks: [], cryptos: [], all: [] };
  }
}

/**
 * Get historical price data
 */
export async function getHistoricalPrices(
  symbol: string,
  assetType: AssetType,
  days: number = 30
) {
  try {
    if (assetType === 'crypto') {
      // For crypto, we need to get the coin ID first
      const searchResults = await coinGecko.searchCrypto(symbol);
      const coin = searchResults.find(
        (c) => c.symbol.toLowerCase() === symbol.toLowerCase()
      );

      if (!coin) return null;

      return await coinGecko.getHistoricalData(coin.id, days);
    } else {
      // For stocks/ETFs
      const data = await alphaVantage.getHistoricalData(symbol);
      if (!data) return null;

      // Convert to simplified format and limit to requested days
      return data.slice(0, days).map((item) => ({
        date: item.date,
        price: item.close,
      }));
    }
  } catch (error) {
    console.error('Historical prices error:', error);
    return null;
  }
}
