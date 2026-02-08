/**
 * Benchmark Index Configuration
 * S&P 500 (SPY) and NASDAQ 100 (QQQ)
 * Each ETF holds ALL stocks in the index proportionally
 */

export type BenchmarkSlug = 'sp500' | 'nasdaq100';

export interface BenchmarkHoldingItem {
  symbol: string;
  name: string;
  allocationPct: number;
  type: 'etf';
}

export interface BenchmarkIndex {
  slug: BenchmarkSlug;
  displayName: string;
  fullName: string;
  etfSymbol: string;
  description: string;
  color: string;
  totalStocks: number;
  expenseRatio: string;
  holdings: BenchmarkHoldingItem[];
  topComponents: string[];
}

const sp500: BenchmarkIndex = {
  slug: 'sp500',
  displayName: 'S&P 500',
  fullName: 'S&P 500 Index',
  etfSymbol: 'SPY',
  description: 'The SPDR S&P 500 ETF (SPY) holds all 500 largest US companies by market cap. Each share gives you proportional ownership of every stock in the index.',
  color: 'bg-blue-600',
  totalStocks: 500,
  expenseRatio: '0.09%',
  holdings: [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', allocationPct: 100, type: 'etf' },
  ],
  topComponents: [
    'AAPL (7.0%)', 'MSFT (6.5%)', 'NVDA (6.0%)', 'AMZN (4.0%)', 'META (2.5%)',
    'GOOGL (2.2%)', 'BRK-B (1.8%)', 'TSLA (1.8%)', 'AVGO (1.7%)', 'JPM (1.4%)',
    'LLY (1.4%)', 'UNH (1.2%)', 'V (1.1%)', 'XOM (1.1%)', 'MA (1.0%)',
    'COST (0.9%)', 'HD (0.9%)', 'PG (0.9%)', 'JNJ (0.8%)', 'ABBV (0.8%)',
    '+ 480 more stocks',
  ],
};

const nasdaq100: BenchmarkIndex = {
  slug: 'nasdaq100',
  displayName: 'NASDAQ 100',
  fullName: 'NASDAQ 100 Index',
  etfSymbol: 'QQQ',
  description: 'The Invesco QQQ Trust (QQQ) holds all 100 largest non-financial NASDAQ companies. Heavy tech weighting with exposure to AI, cloud, and semiconductor leaders.',
  color: 'bg-green-600',
  totalStocks: 100,
  expenseRatio: '0.20%',
  holdings: [
    { symbol: 'QQQ', name: 'Invesco QQQ Trust (NASDAQ 100)', allocationPct: 100, type: 'etf' },
  ],
  topComponents: [
    'AAPL (9.0%)', 'MSFT (8.0%)', 'NVDA (7.5%)', 'AMZN (5.5%)', 'META (3.5%)',
    'GOOGL (3.0%)', 'AVGO (3.0%)', 'GOOG (2.8%)', 'TSLA (2.8%)', 'COST (2.5%)',
    'NFLX (2.0%)', 'AMD (1.8%)', 'ADBE (1.6%)', 'LIN (1.5%)', 'PEP (1.4%)',
    'CSCO (1.3%)', 'QCOM (1.2%)', 'INTU (1.2%)', 'ISRG (1.1%)', 'AMAT (1.0%)',
    '+ 80 more stocks',
  ],
};

export const BENCHMARKS: Record<BenchmarkSlug, BenchmarkIndex> = {
  sp500,
  nasdaq100,
};

export const BENCHMARK_SLUGS: BenchmarkSlug[] = ['sp500', 'nasdaq100'];
export const INITIAL_BENCHMARK_BALANCE = 100000;
