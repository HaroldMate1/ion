/**
 * Expert Investor Allocations
 * Based on latest 13F filings and public disclosures (Q3 2025)
 * Prices update in real-time; holdings update when new filings are available
 */

export type InvestorSlug =
  | 'buffett'
  | 'marks'
  | 'smith'
  | 'druckenmiller'
  | 'greenblatt'
  | 'dalio'
  | 'hempton'
  | 'asness'
  | 'burry'
  | 'pabrai';

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
 * Howard Marks - Oaktree Capital Management
 * Based on Q3 2025 13F filing
 */
const marks: ExpertInvestor = {
  slug: 'marks',
  displayName: 'Marks',
  fullName: 'Howard Marks',
  title: 'Co-Chairman, Oaktree Capital Management',
  description: 'Deep-value contrarian investing focused on distressed debt and special situations. Equity portfolio emphasizes cyclical stocks, energy, and commodities.',
  strategy: 'Value Investing - Distressed & Special Situations',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'TRMD', name: 'Torm PLC', category: 'stock', allocationPct: 17.6, market: 'us' },
    { symbol: 'EXE', name: 'Expand Energy Corp', category: 'stock', allocationPct: 11.35, market: 'us' },
    { symbol: 'GTX', name: 'Garrett Motion Inc', category: 'stock', allocationPct: 9.16, market: 'us' },
    { symbol: 'AU', name: 'AngloGold Ashanti Ltd', category: 'stock', allocationPct: 6.21, market: 'us' },
    { symbol: 'VNOM', name: 'Viper Energy Inc', category: 'stock', allocationPct: 5.07, market: 'us' },
    { symbol: 'TDS', name: 'Telephone & Data Systems', category: 'stock', allocationPct: 3.05, market: 'us' },
    { symbol: 'TLN', name: 'Talen Energy Corp', category: 'stock', allocationPct: 2.61, market: 'us' },
    { symbol: 'STKL', name: 'SunOpta Inc', category: 'stock', allocationPct: 2.56, market: 'us' },
    { symbol: 'CORZ', name: 'Core Scientific Inc', category: 'stock', allocationPct: 2.42, market: 'us' },
    { symbol: 'B', name: 'Barnes Group Inc', category: 'stock', allocationPct: 2.28, market: 'us' },
  ],
};

/**
 * Terry Smith - Fundsmith
 * Based on Q3 2025 13F filing (US holdings)
 */
const smith: ExpertInvestor = {
  slug: 'smith',
  displayName: 'Smith',
  fullName: 'Terry Smith',
  title: 'CEO & CIO, Fundsmith LLP',
  description: 'Buy-and-hold quality growth investing. Focuses on companies with high returns on capital, strong competitive moats, and predictable cash flows.',
  strategy: 'Quality Growth - Buy & Hold',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'SYK', name: 'Stryker Corp', category: 'stock', allocationPct: 8.57, market: 'us' },
    { symbol: 'IDXX', name: 'IDEXX Laboratories', category: 'stock', allocationPct: 8.43, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 7.72, market: 'us' },
    { symbol: 'MSFT', name: 'Microsoft Corp', category: 'stock', allocationPct: 6.76, market: 'us' },
    { symbol: 'V', name: 'Visa Inc.', category: 'stock', allocationPct: 6.65, market: 'us' },
    { symbol: 'ADP', name: 'Automatic Data Processing', category: 'stock', allocationPct: 6.39, market: 'us' },
    { symbol: 'WAT', name: 'Waters Corp', category: 'stock', allocationPct: 5.99, market: 'us' },
    { symbol: 'PM', name: 'Philip Morris International', category: 'stock', allocationPct: 5.89, market: 'us' },
    { symbol: 'META', name: 'Meta Platforms Inc.', category: 'stock', allocationPct: 5.78, market: 'us' },
    { symbol: 'MAR', name: 'Marriott International', category: 'stock', allocationPct: 5.56, market: 'us' },
  ],
};

/**
 * Stanley Druckenmiller - Duquesne Family Office
 * Based on Q3 2025 13F filing
 */
const druckenmiller: ExpertInvestor = {
  slug: 'druckenmiller',
  displayName: 'Druckenmiller',
  fullName: 'Stanley Druckenmiller',
  title: 'Chairman & CEO, Duquesne Family Office',
  description: 'Top-down macro investor with high-conviction concentrated bets. Aggressive position sizing with willingness to overhaul the portfolio quarter to quarter.',
  strategy: 'Global Macro - High Conviction',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'NTRA', name: 'Natera Inc', category: 'stock', allocationPct: 16.1, market: 'us' },
    { symbol: 'INSM', name: 'Insmed Inc', category: 'stock', allocationPct: 10.8, market: 'us' },
    { symbol: 'TEVA', name: 'Teva Pharmaceutical', category: 'stock', allocationPct: 10.4, market: 'us' },
    { symbol: 'TSM', name: 'Taiwan Semiconductor', category: 'stock', allocationPct: 6.6, market: 'us' },
    { symbol: 'CPNG', name: 'Coupang Inc', category: 'stock', allocationPct: 4.6, market: 'us' },
    { symbol: 'DOCU', name: 'DocuSign Inc', category: 'stock', allocationPct: 3.8, market: 'us' },
    { symbol: 'VRNA', name: 'Verona Pharma PLC', category: 'stock', allocationPct: 3.3, market: 'us' },
    { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', category: 'etf', allocationPct: 3.1, market: 'us' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', category: 'stock', allocationPct: 3.0, market: 'us' },
    { symbol: 'COHR', name: 'Coherent Corp', category: 'stock', allocationPct: 2.4, market: 'us' },
  ],
};

/**
 * Joel Greenblatt - Gotham Asset Management
 * Based on Q3 2025 13F filing
 * Extremely diversified (1,600+ positions), top holdings shown
 */
const greenblatt: ExpertInvestor = {
  slug: 'greenblatt',
  displayName: 'Greenblatt',
  fullName: 'Joel Greenblatt',
  title: 'Founder, Gotham Asset Management',
  description: 'Quantitative value investing using the "Magic Formula" (ranking by earnings yield and return on capital). Runs enhanced index products. 1,600+ holdings.',
  strategy: 'Quantitative Value - Magic Formula',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', category: 'etf', allocationPct: 16.1, market: 'us' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', category: 'stock', allocationPct: 2.2, market: 'us' },
    { symbol: 'AAPL', name: 'Apple Inc', category: 'stock', allocationPct: 1.7, market: 'us' },
    { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', category: 'etf', allocationPct: 1.1, market: 'us' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', category: 'stock', allocationPct: 0.9, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 0.7, market: 'us' },
    { symbol: 'SNOW', name: 'Snowflake Inc', category: 'stock', allocationPct: 0.7, market: 'us' },
    { symbol: 'WDC', name: 'Western Digital Corp', category: 'stock', allocationPct: 0.6, market: 'us' },
    { symbol: 'MSFT', name: 'Microsoft Corp', category: 'stock', allocationPct: 0.5, market: 'us' },
    { symbol: 'META', name: 'Meta Platforms Inc.', category: 'stock', allocationPct: 0.5, market: 'us' },
    // Remaining ~75% spread across 1,668 other positions
  ],
};

/**
 * Ray Dalio - Bridgewater Associates
 * Based on Q3 2025 13F filing
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
 * John Hempton - Bronte Capital Management
 * Based on Q3 2025 13F filing (US positions only)
 */
const hempton: ExpertInvestor = {
  slug: 'hempton',
  displayName: 'Hempton',
  fullName: 'John Hempton',
  title: 'Co-Founder & CIO, Bronte Capital',
  description: 'Long/short equity with deep forensic analysis. Known for identifying frauds on the short side and high-quality compounders on the long side.',
  strategy: 'Long/Short Equity - Forensic Analysis',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'IBKR', name: 'Interactive Brokers Group', category: 'stock', allocationPct: 15.8, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 12.0, market: 'us' },
    { symbol: 'REGN', name: 'Regeneron Pharmaceuticals', category: 'stock', allocationPct: 11.5, market: 'us' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway (Class B)', category: 'stock', allocationPct: 10.2, market: 'us' },
    { symbol: 'V', name: 'Visa Inc.', category: 'stock', allocationPct: 8.5, market: 'us' },
    { symbol: 'PM', name: 'Philip Morris International', category: 'stock', allocationPct: 7.5, market: 'us' },
    { symbol: 'ALNY', name: 'Alnylam Pharmaceuticals', category: 'stock', allocationPct: 5.0, market: 'us' },
    { symbol: 'SHC', name: 'Sotera Health Company', category: 'stock', allocationPct: 3.5, market: 'us' },
    { symbol: 'ENVX', name: 'Enovix Corp', category: 'stock', allocationPct: 2.33, market: 'us' },
    // Remaining ~24% in smaller positions and non-US holdings
  ],
};

/**
 * Cliff Asness - AQR Capital Management
 * Based on Q3 2025 13F filing
 * Systematic quantitative, 3,400+ positions
 */
const asness: ExpertInvestor = {
  slug: 'asness',
  displayName: 'Asness',
  fullName: 'Cliff Asness',
  title: 'Founder & CIO, AQR Capital Management',
  description: 'Systematic quantitative factor-based investing across value, momentum, carry, and defensive factors. Extremely diversified with 3,400+ positions.',
  strategy: 'Systematic Factor Investing - Multi-Strategy',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'NVDA', name: 'NVIDIA Corp', category: 'stock', allocationPct: 2.62, market: 'us' },
    { symbol: 'MSFT', name: 'Microsoft Corp', category: 'stock', allocationPct: 2.05, market: 'us' },
    { symbol: 'AAPL', name: 'Apple Inc', category: 'stock', allocationPct: 1.77, market: 'us' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', category: 'stock', allocationPct: 0.98, market: 'us' },
    { symbol: 'AVGO', name: 'Broadcom Inc', category: 'stock', allocationPct: 0.90, market: 'us' },
    { symbol: 'RBLX', name: 'Roblox Corp', category: 'stock', allocationPct: 0.84, market: 'us' },
    { symbol: 'META', name: 'Meta Platforms Inc.', category: 'stock', allocationPct: 0.81, market: 'us' },
    { symbol: 'WMT', name: 'Walmart Inc', category: 'stock', allocationPct: 0.77, market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stock', allocationPct: 0.64, market: 'us' },
    { symbol: 'VRSN', name: 'VeriSign Inc', category: 'stock', allocationPct: 0.63, market: 'us' },
    // Remaining ~88% spread across 3,446 other positions
  ],
};

/**
 * Michael Burry - Scion Asset Management
 * Based on Q3 2025 13F filing
 */
const burry: ExpertInvestor = {
  slug: 'burry',
  displayName: 'Burry',
  fullName: 'Michael Burry',
  title: 'Founder, Scion Asset Management',
  description: 'Contrarian deep-value investor. Famous for "The Big Short". Currently bearish on AI with concentrated long equity positions.',
  strategy: 'Contrarian Deep-Value - Concentrated',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'LULU', name: 'Lululemon Athletica', category: 'stock', allocationPct: 22.0, market: 'us' },
    { symbol: 'MOH', name: 'Molina Healthcare', category: 'stock', allocationPct: 21.0, market: 'us' },
    { symbol: 'SLM', name: 'SLM Corp (Sallie Mae)', category: 'stock', allocationPct: 17.0, market: 'us' },
    { symbol: 'PFE', name: 'Pfizer Inc.', category: 'stock', allocationPct: 15.0, market: 'us' },
    { symbol: 'HAL', name: 'Halliburton Co.', category: 'stock', allocationPct: 10.0, market: 'us' },
    // Remaining 15% stays as cash
  ],
};

/**
 * Mohnish Pabrai - Pabrai Investment Funds
 * Based on Q3 2025 13F filing
 * Only 5 holdings, 100% allocated
 */
const pabrai: ExpertInvestor = {
  slug: 'pabrai',
  displayName: 'Pabrai',
  fullName: 'Mohnish Pabrai',
  title: 'Managing Partner, Pabrai Investment Funds',
  description: 'Concentrated deep-value investing inspired by Buffett and Munger. "Heads I win, tails I don\'t lose much" philosophy. Only 5 holdings, all in energy/commodities.',
  strategy: 'Concentrated Deep Value - Dhandho',
  dataSource: '13F Filing Q3 2025',
  lastUpdated: '2025-09-30',
  holdings: [
    { symbol: 'HCC', name: 'Warrior Met Coal Inc', category: 'stock', allocationPct: 34.0, market: 'us' },
    { symbol: 'AMR', name: 'Alpha Metallurgical Resources', category: 'stock', allocationPct: 25.91, market: 'us' },
    { symbol: 'RIG', name: 'Transocean Ltd', category: 'stock', allocationPct: 22.64, market: 'us' },
    { symbol: 'VAL', name: 'Valaris Ltd', category: 'stock', allocationPct: 15.44, market: 'us' },
    { symbol: 'NE', name: 'Noble Corp PLC', category: 'stock', allocationPct: 2.01, market: 'us' },
  ],
};

/**
 * All expert investors indexed by slug
 */
export const EXPERT_INVESTORS: Record<InvestorSlug, ExpertInvestor> = {
  buffett,
  marks,
  smith,
  druckenmiller,
  greenblatt,
  dalio,
  hempton,
  asness,
  burry,
  pabrai,
};

/**
 * Ordered list of all investor slugs for consistent display
 */
export const INVESTOR_SLUGS: InvestorSlug[] = [
  'buffett',
  'marks',
  'smith',
  'druckenmiller',
  'greenblatt',
  'dalio',
  'hempton',
  'asness',
  'burry',
  'pabrai',
];

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
