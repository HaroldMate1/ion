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
  minConfidence: 0.45,
  minConsensusScore: 0.10,
  riskParams: {
    maxAllocationPct: 10.00,
    maxOpenPositions: 4,
    useLeverage: false,
    stopLossStockPct: 2.50,
    stopLossCryptoPct: 6.00,
    stopLossAtrMultiplier: 1.50,
    tp1Pct: 50.00,
    tp2Pct: 25.00,
    runnerPct: 25.00,
    trailingAtrMultiplier: 1.00,
    dailyDrawdownLimitPct: 3.00,
    maxConsecutiveLosses: 3,
  },
  watchSymbols: SP500_DEFAULT_WATCHLIST,
  runCadenceMinutes: 0,
};

/**
 * S&P 500 constituent symbols as default watchlist
 */
export const SP500_DEFAULT_WATCHLIST: string[] = [
  'AAPL', 'ABBV', 'ABT', 'ACN', 'ADBE', 'ADI', 'ADM', 'ADP', 'ADSK', 'AEE',
  'AEP', 'AES', 'AFL', 'AIG', 'AIZ', 'AJG', 'AKAM', 'ALB', 'ALGN', 'ALK',
  'ALL', 'ALLE', 'AMAT', 'AMCR', 'AMD', 'AME', 'AMGN', 'AMP', 'AMT', 'AMZN',
  'ANET', 'ANSS', 'AON', 'AOS', 'APA', 'APD', 'APH', 'APTV', 'ARE', 'ATO',
  'ATVI', 'AVB', 'AVGO', 'AVY', 'AWK', 'AXP', 'AZO', 'BA', 'BAC', 'BAX',
  'BBWI', 'BBY', 'BDX', 'BEN', 'BF.B', 'BIO', 'BIIB', 'BK', 'BKNG', 'BKR',
  'BLK', 'BMY', 'BR', 'BRK.B', 'BRO', 'BSX', 'BWA', 'BXP', 'C', 'CAG',
  'CAH', 'CARR', 'CAT', 'CB', 'CBOE', 'CBRE', 'CCI', 'CCL', 'CDAY', 'CDNS',
  'CDW', 'CE', 'CEG', 'CF', 'CFG', 'CHD', 'CHRW', 'CHTR', 'CI', 'CINF',
  'CL', 'CLX', 'CMA', 'CMCSA', 'CME', 'CMG', 'CMI', 'CMS', 'CNC', 'CNP',
  'COF', 'COO', 'COP', 'COST', 'CPB', 'CPRT', 'CPT', 'CRL', 'CRM', 'CSCO',
  'CSGP', 'CSX', 'CTAS', 'CTLT', 'CTRA', 'CTSH', 'CTVA', 'CVS', 'CVX', 'CZR',
  'D', 'DAL', 'DD', 'DE', 'DFS', 'DG', 'DGX', 'DHI', 'DHR', 'DIS',
  'DISH', 'DLR', 'DLTR', 'DOV', 'DOW', 'DPZ', 'DRI', 'DTE', 'DUK', 'DVA',
  'DVN', 'DXC', 'DXCM', 'EA', 'EBAY', 'ECL', 'ED', 'EFX', 'EIX', 'EL',
  'EMN', 'EMR', 'ENPH', 'EOG', 'EPAM', 'EQIX', 'EQR', 'EQT', 'ES', 'ESS',
  'ETN', 'ETR', 'ETSY', 'EVRG', 'EW', 'EXC', 'EXPD', 'EXPE', 'EXR', 'F',
  'FANG', 'FAST', 'FBHS', 'FCX', 'FDS', 'FDX', 'FE', 'FFIV', 'FIS', 'FISV',
  'FITB', 'FLT', 'FMC', 'FOX', 'FOXA', 'FRC', 'FRT', 'FTNT', 'FTV', 'GD',
  'GE', 'GILD', 'GIS', 'GL', 'GLW', 'GM', 'GNRC', 'GOOG', 'GOOGL', 'GPC',
  'GPN', 'GRMN', 'GS', 'GWW', 'HAL', 'HAS', 'HBAN', 'HCA', 'HD', 'HOLX',
  'HON', 'HPE', 'HPQ', 'HRL', 'HSIC', 'HST', 'HSY', 'HUM', 'HWM', 'IBM',
  'ICE', 'IDXX', 'IEX', 'IFF', 'ILMN', 'INCY', 'INTC', 'INTU', 'INVH', 'IP',
  'IPG', 'IQV', 'IR', 'IRM', 'ISRG', 'IT', 'ITW', 'IVZ', 'J', 'JBHT',
  'JCI', 'JKHY', 'JNJ', 'JNPR', 'JPM', 'K', 'KDP', 'KEY', 'KEYS', 'KHC',
  'KIM', 'KLAC', 'KMB', 'KMI', 'KMX', 'KO', 'KR', 'L', 'LDOS', 'LEN',
  'LH', 'LHX', 'LIN', 'LKQ', 'LLY', 'LMT', 'LNC', 'LNT', 'LOW', 'LRCX',
  'LUMN', 'LUV', 'LVS', 'LW', 'LYB', 'LYV', 'MA', 'MAA', 'MAR', 'MAS',
  'MCD', 'MCHP', 'MCK', 'MCO', 'MDLZ', 'MDT', 'MET', 'META', 'MGM', 'MHK',
  'MKC', 'MKTX', 'MLM', 'MMC', 'MMM', 'MNST', 'MO', 'MOH', 'MOS', 'MPC',
  'MPWR', 'MRK', 'MRNA', 'MRO', 'MS', 'MSCI', 'MSFT', 'MSI', 'MTB', 'MTCH',
  'MTD', 'MU', 'NCLH', 'NDAQ', 'NDSN', 'NEE', 'NEM', 'NFLX', 'NI', 'NKE',
  'NOC', 'NOW', 'NRG', 'NSC', 'NTAP', 'NTRS', 'NUE', 'NVDA', 'NVR', 'NWL',
  'NWS', 'NWSA', 'NXPI', 'O', 'ODFL', 'OGN', 'OKE', 'OMC', 'ON', 'ORCL',
  'ORLY', 'OTIS', 'OXY', 'PARA', 'PAYC', 'PAYX', 'PCAR', 'PCG', 'PEAK', 'PEG',
  'PEP', 'PFE', 'PFG', 'PG', 'PGR', 'PH', 'PHM', 'PKG', 'PKI', 'PLD',
  'PM', 'PNC', 'PNR', 'PNW', 'POOL', 'PPG', 'PPL', 'PRU', 'PSA', 'PSX',
  'PTC', 'PVH', 'PWR', 'PXD', 'PYPL', 'QCOM', 'QRVO', 'RCL', 'RE', 'REG',
  'REGN', 'RF', 'RHI', 'RJF', 'RL', 'RMD', 'ROK', 'ROL', 'ROP', 'ROST',
  'RSG', 'RTX', 'SBAC', 'SBNY', 'SBUX', 'SCHW', 'SEE', 'SHW', 'SIVB', 'SJM',
  'SLB', 'SNA', 'SNPS', 'SO', 'SPG', 'SPGI', 'SRE', 'STE', 'STT', 'STX',
  'STZ', 'SWK', 'SWKS', 'SYF', 'SYK', 'SYY', 'T', 'TAP', 'TDG', 'TDY',
  'TECH', 'TEL', 'TER', 'TFC', 'TFX', 'TGT', 'TJX', 'TMO', 'TMUS', 'TPR',
  'TRGP', 'TRMB', 'TROW', 'TRV', 'TSCO', 'TSLA', 'TSN', 'TT', 'TTWO', 'TXN',
  'TXT', 'TYL', 'UAL', 'UDR', 'UHS', 'ULTA', 'UNH', 'UNP', 'UPS', 'URI',
  'USB', 'V', 'VFC', 'VICI', 'VLO', 'VMC', 'VNO', 'VRSK', 'VRSN', 'VRTX',
  'VTR', 'VTRS', 'VZ', 'WAB', 'WAT', 'WBA', 'WBD', 'WDC', 'WEC', 'WELL',
  'WFC', 'WHR', 'WM', 'WMB', 'WMT', 'WRB', 'WRK', 'WST', 'WTW', 'WY',
  'WYNN', 'XEL', 'XOM', 'XRAY', 'XYL', 'YUM', 'ZBH', 'ZBRA', 'ZION', 'ZTS',
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
