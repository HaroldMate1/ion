/**
 * CoinGecko API Client
 * For cryptocurrency market data (no API key required for free tier)
 */

import axios from 'axios';

const BASE_URL = 'https://api.coingecko.com/api/v3';

export interface CoinGeckoQuote {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface CoinGeckoSearchResult {
  id: string;
  symbol: string;
  name: string;
}

/**
 * Search for cryptocurrencies
 */
export async function searchCrypto(query: string): Promise<CoinGeckoSearchResult[]> {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: { query },
    });

    const coins = response.data.coins || [];
    return coins.slice(0, 10).map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
    }));
  } catch (error) {
    console.error('CoinGecko search error:', error);
    return [];
  }
}

/**
 * Get real-time quote for a cryptocurrency
 */
export async function getQuote(coinId: string): Promise<CoinGeckoQuote | null> {
  try {
    const response = await axios.get(`${BASE_URL}/coins/${coinId}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false,
      },
    });

    const data = response.data;
    const marketData = data.market_data;

    if (!marketData) return null;

    return {
      id: data.id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      price: marketData.current_price.usd,
      change24h: marketData.price_change_percentage_24h || 0,
      volume24h: marketData.total_volume.usd,
      marketCap: marketData.market_cap.usd,
    };
  } catch (error) {
    console.error('CoinGecko quote error:', error);
    return null;
  }
}

/**
 * Get quote by symbol (converts symbol to coin ID first)
 */
export async function getQuoteBySymbol(symbol: string): Promise<CoinGeckoQuote | null> {
  try {
    // First search for the coin to get its ID
    const searchResults = await searchCrypto(symbol);
    const coin = searchResults.find(
      (c) => c.symbol.toLowerCase() === symbol.toLowerCase()
    );

    if (!coin) return null;

    // Then get the quote
    return await getQuote(coin.id);
  } catch (error) {
    console.error('CoinGecko quote by symbol error:', error);
    return null;
  }
}

/**
 * Get historical market data
 */
export async function getHistoricalData(coinId: string, days: number = 30) {
  try {
    const response = await axios.get(`${BASE_URL}/coins/${coinId}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days,
        interval: days > 90 ? 'daily' : 'hourly',
      },
    });

    const prices = response.data.prices || [];
    return prices.map(([timestamp, price]: [number, number]) => ({
      date: new Date(timestamp).toISOString(),
      price,
    }));
  } catch (error) {
    console.error('CoinGecko historical data error:', error);
    return null;
  }
}

/**
 * Get list of top cryptocurrencies
 */
export async function getTopCryptos(limit: number = 50): Promise<CoinGeckoQuote[]> {
  try {
    const response = await axios.get(`${BASE_URL}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
        sparkline: false,
      },
    });

    return response.data.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h || 0,
      volume24h: coin.total_volume,
      marketCap: coin.market_cap,
    }));
  } catch (error) {
    console.error('CoinGecko top cryptos error:', error);
    return [];
  }
}
