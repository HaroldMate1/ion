/**
 * Finnhub API Client
 * For stocks and ETFs market data
 * Free tier: 60 API calls/minute
 */

import axios from 'axios';

const API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

export interface FinnhubQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface FinnhubSearchResult {
  symbol: string;
  name: string;
  type: string;
  currency: string;
}

/**
 * Search for stocks/ETFs by symbol
 * Only returns US symbols (no international suffixes like .DE, .BC, .L)
 */
export async function searchSymbol(keywords: string): Promise<FinnhubSearchResult[]> {
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        q: keywords,
        token: API_KEY,
      },
    });

    const results = response.data.result || [];

    // Filter to only US symbols (no dot suffix like .DE, .BC, .L, etc.)
    const usResults = results.filter((item: any) => !item.symbol.includes('.'));

    return usResults.map((item: any) => ({
      symbol: item.symbol,
      name: item.description || item.symbol,
      type: item.type || 'Common Stock',
      currency: 'USD',
    }));
  } catch (error) {
    console.error('Finnhub search error:', error);
    return [];
  }
}

/**
 * Get real-time quote for a stock/ETF
 */
export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
  try {
    const response = await axios.get(`${BASE_URL}/quote`, {
      params: {
        symbol: symbol.toUpperCase(),
        token: API_KEY,
      },
    });

    const quote = response.data;

    // Check if we got valid data (current price exists)
    if (!quote || !quote.c || quote.c === 0) {
      return null;
    }

    const currentPrice = quote.c; // current price
    const previousClose = quote.pc; // previous close
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: symbol.toUpperCase(),
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      high: quote.h, // day high
      low: quote.l, // day low
      open: quote.o, // day open
      previousClose: previousClose,
    };
  } catch (error) {
    console.error('Finnhub quote error:', error);
    return null;
  }
}

/**
 * Get historical daily prices (candles)
 */
export async function getHistoricalData(symbol: string, days: number = 30) {
  try {
    const toTimestamp = Math.floor(Date.now() / 1000);
    const fromTimestamp = toTimestamp - days * 24 * 60 * 60;

    const response = await axios.get(`${BASE_URL}/stock/candle`, {
      params: {
        symbol: symbol.toUpperCase(),
        resolution: 'D', // Daily
        from: fromTimestamp,
        to: toTimestamp,
        token: API_KEY,
      },
    });

    const data = response.data;

    if (!data || data.s !== 'ok' || !data.c) {
      return null;
    }

    // Convert arrays to objects
    return data.t.map((timestamp: number, index: number) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: data.o[index],
      high: data.h[index],
      low: data.l[index],
      close: data.c[index],
      volume: data.v[index],
    }));
  } catch (error) {
    console.error('Finnhub historical data error:', error);
    return null;
  }
}
