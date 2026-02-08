/**
 * Benchmark Index Configuration
 * S&P 500 and NASDAQ 100 with top individual stock holdings
 */

export type BenchmarkSlug = 'sp500' | 'nasdaq100';

export interface BenchmarkHoldingItem {
  symbol: string;
  name: string;
  allocationPct: number;
}

export interface BenchmarkIndex {
  slug: BenchmarkSlug;
  displayName: string;
  fullName: string;
  description: string;
  color: string;
  totalStocks: number;
  holdings: BenchmarkHoldingItem[];
}

/**
 * S&P 500 - Top 20 holdings by weight
 * Based on current index composition (~55% coverage of total index)
 */
const sp500: BenchmarkIndex = {
  slug: 'sp500',
  displayName: 'S&P 500',
  fullName: 'S&P 500 Index',
  description: 'Tracks the 500 largest US companies by market cap. The most widely followed benchmark for US stock market performance.',
  color: 'bg-blue-600',
  totalStocks: 500,
  holdings: [
    { symbol: 'AAPL', name: 'Apple Inc.', allocationPct: 7.0 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', allocationPct: 6.5 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', allocationPct: 6.0 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', allocationPct: 4.0 },
    { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', allocationPct: 2.2 },
    { symbol: 'META', name: 'Meta Platforms Inc.', allocationPct: 2.5 },
    { symbol: 'GOOG', name: 'Alphabet Inc. Class C', allocationPct: 1.8 },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway Class B', allocationPct: 1.8 },
    { symbol: 'TSLA', name: 'Tesla Inc.', allocationPct: 1.8 },
    { symbol: 'AVGO', name: 'Broadcom Inc.', allocationPct: 1.7 },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', allocationPct: 1.4 },
    { symbol: 'LLY', name: 'Eli Lilly & Co.', allocationPct: 1.4 },
    { symbol: 'UNH', name: 'UnitedHealth Group', allocationPct: 1.2 },
    { symbol: 'V', name: 'Visa Inc.', allocationPct: 1.1 },
    { symbol: 'XOM', name: 'Exxon Mobil Corp.', allocationPct: 1.1 },
    { symbol: 'MA', name: 'Mastercard Inc.', allocationPct: 1.0 },
    { symbol: 'COST', name: 'Costco Wholesale', allocationPct: 0.9 },
    { symbol: 'HD', name: 'Home Depot Inc.', allocationPct: 0.9 },
    { symbol: 'PG', name: 'Procter & Gamble Co.', allocationPct: 0.9 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', allocationPct: 0.8 },
    // Remaining ~54% spread across 480 other stocks - modeled as rest in cash
  ],
};

/**
 * NASDAQ 100 - Top 20 holdings by weight
 * Based on current index composition (~65% coverage of total index)
 */
const nasdaq100: BenchmarkIndex = {
  slug: 'nasdaq100',
  displayName: 'NASDAQ 100',
  fullName: 'NASDAQ 100 Index',
  description: 'Tracks the 100 largest non-financial companies on the NASDAQ. Heavily weighted toward technology, with significant exposure to AI and cloud computing.',
  color: 'bg-green-600',
  totalStocks: 100,
  holdings: [
    { symbol: 'AAPL', name: 'Apple Inc.', allocationPct: 9.0 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', allocationPct: 8.0 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', allocationPct: 7.5 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', allocationPct: 5.5 },
    { symbol: 'META', name: 'Meta Platforms Inc.', allocationPct: 3.5 },
    { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', allocationPct: 3.0 },
    { symbol: 'AVGO', name: 'Broadcom Inc.', allocationPct: 3.0 },
    { symbol: 'GOOG', name: 'Alphabet Inc. Class C', allocationPct: 2.8 },
    { symbol: 'TSLA', name: 'Tesla Inc.', allocationPct: 2.8 },
    { symbol: 'COST', name: 'Costco Wholesale', allocationPct: 2.5 },
    { symbol: 'NFLX', name: 'Netflix Inc.', allocationPct: 2.0 },
    { symbol: 'AMD', name: 'Advanced Micro Devices', allocationPct: 1.8 },
    { symbol: 'ADBE', name: 'Adobe Inc.', allocationPct: 1.6 },
    { symbol: 'LIN', name: 'Linde plc', allocationPct: 1.5 },
    { symbol: 'PEP', name: 'PepsiCo Inc.', allocationPct: 1.4 },
    { symbol: 'CSCO', name: 'Cisco Systems Inc.', allocationPct: 1.3 },
    { symbol: 'QCOM', name: 'Qualcomm Inc.', allocationPct: 1.2 },
    { symbol: 'INTU', name: 'Intuit Inc.', allocationPct: 1.2 },
    { symbol: 'ISRG', name: 'Intuitive Surgical', allocationPct: 1.1 },
    { symbol: 'AMAT', name: 'Applied Materials Inc.', allocationPct: 1.0 },
    // Remaining ~38% spread across 80 other stocks - modeled as rest in cash
  ],
};

export const BENCHMARKS: Record<BenchmarkSlug, BenchmarkIndex> = {
  sp500,
  nasdaq100,
};

export const BENCHMARK_SLUGS: BenchmarkSlug[] = ['sp500', 'nasdaq100'];
export const INITIAL_BENCHMARK_BALANCE = 100000;
