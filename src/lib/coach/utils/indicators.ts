/**
 * Technical Indicator Calculations
 * Pure functions for computing technical indicators
 */

import type { OHLCData, IndicatorMetrics } from '../types';

/**
 * Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

/**
 * Exponential Moving Average
 */
export function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  if (data.length < period) return calculateSMA(data, data.length);

  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);

  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50; // Neutral

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter((c) => c > 0);
  const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Moving Average Convergence Divergence (MACD)
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(closes, fastPeriod);
  const ema26 = calculateEMA(closes, slowPeriod);
  const macd = ema12 - ema26;

  // Calculate MACD line history for signal
  const macdHistory: number[] = [];
  for (let i = slowPeriod; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    const e12 = calculateEMA(slice, fastPeriod);
    const e26 = calculateEMA(slice, slowPeriod);
    macdHistory.push(e12 - e26);
  }

  const signal = calculateEMA(macdHistory, signalPeriod);
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

/**
 * Average True Range (ATR)
 */
export function calculateATR(ohlc: OHLCData[], period: number = 14): number {
  if (ohlc.length < 2) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < ohlc.length; i++) {
    const high = ohlc[i].high;
    const low = ohlc[i].low;
    const prevClose = ohlc[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  return calculateSMA(trueRanges.slice(-period), period);
}

/**
 * Bollinger Bands
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: number; middle: number; lower: number; width: number } {
  const middle = calculateSMA(closes, period);
  const slice = closes.slice(-period);

  // Calculate standard deviation
  const variance =
    slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const std = Math.sqrt(variance);

  const upper = middle + stdDev * std;
  const lower = middle - stdDev * std;
  const width = (upper - lower) / middle;

  return { upper, middle, lower, width };
}

/**
 * Calculate all indicator metrics for analysis
 */
export function calculateIndicatorMetrics(ohlc: OHLCData[]): IndicatorMetrics {
  const closes = ohlc.map((d) => d.close);
  const currentPrice = closes[closes.length - 1] || 0;

  // Moving averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, Math.min(200, closes.length));
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  // Momentum
  const rsi14 = calculateRSI(closes, 14);
  const { macd, signal: macdSignal, histogram: macdHistogram } = calculateMACD(closes);

  // Volatility
  const atr14 = calculateATR(ohlc, 14);
  const { upper: bollingerUpper, middle: bollingerMiddle, lower: bollingerLower, width: bollingerWidth } =
    calculateBollingerBands(closes);

  // Price position relative to MAs
  const priceVsSma20 = sma20 > 0 ? ((currentPrice - sma20) / sma20) * 100 : 0;
  const priceVsSma50 = sma50 > 0 ? ((currentPrice - sma50) / sma50) * 100 : 0;
  const priceVsSma200 = sma200 > 0 ? ((currentPrice - sma200) / sma200) * 100 : 0;

  return {
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    rsi14,
    macd,
    macdSignal,
    macdHistogram,
    atr14,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower,
    bollingerWidth,
    priceVsSma20,
    priceVsSma50,
    priceVsSma200,
  };
}

/**
 * Detect trend direction
 */
export function detectTrend(
  metrics: IndicatorMetrics,
  currentPrice: number
): 'bullish' | 'bearish' | 'neutral' {
  let bullishSignals = 0;
  let bearishSignals = 0;

  // Price vs moving averages
  if (currentPrice > metrics.sma20) bullishSignals++;
  else bearishSignals++;

  if (currentPrice > metrics.sma50) bullishSignals++;
  else bearishSignals++;

  if (metrics.sma20 > metrics.sma50) bullishSignals++;
  else bearishSignals++;

  // MACD
  if (metrics.macd > metrics.macdSignal) bullishSignals++;
  else bearishSignals++;

  // RSI zones
  if (metrics.rsi14 > 50) bullishSignals++;
  else if (metrics.rsi14 < 50) bearishSignals++;

  if (bullishSignals >= 4) return 'bullish';
  if (bearishSignals >= 4) return 'bearish';
  return 'neutral';
}
