/**
 * Unified Market Data API
 * Routes requests to appropriate provider based on market:
 * - US: Finnhub (stocks/ETFs) + CoinGecko (crypto)
 * - Europe: Yahoo Finance
 * - Colombia: Yahoo Finance
 */

import type { AssetType, Market, MarketQuote } from '@/types';
import * as finnhub from './finnhub';
import * as coinGecko from './coingecko';
import * as yahooFinance from './yahoo-finance';

/**
 * Get market quote for any asset type and market
 */
export async function getMarketQuote(
  symbol: string,
  assetType: AssetType,
  market: Market = 'us'
): Promise<MarketQuote | null> {
  try {
    // Crypto is always handled by CoinGecko regardless of market
    if (assetType === 'crypto') {
      const quote = await coinGecko.getQuoteBySymbol(symbol);
      if (!quote) return null;

      return {
        symbol: quote.symbol,
        asset_type: 'crypto',
        market: market,
        price: quote.price,
        change_24h: quote.change24h,
        volume_24h: quote.volume24h,
        market_cap: quote.marketCap,
      };
    }

    // For stocks/ETFs, route based on market
    if (market === 'us') {
      // US market - use Finnhub
      const quote = await finnhub.getQuote(symbol);
      if (!quote) return null;

      return {
        symbol: quote.symbol,
        asset_type: assetType,
        market: 'us',
        price: quote.price,
        change_24h: quote.changePercent,
        volume_24h: undefined,
      };
    } else {
      // Europe or Colombia - use Yahoo Finance
      const quote = await yahooFinance.getQuote(symbol);
      if (!quote) return null;

      return {
        symbol: quote.symbol,
        asset_type: assetType,
        market: market,
        price: quote.price,
        change_24h: quote.changePercent,
        volume_24h: undefined,
      };
    }
  } catch (error) {
    console.error('Market quote error:', error);
    return null;
  }
}

/**
 * Search for assets across all types within a specific market
 */
export async function searchAssets(query: string, market: Market = 'us') {
  try {
    // Crypto search is the same for all markets
    const cryptoResults = await coinGecko.searchCrypto(query);
    const cryptos = cryptoResults.map((result) => ({
      symbol: result.symbol,
      name: result.name,
      asset_type: 'crypto' as AssetType,
      market: market,
    }));

    let stocks: Array<{ symbol: string; name: string; asset_type: AssetType; market: Market }> = [];

    if (market === 'us') {
      // US market - use Finnhub
      const stockResults = await finnhub.searchSymbol(query);
      stocks = stockResults.map((result) => ({
        symbol: result.symbol,
        name: result.name,
        asset_type: (result.type.toLowerCase().includes('etf') ? 'etf' : 'stock') as AssetType,
        market: 'us' as Market,
      }));
    } else {
      // Europe or Colombia - use Yahoo Finance with filtering
      const allResults = await yahooFinance.searchSymbol(query);
      const filteredResults = yahooFinance.filterByMarket(allResults, market);

      stocks = filteredResults.map((result) => ({
        symbol: result.symbol,
        name: result.name,
        asset_type: (result.type.toLowerCase().includes('etf') ? 'etf' : 'stock') as AssetType,
        market: market,
      }));
    }

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
  days: number = 30,
  market: Market = 'us'
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
    } else if (market === 'us') {
      // For US stocks/ETFs - using Finnhub
      const data = await finnhub.getHistoricalData(symbol, days);
      if (!data) return null;

      return data.map((item) => ({
        date: item.date,
        price: item.close,
      }));
    } else {
      // For Europe/Colombia - using Yahoo Finance
      const data = await yahooFinance.getHistoricalData(symbol, days);
      if (!data) return null;

      return data.map((item) => ({
        date: item.date,
        price: item.close,
      }));
    }
  } catch (error) {
    console.error('Historical prices error:', error);
    return null;
  }
}
