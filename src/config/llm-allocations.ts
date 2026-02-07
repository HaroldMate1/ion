/**
 * LLM Portfolio Allocations
 * Predefined investment strategies from 5 different LLM models
 */

export type LLMProvider = 'gemini' | 'claude' | 'perplexity' | 'chatgpt' | 'grok';

export type AssetCategory = 'stock' | 'etf' | 'crypto' | 'bond' | 'reit' | 'commodity';

export interface AllocationItem {
  symbol: string;
  name: string;
  category: AssetCategory;
  allocationPct: number;
  market: 'us' | 'europe' | 'crypto';
}

export interface LLMAllocation {
  provider: LLMProvider;
  displayName: string;
  description: string;
  strategy: string;
  allocations: AllocationItem[];
}

/**
 * Gemini's Portfolio Strategy
 * Conservative with heavy ETF focus (70%), moderate stocks (25%), minimal crypto (5%)
 */
const geminiAllocation: LLMAllocation = {
  provider: 'gemini',
  displayName: 'Gemini',
  description: 'Balanced portfolio with ETF-heavy allocation',
  strategy: '70% ETFs, 25% Blue-Chip Stocks, 5% Crypto',
  allocations: [
    // ETFs - 70%
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', category: 'etf', allocationPct: 35, market: 'us' },
    { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', category: 'etf', allocationPct: 20, market: 'us' },
    { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', category: 'bond', allocationPct: 15, market: 'us' },
    // Stocks - 25%
    { symbol: 'MSFT', name: 'Microsoft Corporation', category: 'stock', allocationPct: 10, market: 'us' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'stock', allocationPct: 7.5, market: 'us' },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway Class B', category: 'stock', allocationPct: 7.5, market: 'us' },
    // Crypto - 5%
    { symbol: 'BTC', name: 'Bitcoin', category: 'crypto', allocationPct: 3, market: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', category: 'crypto', allocationPct: 2, market: 'crypto' },
  ],
};

/**
 * Claude's Portfolio Strategy
 * European-focused with diversified asset classes
 */
const claudeAllocation: LLMAllocation = {
  provider: 'claude',
  displayName: 'Claude',
  description: 'European-tilted diversified portfolio',
  strategy: '55% Equities, 20% Bonds, 11% Alternatives, 14% Crypto',
  allocations: [
    // European ETFs - 40%
    { symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', category: 'etf', allocationPct: 25, market: 'europe' },
    { symbol: 'CSPX.L', name: 'iShares Core S&P 500 UCITS ETF', category: 'etf', allocationPct: 15, market: 'europe' },
    // Bonds - 20%
    { symbol: 'VAGP.L', name: 'Vanguard Global Aggregate Bond UCITS ETF', category: 'bond', allocationPct: 20, market: 'europe' },
    // Stocks - 15%
    { symbol: 'ASML', name: 'ASML Holding', category: 'stock', allocationPct: 8, market: 'us' },
    { symbol: 'NOVO-B.CO', name: 'Novo Nordisk', category: 'stock', allocationPct: 7, market: 'europe' },
    // Alternatives - 11%
    { symbol: 'GLD', name: 'SPDR Gold Trust', category: 'commodity', allocationPct: 6, market: 'us' },
    { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', category: 'reit', allocationPct: 5, market: 'us' },
    // Crypto - 14%
    { symbol: 'BTC', name: 'Bitcoin', category: 'crypto', allocationPct: 8, market: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', category: 'crypto', allocationPct: 4, market: 'crypto' },
    { symbol: 'SOL', name: 'Solana', category: 'crypto', allocationPct: 2, market: 'crypto' },
  ],
};

/**
 * Perplexity's Portfolio Strategy
 * Research-driven with global diversification
 */
const perplexityAllocation: LLMAllocation = {
  provider: 'perplexity',
  displayName: 'Perplexity',
  description: 'Research-driven global diversification',
  strategy: '60% Equities, 25% Bonds, 5% REIT, 10% Crypto',
  allocations: [
    // Global ETFs - 45%
    { symbol: 'VT', name: 'Vanguard Total World Stock ETF', category: 'etf', allocationPct: 30, market: 'us' },
    { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', category: 'etf', allocationPct: 15, market: 'us' },
    // Stocks - 15%
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stock', allocationPct: 5, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 5, market: 'us' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'stock', allocationPct: 5, market: 'us' },
    // Bonds - 25%
    { symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', category: 'bond', allocationPct: 15, market: 'us' },
    { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', category: 'bond', allocationPct: 10, market: 'us' },
    // REIT - 5%
    { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', category: 'reit', allocationPct: 5, market: 'us' },
    // Crypto - 10%
    { symbol: 'BTC', name: 'Bitcoin', category: 'crypto', allocationPct: 6, market: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', category: 'crypto', allocationPct: 4, market: 'crypto' },
  ],
};

/**
 * ChatGPT's Portfolio Strategy
 * Globally diversified with VWCE as core holding
 */
const chatgptAllocation: LLMAllocation = {
  provider: 'chatgpt',
  displayName: 'ChatGPT',
  description: 'Simple global diversification strategy',
  strategy: '55% Global ETF, 30% Bonds, 5% Gold, 5% Crypto, 5% Stocks',
  allocations: [
    // Core Global ETF - 55%
    { symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', category: 'etf', allocationPct: 55, market: 'europe' },
    // Bonds - 30%
    { symbol: 'AGGH.L', name: 'iShares Core Global Aggregate Bond UCITS ETF', category: 'bond', allocationPct: 30, market: 'europe' },
    // Gold - 5%
    { symbol: 'GLD', name: 'SPDR Gold Trust', category: 'commodity', allocationPct: 5, market: 'us' },
    // Crypto - 5%
    { symbol: 'BTC', name: 'Bitcoin', category: 'crypto', allocationPct: 3, market: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', category: 'crypto', allocationPct: 2, market: 'crypto' },
    // Stock pick - 5%
    { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'stock', allocationPct: 5, market: 'us' },
  ],
};

/**
 * Grok's Portfolio Strategy
 * US-heavy with tech tilt
 */
const grokAllocation: LLMAllocation = {
  provider: 'grok',
  displayName: 'Grok',
  description: 'US-centric with tech exposure',
  strategy: '50% Equities, 30% Bonds, 10% REIT, 10% Crypto',
  allocations: [
    // US ETFs - 35%
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', category: 'etf', allocationPct: 25, market: 'us' },
    { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', category: 'etf', allocationPct: 10, market: 'us' },
    // Stocks - 15%
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stock', allocationPct: 8, market: 'us' },
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stock', allocationPct: 7, market: 'us' },
    // Bonds - 30%
    { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', category: 'bond', allocationPct: 20, market: 'us' },
    { symbol: 'BNDX', name: 'Vanguard Total International Bond ETF', category: 'bond', allocationPct: 10, market: 'us' },
    // REIT - 10%
    { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', category: 'reit', allocationPct: 10, market: 'us' },
    // Crypto - 10%
    { symbol: 'BTC', name: 'Bitcoin', category: 'crypto', allocationPct: 6, market: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', category: 'crypto', allocationPct: 4, market: 'crypto' },
  ],
};

/**
 * All LLM allocations indexed by provider
 */
export const LLM_ALLOCATIONS: Record<LLMProvider, LLMAllocation> = {
  gemini: geminiAllocation,
  claude: claudeAllocation,
  perplexity: perplexityAllocation,
  chatgpt: chatgptAllocation,
  grok: grokAllocation,
};

/**
 * Ordered list of all providers for consistent display
 */
export const LLM_PROVIDERS: LLMProvider[] = ['gemini', 'claude', 'perplexity', 'chatgpt', 'grok'];

/**
 * Initial portfolio balance for each LLM
 */
export const INITIAL_PORTFOLIO_BALANCE = 100000;

/**
 * Get allocation by provider
 */
export function getLLMAllocation(provider: LLMProvider): LLMAllocation {
  return LLM_ALLOCATIONS[provider];
}

/**
 * Validate that allocations sum to 100%
 */
export function validateAllocations(allocations: AllocationItem[]): boolean {
  const total = allocations.reduce((sum, item) => sum + item.allocationPct, 0);
  return Math.abs(total - 100) < 0.01; // Allow small floating point tolerance
}
