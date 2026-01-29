/**
 * Price Action Agent
 * Analyzes support/resistance levels, breakouts, and price patterns
 * using deterministic heuristics
 */

import type { AgentInput, AgentProposal, OHLCData, PriceActionMetrics, TakeProfitLevel } from '../types';
import { calculateATR } from '../utils/indicators';

const AGENT_NAME = 'PriceAction';

/**
 * Analyze price action and generate a proposal
 */
export function analyzePriceAction(input: AgentInput): AgentProposal {
  const { ohlcData, currentPrice, assetType, config } = input;

  if (ohlcData.length < 20) {
    return createHoldProposal('Insufficient data for price action analysis', {});
  }

  const metrics = calculatePriceActionMetrics(ohlcData, currentPrice);
  const atr = calculateATR(ohlcData, 14);

  // Score each component
  const srScore = scoreSupportResistance(metrics, currentPrice);
  const breakoutScore = scoreBreakout(metrics);
  const candleScore = scoreCandlePatterns(ohlcData);
  const trendScore = metrics.trendStrength;

  // Composite score (-1 to 1)
  const compositeScore =
    srScore * 0.35 + breakoutScore * 0.30 + candleScore * 0.20 + trendScore * 0.15;

  // Determine action and confidence
  const { action, confidence } = determineAction(compositeScore, metrics);

  // Calculate risk management levels
  const stopLossMultiplier = config.riskParams.stopLossAtrMultiplier;
  const maxStopPct =
    assetType === 'crypto'
      ? config.riskParams.stopLossCryptoPct
      : config.riskParams.stopLossStockPct;

  let stopLoss: number | undefined;
  let entryZone: { low: number; high: number } | undefined;
  let takeProfits: TakeProfitLevel[] | undefined;
  let expectedReturn: number | undefined;
  let expectedRisk: number | undefined;

  if (action === 'BUY') {
    // Place stop below nearest support or ATR-based
    const supportBasedStop = metrics.nearestSupport * 0.995;
    const atrBasedStop = currentPrice - atr * stopLossMultiplier;
    const maxStop = currentPrice * (1 - maxStopPct / 100);

    stopLoss = Math.max(supportBasedStop, atrBasedStop, maxStop);

    entryZone = {
      low: Math.max(currentPrice * 0.99, metrics.nearestSupport * 1.005),
      high: currentPrice * 1.005,
    };

    const stopDistance = currentPrice - stopLoss;
    takeProfits = calculateTakeProfits(currentPrice, stopDistance, 'BUY', config.riskParams);

    expectedRisk = (stopDistance / currentPrice) * 100;
    expectedReturn = ((metrics.nearestResistance - currentPrice) / currentPrice) * 100;
  } else if (action === 'SELL') {
    // Place stop above nearest resistance or ATR-based
    const resistanceBasedStop = metrics.nearestResistance * 1.005;
    const atrBasedStop = currentPrice + atr * stopLossMultiplier;
    const maxStop = currentPrice * (1 + maxStopPct / 100);

    stopLoss = Math.min(resistanceBasedStop, atrBasedStop, maxStop);

    entryZone = {
      low: currentPrice * 0.995,
      high: Math.min(currentPrice * 1.01, metrics.nearestResistance * 0.995),
    };

    const stopDistance = stopLoss - currentPrice;
    takeProfits = calculateTakeProfits(currentPrice, stopDistance, 'SELL', config.riskParams);

    expectedRisk = (stopDistance / currentPrice) * 100;
    expectedReturn = ((currentPrice - metrics.nearestSupport) / currentPrice) * 100;
  }

  const rationale = generateRationale(metrics, action, compositeScore);

  return {
    agent: AGENT_NAME,
    action,
    confidence,
    entryZone,
    stopLoss,
    takeProfits,
    expectedReturn,
    expectedRisk,
    rationale,
    metrics: {
      nearestSupport: Math.round(metrics.nearestSupport * 100) / 100,
      nearestResistance: Math.round(metrics.nearestResistance * 100) / 100,
      distanceToSupport: Math.round(metrics.distanceToSupport * 100) / 100,
      distanceToResistance: Math.round(metrics.distanceToResistance * 100) / 100,
      isBreakingOut: metrics.isBreakingOut ? 'yes' : 'no',
      breakoutDirection: metrics.breakoutDirection || 'none',
      trendStrength: Math.round(metrics.trendStrength * 100) / 100,
      lastCandleType: metrics.lastCandleType,
    },
  };
}

/**
 * Calculate price action metrics
 */
function calculatePriceActionMetrics(ohlcData: OHLCData[], currentPrice: number): PriceActionMetrics {
  const lookbackPeriod = Math.min(20, ohlcData.length);
  const recentData = ohlcData.slice(-lookbackPeriod);

  // Find recent highs and lows
  const highs = recentData.map((d) => d.high);
  const lows = recentData.map((d) => d.low);
  const recentHigh = Math.max(...highs);
  const recentLow = Math.min(...lows);

  // Calculate pivot-based support and resistance
  const { support, resistance } = calculatePivotLevels(recentData);

  // Determine nearest levels
  const nearestSupport = support.filter((s) => s < currentPrice).sort((a, b) => b - a)[0] || recentLow;
  const nearestResistance =
    resistance.filter((r) => r > currentPrice).sort((a, b) => a - b)[0] || recentHigh;

  const distanceToSupport = ((currentPrice - nearestSupport) / currentPrice) * 100;
  const distanceToResistance = ((nearestResistance - currentPrice) / currentPrice) * 100;

  // Check for breakout
  const { isBreakingOut, breakoutDirection } = detectBreakout(ohlcData, currentPrice, recentHigh, recentLow);

  // Analyze last candle
  const lastCandle = ohlcData[ohlcData.length - 1];
  const lastCandleType = classifyCandle(lastCandle);

  // Calculate trend strength
  const trendStrength = calculateTrendStrength(ohlcData);

  return {
    nearestSupport,
    nearestResistance,
    distanceToSupport,
    distanceToResistance,
    recentHigh,
    recentLow,
    isBreakingOut,
    breakoutDirection,
    lastCandleType,
    trendStrength,
  };
}

/**
 * Calculate pivot-based support and resistance levels
 */
function calculatePivotLevels(data: OHLCData[]): { support: number[]; resistance: number[] } {
  const support: number[] = [];
  const resistance: number[] = [];

  // Find swing highs and lows
  for (let i = 2; i < data.length - 2; i++) {
    const current = data[i];
    const prev1 = data[i - 1];
    const prev2 = data[i - 2];
    const next1 = data[i + 1];
    const next2 = data[i + 2];

    // Swing high (potential resistance)
    if (
      current.high > prev1.high &&
      current.high > prev2.high &&
      current.high > next1.high &&
      current.high > next2.high
    ) {
      resistance.push(current.high);
    }

    // Swing low (potential support)
    if (
      current.low < prev1.low &&
      current.low < prev2.low &&
      current.low < next1.low &&
      current.low < next2.low
    ) {
      support.push(current.low);
    }
  }

  return { support, resistance };
}

/**
 * Detect if price is breaking out
 */
function detectBreakout(
  data: OHLCData[],
  currentPrice: number,
  recentHigh: number,
  recentLow: number
): { isBreakingOut: boolean; breakoutDirection?: 'up' | 'down' } {
  const threshold = 0.005; // 0.5% threshold for breakout confirmation

  // Check for upside breakout
  if (currentPrice > recentHigh * (1 - threshold)) {
    const lastCandle = data[data.length - 1];
    if (lastCandle.close > lastCandle.open && lastCandle.close >= recentHigh * 0.99) {
      return { isBreakingOut: true, breakoutDirection: 'up' };
    }
  }

  // Check for downside breakout
  if (currentPrice < recentLow * (1 + threshold)) {
    const lastCandle = data[data.length - 1];
    if (lastCandle.close < lastCandle.open && lastCandle.close <= recentLow * 1.01) {
      return { isBreakingOut: true, breakoutDirection: 'down' };
    }
  }

  return { isBreakingOut: false };
}

/**
 * Classify a candle as bullish, bearish, or doji
 */
function classifyCandle(candle: OHLCData): 'bullish' | 'bearish' | 'doji' {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;

  if (range === 0) return 'doji';

  const bodyRatio = body / range;

  if (bodyRatio < 0.1) return 'doji';
  if (candle.close > candle.open) return 'bullish';
  return 'bearish';
}

/**
 * Calculate trend strength (-1 to 1)
 */
function calculateTrendStrength(data: OHLCData[]): number {
  if (data.length < 5) return 0;

  const recentData = data.slice(-10);
  let higherHighs = 0;
  let lowerLows = 0;

  for (let i = 1; i < recentData.length; i++) {
    if (recentData[i].high > recentData[i - 1].high) higherHighs++;
    if (recentData[i].low < recentData[i - 1].low) lowerLows++;
  }

  const bullishScore = higherHighs / (recentData.length - 1);
  const bearishScore = lowerLows / (recentData.length - 1);

  return bullishScore - bearishScore;
}

/**
 * Score support/resistance position (-1 to 1)
 */
function scoreSupportResistance(metrics: PriceActionMetrics, currentPrice: number): number {
  const { distanceToSupport, distanceToResistance } = metrics;

  // Near support = bullish, near resistance = bearish
  if (distanceToSupport < 1) return 0.7; // Within 1% of support
  if (distanceToSupport < 2) return 0.4;
  if (distanceToResistance < 1) return -0.7; // Within 1% of resistance
  if (distanceToResistance < 2) return -0.4;

  // Middle of range
  const range = distanceToSupport + distanceToResistance;
  const position = distanceToSupport / range;

  // Lower half favors buy, upper half favors sell
  return (0.5 - position) * 0.6;
}

/**
 * Score breakout signal (-1 to 1)
 */
function scoreBreakout(metrics: PriceActionMetrics): number {
  if (!metrics.isBreakingOut) return 0;

  if (metrics.breakoutDirection === 'up') return 0.8;
  if (metrics.breakoutDirection === 'down') return -0.8;

  return 0;
}

/**
 * Score candle patterns (-1 to 1)
 */
function scoreCandlePatterns(data: OHLCData[]): number {
  if (data.length < 3) return 0;

  const lastThree = data.slice(-3);
  const last = lastThree[2];
  const prev = lastThree[1];

  let score = 0;

  // Bullish engulfing
  if (
    prev.close < prev.open &&
    last.close > last.open &&
    last.close > prev.open &&
    last.open < prev.close
  ) {
    score += 0.6;
  }

  // Bearish engulfing
  if (
    prev.close > prev.open &&
    last.close < last.open &&
    last.close < prev.open &&
    last.open > prev.close
  ) {
    score -= 0.6;
  }

  // Strong bullish candle
  if (last.close > last.open) {
    const body = last.close - last.open;
    const range = last.high - last.low;
    if (range > 0 && body / range > 0.7) score += 0.3;
  }

  // Strong bearish candle
  if (last.close < last.open) {
    const body = last.open - last.close;
    const range = last.high - last.low;
    if (range > 0 && body / range > 0.7) score -= 0.3;
  }

  return Math.max(-1, Math.min(1, score));
}

/**
 * Determine action and confidence
 */
function determineAction(
  compositeScore: number,
  metrics: PriceActionMetrics
): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number } {
  const absScore = Math.abs(compositeScore);

  // Boost confidence for breakouts
  let confidenceBoost = 0;
  if (metrics.isBreakingOut) confidenceBoost = 0.15;

  if (absScore < 0.12) {
    return { action: 'HOLD', confidence: 0.5 + absScore };
  }

  const confidence = Math.min(0.95, 0.5 + absScore * 0.45 + confidenceBoost);

  if (compositeScore > 0.12) {
    return { action: 'BUY', confidence };
  } else if (compositeScore < -0.12) {
    return { action: 'SELL', confidence };
  }

  return { action: 'HOLD', confidence: 0.5 };
}

/**
 * Calculate take profit levels
 */
function calculateTakeProfits(
  entryPrice: number,
  stopDistance: number,
  side: 'BUY' | 'SELL',
  riskParams: {
    tp1Pct: number;
    tp2Pct: number;
    runnerPct: number;
    trailingAtrMultiplier: number;
  }
): TakeProfitLevel[] {
  const r1 = stopDistance;
  const r2 = stopDistance * 2;

  if (side === 'BUY') {
    return [
      { price: entryPrice + r1, percentage: riskParams.tp1Pct, type: 'fixed' },
      { price: entryPrice + r2, percentage: riskParams.tp2Pct, type: 'fixed' },
      {
        price: entryPrice + r2,
        percentage: riskParams.runnerPct,
        type: 'trailing',
        trailingAtr: riskParams.trailingAtrMultiplier,
      },
    ];
  } else {
    return [
      { price: entryPrice - r1, percentage: riskParams.tp1Pct, type: 'fixed' },
      { price: entryPrice - r2, percentage: riskParams.tp2Pct, type: 'fixed' },
      {
        price: entryPrice - r2,
        percentage: riskParams.runnerPct,
        type: 'trailing',
        trailingAtr: riskParams.trailingAtrMultiplier,
      },
    ];
  }
}

/**
 * Generate rationale
 */
function generateRationale(
  metrics: PriceActionMetrics,
  action: 'BUY' | 'SELL' | 'HOLD',
  compositeScore: number
): string {
  const parts: string[] = [];

  // Support/Resistance context
  parts.push(
    `Price is ${metrics.distanceToSupport.toFixed(1)}% above support (${metrics.nearestSupport.toFixed(2)}) and ${metrics.distanceToResistance.toFixed(1)}% below resistance (${metrics.nearestResistance.toFixed(2)}).`
  );

  // Breakout status
  if (metrics.isBreakingOut) {
    parts.push(`Potential ${metrics.breakoutDirection}side breakout detected.`);
  }

  // Candle type
  parts.push(`Last candle: ${metrics.lastCandleType}.`);

  // Trend
  if (metrics.trendStrength > 0.3) {
    parts.push('Higher highs and higher lows suggest bullish momentum.');
  } else if (metrics.trendStrength < -0.3) {
    parts.push('Lower highs and lower lows suggest bearish momentum.');
  } else {
    parts.push('Price action shows consolidation.');
  }

  return parts.join(' ');
}

/**
 * Create a HOLD proposal
 */
function createHoldProposal(
  rationale: string,
  metrics: Record<string, number | string>
): AgentProposal {
  return {
    agent: AGENT_NAME,
    action: 'HOLD',
    confidence: 0.5,
    rationale,
    metrics,
  };
}
