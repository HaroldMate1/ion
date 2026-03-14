/**
 * Yahoo Finance API Client
 * For European and Latin American market data
 * Uses yahoo-finance2 package for reliable server-side requests
 */

import YahooFinance from 'yahoo-finance2';

// Create yahoo-finance2 instance
const yahooFinance = new YahooFinance();

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
 * Get real-time quote for a symbol
 * Supports international symbols like:
 * - Europe: SAP.DE (Germany), ASML.AS (Netherlands), MC.PA (France)
 * - Latin America: ECOPETROL.CL (Colombia), PETR4.SA (Brazil), AMXL.MX (Mexico),
 *   GGAL.BA (Argentina), FALABELLA.SN (Chile), BVN (Peru via US ADR)
 */
export async function getQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const quote = await yahooFinance.quote(symbol, {
      fields: ['regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent', 'currency', 'marketState'],
    });

    if (!quote || !quote.regularMarketPrice) {
      return null;
    }

    return {
      symbol: symbol.toUpperCase(),
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      currency: quote.currency || 'USD',
      marketState: quote.marketState || 'CLOSED',
    };
  } catch (error: any) {
    console.error('Yahoo Finance quote error:', error?.message || error);
    return null;
  }
}

/**
 * Search for symbols across international markets
 */
export async function searchSymbol(query: string): Promise<YahooSearchResult[]> {
  try {
    const results = await yahooFinance.search(query, {
      quotesCount: 10,
      newsCount: 0,
    });

    if (!results.quotes) return [];

    return results.quotes.map((item: any) => ({
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
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    if (!result.quotes || result.quotes.length === 0) return null;

    return result.quotes
      .filter((q: any) => q.close != null)
      .map((q: any) => ({
        date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : new Date(q.date).toISOString().split('T')[0],
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
      }));
  } catch (error: any) {
    console.error('Yahoo Finance historical data error:', error?.message || error);
    return null;
  }
}

/**
 * Filter search results by market region
 */
export function filterByMarket(results: YahooSearchResult[], market: 'europe' | 'latam'): YahooSearchResult[] {
  const europeExchanges = ['FRA', 'GER', 'PAR', 'AMS', 'LSE', 'MIL', 'MAD', 'STO', 'HEL', 'BRU', 'VIE', 'SWX'];
  // Latin America: Colombia (BVC), Brazil (B3/SAO), Mexico (BMV/MEX), Argentina (BCBA/BUE), Chile (BCS/SGO), Peru (BVL/LIM)
  const latamExchanges = ['BVC', 'BOG', 'SAO', 'BSP', 'MEX', 'BMV', 'BUE', 'BCBA', 'SGO', 'BCS', 'LIM', 'BVL'];

  // Symbol suffixes for regions
  const europeSuffixes = ['.DE', '.PA', '.AS', '.L', '.MI', '.MC', '.ST', '.HE', '.BR', '.VI', '.SW', '.F'];
  // Latin America suffixes: .CL (Colombia), .SA (Brazil), .MX (Mexico), .BA (Argentina), .SN (Chile)
  const latamSuffixes = ['.CL', '.BVC', '.SA', '.MX', '.BA', '.SN'];

  return results.filter((result) => {
    const symbol = result.symbol.toUpperCase();
    const exchange = result.exchange.toUpperCase();

    if (market === 'europe') {
      return europeExchanges.some((ex) => exchange.includes(ex)) ||
             europeSuffixes.some((suffix) => symbol.endsWith(suffix));
    } else if (market === 'latam') {
      return latamExchanges.some((ex) => exchange.includes(ex)) ||
             latamSuffixes.some((suffix) => symbol.endsWith(suffix));
    }
    return false;
  });
}

