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
      'Ranks a universe of ~120 large-cap US stocks by two metrics: (1) Earnings Yield = 1 / trailing P/E — favours cheap companies; (2) Return on Equity — favours efficient companies. The combined rank score picks the 30 best across both dimensions.',
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
    title: 'Houdini — Elite Magic Formula',
    description:
      'Magic Formula applied only to companies that pass an institutional-grade quality gate: elite profitability, fortress balance sheet, multi-year consistency, sensible valuation, high Piotroski & Altman scores, and price confirmation above the 200-day MA.',
    methodology:
      'Before ranking by Earnings Yield + ROE, Houdini runs 19 binary checks across five pillars: (1) Profitability — ROE ≥ 20%, operating margin ≥ 20%, gross margin ≥ 50%, FCF margin ≥ 15%; (2) Debt — Net Debt/EBITDA < 1×, interest coverage ≥ 15×; (3) Consistency — revenue CAGR ≥ 10%, EPS positive every year, FCF positive every year, ≤ 1 revenue decline year; (4) Valuation — PEG ≤ 1.5, EV/EBIT < 18×, FCF yield ≥ 3%, DCF gap ≥ −20%; (5) Quality — Piotroski ≥ 7, Altman Z ≥ 3, institutional ownership ≥ 30%, price above 200-day MA. Only stocks clearing every hurdle proceed to Magic Formula ranking; the portfolio holds all qualifiers (often < 30), each equally weighted.',
    filters: [
      'ROE ≥ 20% · Operating margin ≥ 20% · Gross margin ≥ 50% · FCF margin ≥ 15%',
      'Net Debt/EBITDA < 1× · Interest coverage ≥ 15×',
      'Revenue CAGR ≥ 10% · EPS positive every year · FCF positive every year · ≤ 1 revenue-decline year',
      'PEG ≤ 1.5 · EV/EBIT < 18× · FCF yield ≥ 3% · DCF within 20% of fair value',
      'Piotroski F-Score ≥ 7 · Altman Z ≥ 3.0 · Institutional ownership ≥ 30% · Price above 200-day MA',
    ],
  },
};

/**
 * Stock universe screened by the wizard strategies (~120 large-cap US stocks)
 */
export const WIZARD_STOCK_UNIVERSE = [
  // Technology
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AVGO', 'ORCL', 'ADBE',
  'AMD', 'QCOM', 'INTU', 'TXN', 'AMAT', 'MU', 'NOW', 'SNPS',
  'CDNS', 'ADI', 'WDAY', 'CRM', 'PANW', 'UBER', 'ABNB', 'NET', 'ZS',
  // Consumer Discretionary
  'AMZN', 'TSLA', 'HD', 'MCD', 'COST', 'WMT', 'NKE',
  'SBUX', 'TJX', 'LOW', 'BKNG', 'MAR', 'CMG', 'LULU', 'RCL',
  // Healthcare
  'JNJ', 'UNH', 'LLY', 'ABBV', 'MRK', 'TMO', 'ABT', 'AMGN',
  'BMY', 'GILD', 'ISRG', 'SYK', 'VRTX', 'REGN', 'ELV', 'HCA', 'CI',
  // Financials
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'BLK',
  'AXP', 'SCHW', 'SPGI', 'MCO', 'CME', 'ICE', 'PGR', 'CB',
  // Consumer Staples
  'PG', 'KO', 'PEP', 'PM', 'MO', 'MDLZ', 'CL', 'KMB',
  // Energy
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'VLO', 'OXY', 'PSX',
  // Industrials
  'HON', 'RTX', 'CAT', 'DE', 'LMT', 'GE', 'UPS', 'ETN', 'PH', 'NOC', 'GD', 'FDX',
  // Communication Services
  'NFLX', 'DIS', 'T', 'VZ', 'TMUS', 'CHTR',
  // Materials
  'LIN', 'APD', 'SHW', 'ECL', 'FCX', 'NEM',
  // Utilities
  'NEE', 'SO', 'DUK',
  // Real Estate
  'AMT', 'PLD', 'EQIX',
];
