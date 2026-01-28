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
    indicator: 0.40,
    priceAction: 0.35,
    news: 0.25,
  },
  minConfidence: 0.60,
  minConsensusScore: 0.55,
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
  watchSymbols: [],
  runCadenceMinutes: 0,
};

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
