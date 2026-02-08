/**
 * Expert Investor Allocations
 * Based on latest 13F filings and public disclosures (Q3 2025)
 * Prices update in real-time; holdings update when new filings are available
 */

export type InvestorSlug = 'buffett' | 'pelosi' | 'dalio' | 'wood' | 'burry';

export type AssetCategory = 'stock' | 'etf' | 'crypto' | 'bond' | 'reit' | 'commodity';

export interface InvestorHolding {
  symbol: string;
  name: string;
  category: AssetCategory;
  allocationPct: number;
  market: 'us' | 'europe' | 'crypto';
}

export interface ExpertInvestor {
  slug: InvestorSlug;
  displayName: string;
  fullName: string;
  title: string;
  description: string;
  strategy: string;
  dataSource: string;
  lastUpdated: string;
  holdings: InvestorHolding[];
}

/**
 * Warren Buffett - Berkshire Hathaway
 * Based on Q3 2025 13F filing
 */
const buffett: ExpertInvestor = {
  slug: 'buffett',
  displayName: 'Buffett',
  fullName: 'Warren Buffett',
  title: 'Chairman, Berkshire Hathaway',
  description: 'Value investing legend. Concentrated portfolio of blue-chip American companies with long holding periods.',
  strategy: 'Value Investing - Blue-Chip Stocks',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stock', allocationPct: 26.0, market: 'us' },
    { symbol: 'AXP', name: 'American Express Co.', category: 'stock', allocationPct: 21.0, market: 'us' },
    { symbol: 'BAC', name: 'Bank of America Corp.', category: 'stock', allocationPct: 12.5, market: 'us' },
    { symbol: 'KO', name: 'Coca-Cola Co.', category: 'stock', allocationPct: 12.5, market: 'us' },
    { symbol: 'CVX', name: 'Chevron Corp.', category: 'stock', allocationPct: 8.5, market: 'us' },
    { symbol: 'OXY', name: 'Occidental Petroleum', category: 'stock', allocationPct: 5.0, market: 'us' },
    { symbol: 'MCO', name: "Moody's Corp.", category: 'stock', allocationPct: 4.5, market: 'us' },
    { symbol: 'CB', name: 'Chubb Limited', category: 'stock', allocationPct: 4.0, market: 'us' },
    { symbol: 'KHC', name: 'Kraft Heinz Co.', category: 'stock', allocationPct: 3.5, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 2.5, market: 'us' },
  ],
};

/**
 * Nancy Pelosi
 * Based on congressional disclosure filings (Jan 2026)
 * Pelosi uses deep-in-the-money call options; modeled as equivalent long exposure
 */
const pelosi: ExpertInvestor = {
  slug: 'pelosi',
  displayName: 'Pelosi',
  fullName: 'Nancy Pelosi',
  title: 'U.S. Representative, California',
  description: 'Known for high-conviction tech/AI bets via call options. Congressional disclosures show a heavy tilt toward AI and semiconductor stocks.',
  strategy: 'Tech & AI-Heavy - Call Options Strategy',
  dataSource: 'Congressional Disclosure Jan 2026',
  lastUpdated: '2026-01-23',
  holdings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'stock', allocationPct: 30.0, market: 'us' },
    { symbol: 'AVGO', name: 'Broadcom Inc.', category: 'stock', allocationPct: 18.0, market: 'us' },
    { symbol: 'PANW', name: 'Palo Alto Networks', category: 'stock', allocationPct: 14.0, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 10.0, market: 'us' },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'VST', name: 'Vistra Corp.', category: 'stock', allocationPct: 7.0, market: 'us' },
    { symbol: 'TEM', name: 'Tempus AI Inc.', category: 'stock', allocationPct: 5.0, market: 'us' },
  ],
};

/**
 * Ray Dalio - Bridgewater Associates
 * Based on Q3 2025 13F filing
 * Extremely diversified macro/risk-parity approach
 */
const dalio: ExpertInvestor = {
  slug: 'dalio',
  displayName: 'Dalio',
  fullName: 'Ray Dalio',
  title: 'Founder, Bridgewater Associates',
  description: 'Macro investor with risk-parity approach. Extremely diversified portfolio with 1,000+ holdings, heavy use of index ETFs.',
  strategy: 'Macro Risk-Parity - Diversified',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', category: 'etf', allocationPct: 22.0, market: 'us' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', category: 'etf', allocationPct: 14.0, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 10.0, market: 'us' },
    { symbol: 'LRCX', name: 'Lam Research Corp.', category: 'stock', allocationPct: 9.0, market: 'us' },
    { symbol: 'GEV', name: 'GE Vernova Inc.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'stock', allocationPct: 7.0, market: 'us' },
    { symbol: 'CRM', name: 'Salesforce Inc.', category: 'stock', allocationPct: 7.0, market: 'us' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'stock', allocationPct: 7.0, market: 'us' },
  ],
};

/**
 * Cathie Wood - ARK Invest (ARKK ETF)
 * Based on ARKK holdings as of early 2026
 * Disruptive innovation focus
 */
const wood: ExpertInvestor = {
  slug: 'wood',
  displayName: 'Cathie Wood',
  fullName: 'Cathie Wood',
  title: 'CEO, ARK Investment Management',
  description: 'Disruptive innovation investor. High-conviction bets on AI, genomics, fintech, and automation with concentrated positions.',
  strategy: 'Disruptive Innovation - High Growth',
  dataSource: 'ARKK Holdings Early 2026',
  lastUpdated: '2026-01-15',
  holdings: [
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stock', allocationPct: 20.0, market: 'us' },
    { symbol: 'CRSP', name: 'CRISPR Therapeutics', category: 'stock', allocationPct: 11.0, market: 'us' },
    { symbol: 'TEM', name: 'Tempus AI Inc.', category: 'stock', allocationPct: 10.0, market: 'us' },
    { symbol: 'ROKU', name: 'Roku Inc.', category: 'stock', allocationPct: 10.0, market: 'us' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'COIN', name: 'Coinbase Global Inc.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'HOOD', name: 'Robinhood Markets Inc.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'SHOP', name: 'Shopify Inc.', category: 'stock', allocationPct: 8.0, market: 'us' },
    { symbol: 'BEAM', name: 'Beam Therapeutics Inc.', category: 'stock', allocationPct: 8.5, market: 'us' },
    { symbol: 'TER', name: 'Teradyne Inc.', category: 'stock', allocationPct: 8.5, market: 'us' },
  ],
};

/**
 * Michael Burry - Scion Asset Management
 * Based on Q3 2025 13F filing
 * Known for "The Big Short"; contrarian deep-value investor
 * Note: Burry holds massive PUT positions on PLTR and NVDA (bearish AI trade)
 * We model his long equity/call positions only for the simulation
 */
const burry: ExpertInvestor = {
  slug: 'burry',
  displayName: 'Burry',
  fullName: 'Michael Burry',
  title: 'Founder, Scion Asset Management',
  description: 'Contrarian deep-value investor. Famous for "The Big Short". Currently bearish on AI (puts on PLTR, NVDA) with concentrated long equity positions.',
  strategy: 'Contrarian Deep-Value - Concentrated',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'LULU', name: 'Lululemon Athletica', category: 'stock', allocationPct: 22.0, market: 'us' },
    { symbol: 'MOH', name: 'Molina Healthcare', category: 'stock', allocationPct: 21.0, market: 'us' },
    { symbol: 'SLM', name: 'SLM Corp (Sallie Mae)', category: 'stock', allocationPct: 17.0, market: 'us' },
    { symbol: 'PFE', name: 'Pfizer Inc.', category: 'stock', allocationPct: 15.0, market: 'us' },
    { symbol: 'HAL', name: 'Halliburton Co.', category: 'stock', allocationPct: 10.0, market: 'us' },
    // Remaining 15% stays as cash (Burry is known for high cash positions)
    // His large PUT positions on PLTR and NVDA are not modeled as long exposure
  ],
};

/**
 * All expert investors indexed by slug
 */
export const EXPERT_INVESTORS: Record<InvestorSlug, ExpertInvestor> = {
  buffett,
  pelosi,
  dalio,
  wood,
  burry,
};

/**
 * Ordered list of all investor slugs for consistent display
 */
export const INVESTOR_SLUGS: InvestorSlug[] = ['buffett', 'pelosi', 'dalio', 'wood', 'burry'];

/**
 * Initial portfolio balance for each investor simulation
 */
export const INITIAL_EXPERT_BALANCE = 100000;

/**
 * Get investor by slug
 */
export function getExpertInvestor(slug: InvestorSlug): ExpertInvestor {
  return EXPERT_INVESTORS[slug];
}
