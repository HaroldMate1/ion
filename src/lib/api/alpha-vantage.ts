/**
 * Alpha Vantage API Client
 * For stocks and ETFs market data
 */

import axios from 'axios';

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

export interface AlphaVantageQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface AlphaVantageSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}

/**
 * Search for stocks/ETFs by symbol or name
 */
export async function searchSymbol(keywords: string): Promise<AlphaVantageSearchResult[]> {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'SYMBOL_SEARCH',
        keywords,
        apikey: API_KEY,
      },
    });

    const matches = response.data.bestMatches || [];
    return matches.map((match: any) => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: match['3. type'],
      region: match['4. region'],
      currency: match['8. currency'],
    }));
  } catch (error) {
    console.error('Alpha Vantage search error:', error);
    return [];
  }
}

/**
 * Get real-time quote for a stock/ETF
 */
export async function getQuote(symbol: string): Promise<AlphaVantageQuote | null> {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: API_KEY,
      },
    });

    const quote = response.data['Global Quote'];

    if (!quote || Object.keys(quote).length === 0) {
      return null;
    }

    return {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
      volume: parseInt(quote['06. volume']),
    };
  } catch (error) {
    console.error('Alpha Vantage quote error:', error);
    return null;
  }
}

/**
 * Get historical daily prices
 */
export async function getHistoricalData(symbol: string, outputsize: 'compact' | 'full' = 'compact') {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol,
        outputsize,
        apikey: API_KEY,
      },
    });

    const timeSeries = response.data['Time Series (Daily)'];
    if (!timeSeries) return null;

    return Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
      date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    }));
  } catch (error) {
    console.error('Alpha Vantage historical data error:', error);
    return null;
  }
}
