/**
 * Benchmark Index Configuration
 * S&P 500 (SPY) and NASDAQ 100 (QQQ) tracking
 */

export type BenchmarkSlug = 'sp500' | 'nasdaq100';

export interface BenchmarkIndex {
  slug: BenchmarkSlug;
  displayName: string;
  fullName: string;
  symbol: string;
  description: string;
  color: string;
}

export const BENCHMARKS: Record<BenchmarkSlug, BenchmarkIndex> = {
  sp500: {
    slug: 'sp500',
    displayName: 'S&P 500',
    fullName: 'S&P 500 Index',
    symbol: 'SPY',
    description: 'Tracks the 500 largest US companies. The most widely followed benchmark for overall US stock market performance.',
    color: 'bg-blue-600',
  },
  nasdaq100: {
    slug: 'nasdaq100',
    displayName: 'NASDAQ 100',
    fullName: 'NASDAQ 100 Index',
    symbol: 'QQQ',
    description: 'Tracks the 100 largest non-financial companies on the NASDAQ. Heavy weighting toward technology stocks.',
    color: 'bg-green-600',
  },
};

export const BENCHMARK_SLUGS: BenchmarkSlug[] = ['sp500', 'nasdaq100'];
export const INITIAL_BENCHMARK_BALANCE = 100000;
