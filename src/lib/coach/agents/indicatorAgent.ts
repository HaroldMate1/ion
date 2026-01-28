/**
 * Indicator Agent
 * Analyzes technical indicators (RSI, MACD, Moving Averages, Bollinger, ATR)
 * to generate trading signals
 */

import type { AgentInput, AgentProposal, TakeProfitLevel } from '../types';
import {
  calculateIndicatorMetrics,
  calculateATR,
  detectTrend,
} from '../utils/indicators';

const AGENT_NAME = 'Indicator';

/**
 * Analyze technical indicators and generate a proposal
 */
export function analyzeIndicators(input: AgentInput): AgentProposal {
  const { ohlcData, currentPrice, assetType, config } = input;

  if (ohlcData.length < 26) {
    return createHoldProposal('Insufficient data for indicator analysis', {});
  }

  const metrics = calculateIndicatorMetrics(ohlcData);
  const atr = calculateATR(ohlcData, 14);
  const trend = detectTrend(metrics, currentPrice);

  // Score each indicator
  const rsiScore = scoreRSI(metrics.rsi14);
  const macdScore = scoreMACD(metrics.macd, metrics.macdSignal, metrics.macdHistogram);
  const maScore = scoreMovingAverages(metrics, currentPrice);
  const bollingerScore = scoreBollinger(currentPrice, metrics);

  // Weighted composite score (-1 to 1, negative = bearish, positive = bullish)
  const compositeScore =
    rsiScore * 0.25 + macdScore * 0.30 + maScore * 0.30 + bollingerScore * 0.15;

  // Determine action and confidence
  const { action, confidence } = determineAction(compositeScore, trend);

  // Calculate entry, stop loss, and take profits
  const stopLossMultiplier = config.riskParams.stopLossAtrMultiplier;
  const maxStopPct =
    assetType === 'crypto'
      ? config.riskParams.stopLossCryptoPct
      : config.riskParams.stopLossStockPct;

  const atrStopDistance = atr * stopLossMultiplier;
  const maxStopDistance = currentPrice * (maxStopPct / 100);
  const stopDistance = Math.min(atrStopDistance, maxStopDistance);

  let stopLoss: number | undefined;
  let entryZone: { low: number; high: number } | undefined;
  let takeProfits: TakeProfitLevel[] | undefined;
  let expectedReturn: number | undefined;
  let expectedRisk: number | undefined;

  if (action === 'BUY') {
    stopLoss = currentPrice - stopDistance;
    entryZone = {
      low: currentPrice * 0.995,
      high: currentPrice * 1.005,
    };
    takeProfits = calculateTakeProfits(
      currentPrice,
      stopDistance,
      'BUY',
      config.riskParams
    );
    expectedRisk = (stopDistance / currentPrice) * 100;
    expectedReturn = expectedRisk * 2; // Target 2R
  } else if (action === 'SELL') {
    stopLoss = currentPrice + stopDistance;
    entryZone = {
      low: currentPrice * 0.995,
      high: currentPrice * 1.005,
    };
    takeProfits = calculateTakeProfits(
      currentPrice,
      stopDistance,
      'SELL',
      config.riskParams
    );
    expectedRisk = (stopDistance / currentPrice) * 100;
    expectedReturn = expectedRisk * 2;
  }

  const rationale = generateRationale(metrics, trend, action, rsiScore, macdScore, maScore);

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
      rsi14: Math.round(metrics.rsi14 * 100) / 100,
      macd: Math.round(metrics.macd * 1000) / 1000,
      macdSignal: Math.round(metrics.macdSignal * 1000) / 1000,
      sma20: Math.round(metrics.sma20 * 100) / 100,
      sma50: Math.round(metrics.sma50 * 100) / 100,
      atr14: Math.round(atr * 100) / 100,
      trend,
      compositeScore: Math.round(compositeScore * 100) / 100,
    },
  };
}

/**
 * Score RSI signal (-1 to 1)
 */
function scoreRSI(rsi: number): number {
  if (rsi <= 30) return 0.8; // Oversold - bullish
  if (rsi <= 40) return 0.4;
  if (rsi >= 70) return -0.8; // Overbought - bearish
  if (rsi >= 60) return -0.4;
  return 0; // Neutral
}

/**
 * Score MACD signal (-1 to 1)
 */
function scoreMACD(macd: number, signal: number, histogram: number): number {
  let score = 0;

  // MACD vs Signal line
  if (macd > signal) score += 0.4;
  else if (macd < signal) score -= 0.4;

  // Histogram direction
  if (histogram > 0) score += 0.3;
  else if (histogram < 0) score -= 0.3;

  // Histogram momentum (increasing or decreasing)
  // Simplified: just use sign and magnitude
  const histMagnitude = Math.abs(histogram);
  if (histogram > 0 && histMagnitude > 0.01) score += 0.3;
  else if (histogram < 0 && histMagnitude > 0.01) score -= 0.3;

  return Math.max(-1, Math.min(1, score));
}

/**
 * Score moving average relationships (-1 to 1)
 */
function scoreMovingAverages(
  metrics: ReturnType<typeof calculateIndicatorMetrics>,
  currentPrice: number
): number {
  let score = 0;

  // Price vs SMA20
  if (currentPrice > metrics.sma20) score += 0.25;
  else score -= 0.25;

  // Price vs SMA50
  if (currentPrice > metrics.sma50) score += 0.25;
  else score -= 0.25;

  // SMA20 vs SMA50 (golden/death cross area)
  if (metrics.sma20 > metrics.sma50) score += 0.25;
  else score -= 0.25;

  // Trend strength (distance from MA)
  const distanceFromSma20 = Math.abs(metrics.priceVsSma20);
  if (distanceFromSma20 > 2) {
    // Strong trend
    score += metrics.priceVsSma20 > 0 ? 0.25 : -0.25;
  }

  return Math.max(-1, Math.min(1, score));
}

/**
 * Score Bollinger Band position (-1 to 1)
 */
function scoreBollinger(
  currentPrice: number,
  metrics: ReturnType<typeof calculateIndicatorMetrics>
): number {
  const { bollingerUpper, bollingerLower, bollingerMiddle } = metrics;
  const range = bollingerUpper - bollingerLower;

  if (range === 0) return 0;

  const position = (currentPrice - bollingerLower) / range;

  // Near lower band = potential buy (oversold)
  if (position < 0.2) return 0.6;
  if (position < 0.35) return 0.3;

  // Near upper band = potential sell (overbought)
  if (position > 0.8) return -0.6;
  if (position > 0.65) return -0.3;

  return 0; // Middle of bands
}

/**
 * Determine action and confidence from composite score
 */
function determineAction(
  compositeScore: number,
  trend: 'bullish' | 'bearish' | 'neutral'
): { action: 'BUY' | 'SELL' | 'HOLD'; confidence: number } {
  const absScore = Math.abs(compositeScore);

  // Strong signal threshold
  if (absScore < 0.3) {
    return { action: 'HOLD', confidence: 0.5 + absScore };
  }

  // Check if score aligns with trend
  const trendAlignment =
    (compositeScore > 0 && trend === 'bullish') ||
    (compositeScore < 0 && trend === 'bearish');

  // Boost confidence if aligned with trend
  let confidence = 0.5 + absScore * 0.5;
  if (trendAlignment) confidence = Math.min(0.95, confidence + 0.1);
  if (!trendAlignment && trend !== 'neutral') confidence = Math.max(0.4, confidence - 0.15);

  if (compositeScore > 0.3) {
    return { action: 'BUY', confidence };
  } else if (compositeScore < -0.3) {
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
  const r1 = stopDistance; // 1R
  const r2 = stopDistance * 2; // 2R

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
 * Generate human-readable rationale
 */
function generateRationale(
  metrics: ReturnType<typeof calculateIndicatorMetrics>,
  trend: 'bullish' | 'bearish' | 'neutral',
  action: 'BUY' | 'SELL' | 'HOLD',
  rsiScore: number,
  macdScore: number,
  maScore: number
): string {
  const parts: string[] = [];

  // Trend summary
  parts.push(`Overall trend: ${trend}.`);

  // RSI
  if (metrics.rsi14 <= 30) {
    parts.push(`RSI oversold (${metrics.rsi14.toFixed(1)}), suggesting potential reversal.`);
  } else if (metrics.rsi14 >= 70) {
    parts.push(`RSI overbought (${metrics.rsi14.toFixed(1)}), suggesting potential pullback.`);
  } else {
    parts.push(`RSI neutral (${metrics.rsi14.toFixed(1)}).`);
  }

  // MACD
  if (metrics.macd > metrics.macdSignal && metrics.macdHistogram > 0) {
    parts.push('MACD bullish with positive momentum.');
  } else if (metrics.macd < metrics.macdSignal && metrics.macdHistogram < 0) {
    parts.push('MACD bearish with negative momentum.');
  } else {
    parts.push('MACD showing mixed signals.');
  }

  // Moving averages
  if (maScore > 0.5) {
    parts.push('Price above key moving averages, indicating strength.');
  } else if (maScore < -0.5) {
    parts.push('Price below key moving averages, indicating weakness.');
  }

  return parts.join(' ');
}

/**
 * Create a HOLD proposal with given rationale
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
