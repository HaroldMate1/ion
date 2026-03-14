/**
 * Trading Coach Types
 * Type definitions for the AI trading coach system
 */

import type { AssetType, Market } from '@/types';

// ============================================================================
// Core Types
// ============================================================================

export type TradeAction = 'BUY' | 'SELL' | 'HOLD';
export type TradeStatus = 'open' | 'closed' | 'stopped' | 'tp_hit';
export type Timeframe = '1H' | '4H' | '1D' | '1W';

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentProposal {
  agent: string;
  action: TradeAction;
  confidence: number; // 0 to 1
  entryZone?: { low: number; high: number };
  stopLoss?: number;
  takeProfits?: TakeProfitLevel[];
  expectedReturn?: number; // percentage
  expectedRisk?: number; // percentage
  rationale: string;
  metrics?: Record<string, number | string>;
}

export interface TakeProfitLevel {
  price: number;
  percentage: number; // % of position to close
  type: 'fixed' | 'trailing';
  trailingAtr?: number;
}

export interface AgentInput {
  symbol: string;
  assetType: AssetType;
  market: Market;
  currentPrice: number;
  ohlcData: OHLCData[];
  config: CoachConfig;
}

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ============================================================================
// Consensus Types
// ============================================================================

export interface ConsensusResult {
  action: TradeAction;
  confidence: number; // 0 to 1
  consensusScore: number; // 0 to 1, Nash product normalized
  entryZone?: { low: number; high: number };
  stopLoss?: number;
  takeProfits?: TakeProfitLevel[];
  agentVotes: { agent: string; action: TradeAction; confidence: number }[];
  rationale: string;
  expectedReturn?: number;
  expectedRisk?: number;
  riskRewardRatio?: number;
}

export interface ConsensusWeights {
  indicator: number;
  priceAction: number;
  news: number;
}

// ============================================================================
// Risk Types
// ============================================================================

export interface RiskAssessment {
  approved: boolean;
  reason?: string;
  positionSize?: number;
  stopLoss?: number;
  takeProfits?: TakeProfitLevel[];
  expectedReturn?: number;
  expectedRisk?: number;
  riskRewardRatio?: number;
  warnings: string[];
  rules: string[];
}

export interface RiskParams {
  maxAllocationPct: number;
  maxOpenPositions: number;
  useLeverage: boolean;
  stopLossStockPct: number;
  stopLossCryptoPct: number;
  stopLossAtrMultiplier: number;
  tp1Pct: number;
  tp2Pct: number;
  runnerPct: number;
  trailingAtrMultiplier: number;
  dailyDrawdownLimitPct: number;
  maxConsecutiveLosses: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface CoachConfig {
  userId: string;
  killSwitch: boolean;
  weights: ConsensusWeights;
  minConfidence: number;
  minConsensusScore: number;
  riskParams: RiskParams;
  watchSymbols: string[];
  runCadenceMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_COACH_CONFIG: Omit<CoachConfig, 'userId'> = {
  killSwitch: false,
  weights: {
    indicator: 0.45,
    priceAction: 0.45,
    news: 0.10,
  },
  minConfidence: 0.35,
  minConsensusScore: 0.05,
  riskParams: {
    maxAllocationPct: 100.00,
    maxOpenPositions: 100,
    useLeverage: false,
    stopLossStockPct: 2.50,
    stopLossCryptoPct: 6.00,
    stopLossAtrMultiplier: 1.50,
    tp1Pct: 50.00,
    tp2Pct: 25.00,
    runnerPct: 25.00,
    trailingAtrMultiplier: 1.00,
    dailyDrawdownLimitPct: 100.00,
    maxConsecutiveLosses: 100,
  },
  watchSymbols: DEFAULT_WATCHLIST,
  runCadenceMinutes: 15,
};

/** Initial paper trading balance for the coach */
export const INITIAL_COACH_BALANCE = 100000;

/** Number of symbols to analyze per run (rotating batch) */
export const BATCH_SIZE = 30;

/**
 * Global Watch Universe — 200+ symbols across all major markets.
 * Format: plain symbol for US stocks, "SYMBOL:assetType:market" for others.
 * Symbols are rotated in batches of BATCH_SIZE per analysis run.
 */
export const DEFAULT_WATCHLIST: string[] = [
  // ═══════════════════════════════════════════════════════════════════
  // US STOCKS — S&P 500 Top 50 by market cap
  // ═══════════════════════════════════════════════════════════════════
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK.B', 'LLY', 'AVGO', 'TSLA',
  'JPM', 'WMT', 'V', 'UNH', 'XOM', 'MA', 'COST', 'JNJ', 'HD', 'PG',
  'ORCL', 'ABBV', 'BAC', 'CRM', 'NFLX', 'CVX', 'MRK', 'KO', 'AMD', 'PEP',
  'ADBE', 'CSCO', 'TMO', 'INTC', 'DIS', 'ABT', 'QCOM', 'INTU', 'CMCSA', 'NKE',
  'TXN', 'AMGN', 'PM', 'MS', 'RTX', 'NEE', 'ISRG', 'UBER', 'HON', 'LOW',

  // US Mid-Cap Growth
  'PANW', 'SNOW', 'DDOG', 'CRWD', 'ZS', 'NET', 'ABNB', 'DASH', 'SQ', 'COIN',
  'PLTR', 'MELI', 'SHOP', 'LULU', 'RIVN', 'LCID', 'SOFI', 'RBLX', 'ROKU', 'PINS',

  // ═══════════════════════════════════════════════════════════════════
  // EUROPEAN STOCKS — Top companies by market cap
  // ═══════════════════════════════════════════════════════════════════
  // Germany (XETRA .DE)
  'SAP.DE:stock:europe', 'SIE.DE:stock:europe', 'DTE.DE:stock:europe', 'ALV.DE:stock:europe', 'MBG.DE:stock:europe',
  'BMW.DE:stock:europe', 'BAS.DE:stock:europe', 'ADS.DE:stock:europe',
  // France (Euronext .PA)
  'MC.PA:stock:europe', 'OR.PA:stock:europe', 'TTE.PA:stock:europe', 'SAN.PA:stock:europe', 'AI.PA:stock:europe',
  'BN.PA:stock:europe', 'AIR.PA:stock:europe', 'SU.PA:stock:europe',
  // Netherlands (Euronext .AS)
  'ASML.AS:stock:europe', 'PHIA.AS:stock:europe', 'INGA.AS:stock:europe', 'UNA.AS:stock:europe',
  // UK (LSE .L)
  'SHEL.L:stock:europe', 'AZN.L:stock:europe', 'HSBA.L:stock:europe', 'ULVR.L:stock:europe',
  'BP.L:stock:europe', 'RIO.L:stock:europe', 'GSK.L:stock:europe', 'LSEG.L:stock:europe',
  // Switzerland (.SW)
  'NESN.SW:stock:europe', 'NOVN.SW:stock:europe', 'ROG.SW:stock:europe',
  // Denmark (.CO)
  'NOVO-B.CO:stock:europe', 'MAERSK-B.CO:stock:europe',
  // Spain (.MC)
  'ITX.MC:stock:europe', 'SAN.MC:stock:europe', 'IBE.MC:stock:europe',
  // Italy (.MI)
  'ENI.MI:stock:europe', 'ENEL.MI:stock:europe', 'ISP.MI:stock:europe',

  // ═══════════════════════════════════════════════════════════════════
  // ASIAN STOCKS — Major markets
  // ═══════════════════════════════════════════════════════════════════
  // Japan (.T — Tokyo)
  '7203.T:stock:us', '6758.T:stock:us', '9984.T:stock:us', '6861.T:stock:us', '8306.T:stock:us',
  '9432.T:stock:us', '6501.T:stock:us', '7267.T:stock:us',
  // South Korea (.KS — KOSPI)
  '005930.KS:stock:us', '000660.KS:stock:us', '035420.KS:stock:us',
  // Hong Kong (.HK)
  '0700.HK:stock:us', '9988.HK:stock:us', '1299.HK:stock:us', '0005.HK:stock:us',
  // India (.NS — NSE)
  'RELIANCE.NS:stock:us', 'TCS.NS:stock:us', 'INFY.NS:stock:us', 'HDFCBANK.NS:stock:us',
  // Australia (.AX — ASX)
  'BHP.AX:stock:us', 'CBA.AX:stock:us', 'CSL.AX:stock:us',

  // ═══════════════════════════════════════════════════════════════════
  // LATIN AMERICA
  // ═══════════════════════════════════════════════════════════════════
  // Brazil (.SA — B3)
  'VALE3.SA:stock:latam', 'PETR4.SA:stock:latam', 'ITUB4.SA:stock:latam', 'BBDC4.SA:stock:latam',
  'WEGE3.SA:stock:latam', 'ABEV3.SA:stock:latam', 'B3SA3.SA:stock:latam', 'RENT3.SA:stock:latam',
  'MGLU3.SA:stock:latam', 'SUZB3.SA:stock:latam',
  // Mexico (.MX — BMV)
  'FEMSAUBD.MX:stock:latam', 'GFNORTEO.MX:stock:latam', 'WALMEX.MX:stock:latam',
  'AMXL.MX:stock:latam', 'CEMEXCPO.MX:stock:latam', 'BIMBOA.MX:stock:latam',
  // Colombia (.CL — BVC)
  'ECOPETROL.CL:stock:latam', 'PFBCOLOM.CL:stock:latam', 'GRUPOSUR.CL:stock:latam',
  'ISA.CL:stock:latam', 'NUTRESA.CL:stock:latam',
  // Chile (.SN — BCS)
  'FALABELLA.SN:stock:latam', 'CENCOSUD.SN:stock:latam', 'SQM-B.SN:stock:latam',
  'COPEC.SN:stock:latam', 'BSANTANDER.SN:stock:latam',
  // Argentina (.BA — BCBA)
  'GGAL.BA:stock:latam', 'YPF.BA:stock:latam', 'PAMP.BA:stock:latam',
  // Peru (via US ADRs)
  'BVN:stock:us', 'BAP:stock:us',

  // ═══════════════════════════════════════════════════════════════════
  // US & INTERNATIONAL ETFs
  // ═══════════════════════════════════════════════════════════════════
  // US Broad Market & Sectors
  'SPY:etf:us', 'QQQ:etf:us', 'IWM:etf:us', 'DIA:etf:us',
  'XLF:etf:us', 'XLE:etf:us', 'XLK:etf:us', 'XLV:etf:us', 'XLI:etf:us', 'XLU:etf:us',
  'ARKK:etf:us', 'ARKW:etf:us',
  // International & Emerging
  'VEA:etf:us', 'VWO:etf:us', 'EEM:etf:us', 'EWJ:etf:us', 'FXI:etf:us', 'EWZ:etf:us',
  // Fixed Income
  'TLT:etf:us', 'BND:etf:us', 'HYG:etf:us', 'LQD:etf:us',
  // Commodities & Real Assets
  'GLD:etf:us', 'SLV:etf:us', 'USO:etf:us', 'VNQ:etf:us',

  // ═══════════════════════════════════════════════════════════════════
  // CRYPTO — Top 15
  // ═══════════════════════════════════════════════════════════════════
  'BTC:crypto:us', 'ETH:crypto:us', 'SOL:crypto:us', 'XRP:crypto:us', 'ADA:crypto:us',
  'AVAX:crypto:us', 'DOT:crypto:us', 'MATIC:crypto:us', 'LINK:crypto:us', 'UNI:crypto:us',
  'DOGE:crypto:us', 'SHIB:crypto:us', 'LTC:crypto:us', 'ATOM:crypto:us', 'NEAR:crypto:us',

  // ═══════════════════════════════════════════════════════════════════
  // COMMODITIES — Futures
  // ═══════════════════════════════════════════════════════════════════
  'GC=F:stock:us',   // Gold
  'SI=F:stock:us',   // Silver
  'CL=F:stock:us',   // Crude Oil WTI
  'BZ=F:stock:us',   // Brent Crude
  'NG=F:stock:us',   // Natural Gas
  'ZC=F:stock:us',   // Corn
  'ZW=F:stock:us',   // Wheat

  // ═══════════════════════════════════════════════════════════════════
  // FOREX — Major Pairs
  // ═══════════════════════════════════════════════════════════════════
  'EURUSD=X:stock:us', 'GBPUSD=X:stock:us', 'USDJPY=X:stock:us',
  'USDCHF=X:stock:us', 'AUDUSD=X:stock:us', 'USDCAD=X:stock:us',
  'USDCOP=X:stock:us', 'USDMXN=X:stock:us', 'USDBRL=X:stock:us',
];


// ============================================================================
// Signal Types
// ============================================================================

export interface CoachSignal {
  id: string;
  userId: string;
  symbol: string;
  assetType: AssetType;
  market: Market;
  timeframe: Timeframe;
  signalTs: string;
  consensusAction: TradeAction;
  consensusScore: number;
  entryLow?: number;
  entryHigh?: number;
  stopLoss?: number;
  takeProfitJson?: TakeProfitLevel[];
  agentVotesJson: AgentProposal[];
  rationale?: string;
  expectedReturnPct?: number;
  expectedRiskPct?: number;
  riskRewardRatio?: number;
  marketOpen: boolean;
  currentPrice?: number;
  isStale: boolean;
  acknowledged: boolean;
  createdAt: string;
}

// ============================================================================
// Paper Trade Types
// ============================================================================

export interface CoachPaperTrade {
  id: string;
  userId: string;
  signalId?: string;
  symbol: string;
  assetType: AssetType;
  market: Market;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  sizeUsd: number;
  quantity: number;
  stopLoss?: number;
  takeProfitJson?: TakeProfitLevel[];
  status: TradeStatus;
  openedAt: string;
  closedAt?: string;
  exitPrice?: number;
  pnlUsd?: number;
  pnlPct?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Report Types
// ============================================================================

export interface CoachDailyReport {
  id: string;
  userId: string;
  reportDate: string;
  metricsJson: DailyReportMetrics;
  createdAt: string;
}

export interface DailyReportMetrics {
  signalsGenerated: number;
  signalsByAction: { BUY: number; SELL: number; HOLD: number };
  paperTradesOpened: number;
  paperTradesClosed: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  winRate: number;
  avgRiskReward: number;
  topPerformers: { symbol: string; pnlPct: number }[];
  worstPerformers: { symbol: string; pnlPct: number }[];
  circuitBreakerTriggered: boolean;
  notes?: string;
  summary?: string;
  tradeRationales?: { symbol: string; action: string; rationale: string }[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface RunAnalysisResult {
  success: boolean;
  signalsGenerated: number;
  signals: CoachSignal[];
  errors?: string[];
  killSwitchActive?: boolean;
  circuitBreakerActive?: boolean;
}

export interface GenerateReportResult {
  success: boolean;
  report?: CoachDailyReport;
  error?: string;
}

// ============================================================================
// Technical Indicator Types
// ============================================================================

export interface IndicatorMetrics {
  // Trend
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;

  // Momentum
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;

  // Volatility
  atr14: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerWidth: number;

  // Price position
  priceVsSma20: number;
  priceVsSma50: number;
  priceVsSma200: number;
}

export interface PriceActionMetrics {
  // Support/Resistance
  nearestSupport: number;
  nearestResistance: number;
  distanceToSupport: number;
  distanceToResistance: number;

  // Patterns
  recentHigh: number;
  recentLow: number;
  isBreakingOut: boolean;
  breakoutDirection?: 'up' | 'down';

  // Candle patterns
  lastCandleType: 'bullish' | 'bearish' | 'doji';
  trendStrength: number;
}
