/**
 * Wizard Strategy Configuration
 * Joel Greenblatt's Magic Formula and Enhanced variant
 */

export const WIZARD_STRATEGIES = ['merlin', 'houdini'] as const;
export type WizardStrategy = (typeof WIZARD_STRATEGIES)[number];

export const INITIAL_WIZARD_BALANCE = 100_000;
export const WIZARD_TOP_N = 30; // top 30 companies per strategy

export interface WizardStrategyConfig {
  strategy: WizardStrategy;
  displayName: string;
  icon: 'merlin' | 'houdini';
  title: string;
  description: string;
  methodology: string;
  filters: string[];
}

export const WIZARD_CONFIGS: Record<WizardStrategy, WizardStrategyConfig> = {
  merlin: {
    strategy: 'merlin',
    displayName: 'Merlin',
    icon: 'merlin',
    title: "Merlin — Joel Greenblatt's Magic Formula",
    description:
      "Applies Joel Greenblatt's Magic Formula: rank companies by Earnings Yield (1/P·E) and Return on Capital (ROE), combine ranks, and invest equally in the top 30.",
    methodology:
      'Ranks a universe of ~150 large-cap global stocks by two metrics: (1) Earnings Yield = 1 / trailing P/E — favours cheap companies; (2) Return on Equity — favours efficient companies. The combined rank score picks the 30 best across both dimensions. Note: this is an approximation of Greenblatt\'s exact formula, optimised for data reliability.',
    filters: [
      'Positive trailing P/E ratio',
      'Positive Return on Equity (ROE)',
      'Market cap > $1B',
    ],
  },
  houdini: {
    strategy: 'houdini',
    displayName: 'Houdini',
    icon: 'houdini',
    title: 'Houdini — Quality Magic Formula',
    description:
      'Magic Formula applied only to companies that pass a quality gate: strong return on equity, healthy operating margins, reasonable valuation, and a clean balance sheet. Screens a global universe of ~150 large-caps.',
    methodology:
      'Before ranking by Earnings Yield (1/P·E) + Return on Equity, Houdini applies four quality filters using real-time data: (1) ROE ≥ 15% — only profitable, efficient businesses; (2) Operating margin ≥ 10% — sustainable core economics; (3) P/E ≤ 40 — excludes speculative valuations; (4) Net Debt/EBITDA < 3× — avoids overleveraged companies. Stocks clearing all four gates are ranked by Magic Formula score; the top 30 are equally weighted. Note: approximation of Greenblatt\'s exact formula, optimised for data reliability.',
    filters: [
      'Return on Equity (ROE) ≥ 15%',
      'Operating margin ≥ 10%',
      'Trailing P/E ≤ 40',
      'Net Debt / EBITDA < 3×',
    ],
  },
};

/**
 * Stock universe screened by the wizard strategies (~150 large-cap global stocks)
 */
export const WIZARD_STOCK_UNIVERSE = [
  // ── US Technology ──────────────────────────────────────────────────────────
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ORCL', 'ADBE',
  'AMD', 'QCOM', 'INTU', 'TXN', 'AMAT', 'MU', 'NOW', 'SNPS',
  'CDNS', 'ADI', 'WDAY', 'CRM', 'PANW', 'UBER', 'ABNB', 'NET', 'ZS',
  // ── US Consumer Discretionary ──────────────────────────────────────────────
  'AMZN', 'TSLA', 'HD', 'MCD', 'COST', 'WMT', 'NKE',
  'SBUX', 'TJX', 'LOW', 'BKNG', 'MAR', 'CMG', 'LULU', 'RCL',
  // ── US Healthcare ──────────────────────────────────────────────────────────
  'JNJ', 'UNH', 'LLY', 'ABBV', 'MRK', 'TMO', 'ABT', 'AMGN',
  'BMY', 'GILD', 'ISRG', 'SYK', 'VRTX', 'REGN', 'ELV', 'HCA', 'CI',
  // ── US Financials ──────────────────────────────────────────────────────────
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'BLK',
  'AXP', 'SCHW', 'SPGI', 'MCO', 'CME', 'ICE', 'PGR', 'CB',
  // ── US Consumer Staples ────────────────────────────────────────────────────
  'PG', 'KO', 'PEP', 'PM', 'MO', 'MDLZ', 'CL', 'KMB',
  // ── US Energy ──────────────────────────────────────────────────────────────
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'VLO', 'OXY', 'PSX',
  // ── US Industrials ─────────────────────────────────────────────────────────
  'HON', 'RTX', 'CAT', 'DE', 'LMT', 'GE', 'UPS', 'ETN', 'PH', 'NOC', 'GD', 'FDX',
  // ── US Communication / Media ───────────────────────────────────────────────
  'NFLX', 'DIS', 'T', 'VZ', 'TMUS', 'CHTR',
  // ── US Materials ───────────────────────────────────────────────────────────
  'LIN', 'APD', 'SHW', 'ECL', 'FCX', 'NEM',
  // ── US Utilities & Real Estate ─────────────────────────────────────────────
  'NEE', 'SO', 'DUK', 'AMT', 'PLD', 'EQIX',

  // ── International — Europe (US-listed ADRs) ────────────────────────────────
  'ASML',  // ASML (Netherlands — Semiconductors)
  'SAP',   // SAP (Germany — Enterprise Software)
  'NVO',   // Novo Nordisk (Denmark — Pharma)
  'AZN',   // AstraZeneca (UK — Pharma)
  'NVS',   // Novartis (Switzerland — Pharma)
  'GSK',   // GSK (UK — Pharma)
  'SNY',   // Sanofi (France — Pharma)
  'RACE',  // Ferrari (Italy — Luxury Autos)
  'STLA',  // Stellantis (Netherlands — Autos)
  'UL',    // Unilever (UK — Consumer Staples)
  'DEO',   // Diageo (UK — Beverages)
  'BP',    // BP (UK — Energy)
  'SHEL',  // Shell (UK — Energy)
  'TTE',   // TotalEnergies (France — Energy)
  'EQNR',  // Equinor (Norway — Energy)
  'RIO',   // Rio Tinto (UK/Australia — Mining)
  'BHP',   // BHP Group (Australia — Mining)
  'ARGX',  // argenx (Netherlands — Biotech)

  // ── International — Asia-Pacific (US-listed ADRs) ──────────────────────────
  'TSM',   // TSMC (Taiwan — Semiconductors)
  'SONY',  // Sony (Japan — Electronics/Entertainment)
  'TM',    // Toyota Motor (Japan — Autos)
  'HMC',   // Honda Motor (Japan — Autos)
  'INFY',  // Infosys (India — IT Services)
  'HDB',   // HDFC Bank (India — Financials)
  'SE',    // Sea Limited (Singapore — Tech/E-commerce)

  // ── International — Americas (US-listed ADRs) ──────────────────────────────
  'SHOP',  // Shopify (Canada — E-commerce)
  'RY',    // Royal Bank of Canada (Canada — Financials)
  'TD',    // TD Bank (Canada — Financials)
  'MELI',  // MercadoLibre (Argentina — E-commerce)
  'NU',    // Nu Holdings (Brazil — Fintech)
];
