/**
 * Yahoo Finance API Client
 * For European and Colombian market data
 * Uses Yahoo Finance API endpoints with multiple fallbacks
 */

import axios from 'axios';

// Multiple endpoints for fallback
const QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance';

// Randomized User-Agents to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getHeaders() {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json,text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
  };
}

export interface YahooQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
}

export interface YahooSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency: string;
}

/**
 * Get real-time quote for a symbol using v7 quote endpoint (more reliable)
 * Supports international symbols like:
 * - Europe: SAP.DE (Germany), ASML.AS (Netherlands), MC.PA (France)
 * - Colombia: ECOPETROL.CL, PFBCOLOM.CL, GRUPOSUR.CL
 */
export async function getQuote(symbol: string): Promise<YahooQuote | null> {
  // Try v7 quote endpoint first (more reliable for server-side)
  try {
    const response = await axios.get(QUOTE_URL, {
      params: {
        symbols: symbol,
        fields: 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,currency,marketState,regularMarketPreviousClose',
      },
      headers: getHeaders(),
      timeout: 10000,
    });

    const quote = response.data?.quoteResponse?.result?.[0];
    if (quote && quote.regularMarketPrice) {
      return {
        symbol: symbol.toUpperCase(),
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        currency: quote.currency || 'USD',
        marketState: quote.marketState || 'CLOSED',
      };
    }
  } catch (error: any) {
    console.error('Yahoo Finance v7 quote error, trying chart fallback:', error?.message || error);
  }

  // Fallback to chart endpoint
  try {
    const response = await axios.get(`${CHART_URL}/${encodeURIComponent(symbol)}`, {
      params: {
        interval: '1d',
        range: '1d',
      },
      headers: getHeaders(),
      timeout: 10000,
    });

    const result = response.data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.previousClose || meta.chartPreviousClose;

    if (!currentPrice || currentPrice === 0) return null;

    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: symbol.toUpperCase(),
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      currency: meta.currency || 'USD',
      marketState: meta.marketState || 'CLOSED',
    };
  } catch (error: any) {
    console.error('Yahoo Finance chart error:', error?.message || error);
    return null;
  }
}

/**
 * Search for symbols across international markets
 */
export async function searchSymbol(query: string): Promise<YahooSearchResult[]> {
  try {
    const response = await axios.get(`${SEARCH_URL}/search`, {
      params: {
        q: query,
        quotesCount: 10,
        newsCount: 0,
        enableFuzzyQuery: true,
        quotesQueryId: 'tss_match_phrase_query',
      },
      headers: getHeaders(),
      timeout: 10000,
    });

    const quotes = response.data?.quotes || [];

    return quotes.map((item: any) => ({
      symbol: item.symbol,
      name: item.shortname || item.longname || item.symbol,
      type: item.quoteType || 'EQUITY',
      exchange: item.exchange || '',
      currency: item.currency || 'USD',
    }));
  } catch (error: any) {
    console.error('Yahoo Finance search error:', error?.message || error);
    return [];
  }
}

/**
 * Get historical price data
 */
export async function getHistoricalData(symbol: string, days: number = 30) {
  try {
    const response = await axios.get(`${CHART_URL}/${encodeURIComponent(symbol)}`, {
      params: {
        interval: '1d',
        range: days <= 30 ? '1mo' : days <= 90 ? '3mo' : '6mo',
      },
      headers: getHeaders(),
      timeout: 10000,
    });

    const result = response.data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    return timestamps.map((timestamp: number, index: number) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: quotes.open?.[index],
      high: quotes.high?.[index],
      low: quotes.low?.[index],
      close: quotes.close?.[index],
      volume: quotes.volume?.[index],
    })).filter((item: any) => item.close != null);
  } catch (error: any) {
    console.error('Yahoo Finance historical data error:', error?.message || error);
    return null;
  }
}

/**
 * Filter search results by market region
 */
export function filterByMarket(results: YahooSearchResult[], market: 'europe' | 'colombia'): YahooSearchResult[] {
  const europeExchanges = ['FRA', 'GER', 'PAR', 'AMS', 'LSE', 'MIL', 'MAD', 'STO', 'HEL', 'BRU', 'VIE', 'SWX'];
  const colombiaExchanges = ['BVC', 'BOG'];

  // Symbol suffixes for regions
  const europeSuffixes = ['.DE', '.PA', '.AS', '.L', '.MI', '.MC', '.ST', '.HE', '.BR', '.VI', '.SW', '.F'];
  const colombiaSuffixes = ['.CL', '.BVC'];

  return results.filter((result) => {
    const symbol = result.symbol.toUpperCase();
    const exchange = result.exchange.toUpperCase();

    if (market === 'europe') {
      return europeExchanges.some((ex) => exchange.includes(ex)) ||
             europeSuffixes.some((suffix) => symbol.endsWith(suffix));
    } else if (market === 'colombia') {
      return colombiaExchanges.some((ex) => exchange.includes(ex)) ||
             colombiaSuffixes.some((suffix) => symbol.endsWith(suffix));
    }
    return false;
  });
}
