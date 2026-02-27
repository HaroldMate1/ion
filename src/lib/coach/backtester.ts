/**
 * Backtesting Engine for Agent Weight Optimization
 *
 * Strategy:
 * 1. Fetch historical OHLC data for selected symbols
 * 2. For each day (with enough lookback), run indicator + priceAction agents
 * 3. Collect all daily agent proposals (run once, reuse for many weight combos)
 * 4. Grid-search weight combinations on the Nash consensus
 * 5. Simulate trades for each weight combo and rank by risk-adjusted return
 *
 * This is purely deterministic — no LLM calls needed.
 */

import { analyzeIndicators } from './agents/indicatorAgent';
import { analyzePriceAction } from './agents/priceActionAgent';
import { computeConsensus } from './consensus/nashConsensus';
import { calculateATR } from './utils/indicators';
import type { AgentInput, AgentProposal, CoachConfig, OHLCData } from './types';
import { DEFAULT_COACH_CONFIG } from './types';
import type { AssetType, Market } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface BacktestConfig {
  symbols: Array<{ symbol: string; assetType: AssetType; market: Market }>;
  lookbackDays: number;        // Total historical days to fetch (e.g., 180)
  warmupBars: number;          // Bars needed before we can generate signals (e.g., 50)
  weightStep: number;          // Grid step for weight search (e.g., 0.05 = 5%)
  initialCapital: number;      // Starting capital for simulation
  positionSizePct: number;     // % of capital per trade
  stopLossPct: number;         // Stop loss %
  takeProfitPct: number;       // Take profit %
}

export interface DailyProposal {
  date: number;
  price: number;
  indicatorProposal: AgentProposal;
  priceActionProposal: AgentProposal;
  atr: number;
}

export interface WeightCombo {
  indicator: number;
  priceAction: number;
  news: number;
}

export interface SimulatedTrade {
  entryDate: number;
  exitDate: number;
  entryPrice: number;
  exitPrice: number;
  side: 'BUY' | 'SELL';
  pnlPct: number;
  exitReason: 'tp' | 'sl' | 'signal_change' | 'end';
}

export interface WeightResult {
  weights: WeightCombo;
  totalReturn: number;
  totalReturnPct: number;
  trades: number;
  wins: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  equityCurve: Array<{ date: number; equity: number }>;
}

export interface BacktestResult {
  symbol: string;
  assetType: AssetType;
  totalBars: number;
  signalBars: number;
  bestWeights: WeightResult;
  defaultWeights: WeightResult;
  improvement: number;        // % improvement over default
  allResults: WeightResult[];  // Top 10 weight combos
  dailyProposals: DailyProposal[];
}

export interface FullBacktestResult {
  results: BacktestResult[];
  aggregatedBest: WeightCombo;
  aggregatedDefaultReturn: number;
  aggregatedBestReturn: number;
  improvementPct: number;
  timestamp: string;
}

// ============================================================================
// Core Engine
// ============================================================================

const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  symbols: [],
  lookbackDays: 180,
  warmupBars: 50,
  weightStep: 0.05,
  initialCapital: 100000,
  positionSizePct: 10,
  stopLossPct: 3,
  takeProfitPct: 6,
};

/**
 * Generate all valid weight combinations where weights sum to 1.0
 * Since news agent can't run historically, we allow news weight 0-0.2 max
 */
function generateWeightGrid(step: number): WeightCombo[] {
  const combos: WeightCombo[] = [];
  const precision = 100; // Work in integers to avoid float precision issues

  const stepInt = Math.round(step * precision);

  for (let ind = 0; ind <= precision; ind += stepInt) {
    for (let pa = 0; pa <= precision - ind; pa += stepInt) {
      const news = precision - ind - pa;
      // Limit news weight to 20% max (since we can't backtest it historically)
      if (news <= 20) {
        combos.push({
          indicator: ind / precision,
          priceAction: pa / precision,
          news: news / precision,
        });
      }
    }
  }

  return combos;
}

/**
 * Step 1: Collect agent proposals for each day in the history
 * This is the expensive step — we run it once and reuse for all weight combos
 */
function collectDailyProposals(
  ohlcData: OHLCData[],
  symbol: string,
  assetType: AssetType,
  market: Market,
  warmupBars: number
): DailyProposal[] {
  const proposals: DailyProposal[] = [];

  // We need at least warmupBars of history before generating signals
  for (let i = warmupBars; i < ohlcData.length; i++) {
    const historySlice = ohlcData.slice(0, i + 1);
    const currentPrice = ohlcData[i].close;

    const agentInput: AgentInput = {
      symbol,
      assetType,
      market,
      currentPrice,
      ohlcData: historySlice,
      config: { ...DEFAULT_COACH_CONFIG, userId: 'backtest' },
    };

    try {
      const indicatorProposal = analyzeIndicators(agentInput);
      const priceActionProposal = analyzePriceAction(agentInput);
      const atr = calculateATR(historySlice);

      proposals.push({
        date: ohlcData[i].timestamp,
        price: currentPrice,
        indicatorProposal,
        priceActionProposal,
        atr,
      });
    } catch (err) {
      // Skip days where agents fail (insufficient data, etc.)
      continue;
    }
  }

  return proposals;
}

/**
 * Create a neutral news proposal (since we can't backtest news historically)
 */
function neutralNewsProposal(): AgentProposal {
  return {
    agent: 'news',
    action: 'HOLD',
    confidence: 0.5,
    rationale: 'Historical backtest — no news data available',
    expectedReturn: 0,
    expectedRisk: 0,
  };
}

/**
 * Step 2: Simulate trades for a given weight combination
 */
function simulateWithWeights(
  proposals: DailyProposal[],
  weights: WeightCombo,
  config: BacktestConfig
): WeightResult {
  const simConfig: CoachConfig = {
    ...DEFAULT_COACH_CONFIG,
    userId: 'backtest',
    weights: {
      indicator: weights.indicator,
      priceAction: weights.priceAction,
      news: weights.news,
    },
  };

  let cash = config.initialCapital;
  let position: {
    side: 'BUY' | 'SELL';
    entryPrice: number;
    entryDate: number;
    size: number;
    stopLoss: number;
    takeProfit: number;
  } | null = null;

  const trades: SimulatedTrade[] = [];
  const equityCurve: Array<{ date: number; equity: number }> = [];
  let peakEquity = config.initialCapital;
  let maxDrawdown = 0;

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];

    // Run Nash consensus with these weights
    const allProposals: AgentProposal[] = [
      p.indicatorProposal,
      p.priceActionProposal,
      neutralNewsProposal(),
    ];

    const consensus = computeConsensus(allProposals, simConfig);

    // Check stop loss / take profit on existing position
    if (position) {
      let shouldClose = false;
      let exitReason: SimulatedTrade['exitReason'] = 'signal_change';

      if (position.side === 'BUY') {
        if (p.price <= position.stopLoss) {
          shouldClose = true;
          exitReason = 'sl';
        } else if (p.price >= position.takeProfit) {
          shouldClose = true;
          exitReason = 'tp';
        }
      } else {
        if (p.price >= position.stopLoss) {
          shouldClose = true;
          exitReason = 'sl';
        } else if (p.price <= position.takeProfit) {
          shouldClose = true;
          exitReason = 'tp';
        }
      }

      // Close if opposite signal
      if (!shouldClose && consensus.action !== 'HOLD' && consensus.action !== position.side) {
        shouldClose = true;
        exitReason = 'signal_change';
      }

      if (shouldClose) {
        const pnl = position.side === 'BUY'
          ? (p.price - position.entryPrice) / position.entryPrice
          : (position.entryPrice - p.price) / position.entryPrice;

        cash += position.size * (1 + pnl);
        trades.push({
          entryDate: position.entryDate,
          exitDate: p.date,
          entryPrice: position.entryPrice,
          exitPrice: p.price,
          side: position.side,
          pnlPct: pnl * 100,
          exitReason,
        });
        position = null;
      }
    }

    // Open new position if consensus is actionable and no current position
    if (!position && consensus.action !== 'HOLD' && consensus.confidence >= 0.4) {
      const positionSize = cash * (config.positionSizePct / 100);
      if (positionSize >= 100) {
        const stopDist = p.price * (config.stopLossPct / 100);
        const tpDist = p.price * (config.takeProfitPct / 100);

        position = {
          side: consensus.action,
          entryPrice: p.price,
          entryDate: p.date,
          size: positionSize,
          stopLoss: consensus.action === 'BUY'
            ? p.price - stopDist
            : p.price + stopDist,
          takeProfit: consensus.action === 'BUY'
            ? p.price + tpDist
            : p.price - tpDist,
        };
        cash -= positionSize;
      }
    }

    // Track equity
    const positionValue = position
      ? position.size * (1 + (position.side === 'BUY'
          ? (p.price - position.entryPrice) / position.entryPrice
          : (position.entryPrice - p.price) / position.entryPrice))
      : 0;
    const equity = cash + positionValue;

    equityCurve.push({ date: p.date, equity });

    // Track drawdown
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Close any open position at end
  if (position && proposals.length > 0) {
    const lastPrice = proposals[proposals.length - 1].price;
    const pnl = position.side === 'BUY'
      ? (lastPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - lastPrice) / position.entryPrice;

    cash += position.size * (1 + pnl);
    trades.push({
      entryDate: position.entryDate,
      exitDate: proposals[proposals.length - 1].date,
      entryPrice: position.entryPrice,
      exitPrice: lastPrice,
      side: position.side,
      pnlPct: pnl * 100,
      exitReason: 'end',
    });
  }

  // Calculate metrics
  const finalEquity = cash;
  const totalReturnPct = ((finalEquity - config.initialCapital) / config.initialCapital) * 100;
  const wins = trades.filter(t => t.pnlPct > 0).length;
  const losses = trades.filter(t => t.pnlPct <= 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const avgReturn = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length
    : 0;

  // Sharpe ratio (annualized, assuming daily)
  const returns = trades.map(t => t.pnlPct / 100);
  const meanReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  // Profit factor
  const grossProfit = trades.filter(t => t.pnlPct > 0).reduce((s, t) => s + t.pnlPct, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnlPct <= 0).reduce((s, t) => s + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    weights,
    totalReturn: finalEquity - config.initialCapital,
    totalReturnPct,
    trades: trades.length,
    wins,
    winRate,
    avgReturn,
    maxDrawdown,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    equityCurve,
  };
}

/**
 * Main backtest function for a single symbol
 */
export function backtestSymbol(
  ohlcData: OHLCData[],
  symbol: string,
  assetType: AssetType,
  market: Market,
  config: Partial<BacktestConfig> = {}
): BacktestResult {
  const fullConfig = { ...DEFAULT_BACKTEST_CONFIG, ...config };

  // Step 1: Collect all daily agent proposals (expensive, do once)
  const dailyProposals = collectDailyProposals(
    ohlcData, symbol, assetType, market, fullConfig.warmupBars
  );

  if (dailyProposals.length < 5) {
    throw new Error(`Insufficient data for ${symbol}: only ${dailyProposals.length} signal days`);
  }

  // Step 2: Generate weight grid
  const weightGrid = generateWeightGrid(fullConfig.weightStep);

  // Step 3: Test all weight combinations (fast — only consensus + simulation)
  const results: WeightResult[] = weightGrid.map(weights =>
    simulateWithWeights(dailyProposals, weights, fullConfig)
  );

  // Step 4: Sort by risk-adjusted metric (Sharpe ratio first, then total return)
  results.sort((a, b) => {
    // Primary: Sharpe ratio (higher is better)
    // Secondary: total return (higher is better)
    const sharpeCompare = b.sharpeRatio - a.sharpeRatio;
    if (Math.abs(sharpeCompare) > 0.1) return sharpeCompare;
    return b.totalReturnPct - a.totalReturnPct;
  });

  // Find default weights result
  const defaultWeights: WeightCombo = {
    indicator: DEFAULT_COACH_CONFIG.weights.indicator,
    priceAction: DEFAULT_COACH_CONFIG.weights.priceAction,
    news: DEFAULT_COACH_CONFIG.weights.news,
  };
  const defaultResult = simulateWithWeights(dailyProposals, defaultWeights, fullConfig);

  const bestResult = results[0];
  const improvement = defaultResult.totalReturnPct !== 0
    ? bestResult.totalReturnPct - defaultResult.totalReturnPct
    : bestResult.totalReturnPct;

  return {
    symbol,
    assetType,
    totalBars: ohlcData.length,
    signalBars: dailyProposals.length,
    bestWeights: bestResult,
    defaultWeights: defaultResult,
    improvement,
    allResults: results.slice(0, 10), // Top 10
    dailyProposals,
  };
}

/**
 * Run full backtest across multiple symbols and aggregate optimal weights
 */
export function aggregateResults(results: BacktestResult[]): FullBacktestResult {
  if (results.length === 0) {
    return {
      results: [],
      aggregatedBest: { indicator: 0.45, priceAction: 0.45, news: 0.10 },
      aggregatedDefaultReturn: 0,
      aggregatedBestReturn: 0,
      improvementPct: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Weight each symbol's optimal weights by its Sharpe ratio (better-performing symbols get more say)
  let totalWeight = 0;
  let avgIndicator = 0;
  let avgPriceAction = 0;
  let avgNews = 0;

  for (const r of results) {
    const w = Math.max(r.bestWeights.sharpeRatio, 0.01); // Avoid zero-weight
    avgIndicator += r.bestWeights.weights.indicator * w;
    avgPriceAction += r.bestWeights.weights.priceAction * w;
    avgNews += r.bestWeights.weights.news * w;
    totalWeight += w;
  }

  // Normalize to sum to 1.0
  avgIndicator /= totalWeight;
  avgPriceAction /= totalWeight;
  avgNews /= totalWeight;

  // Snap to nearest 5%
  const snap = (v: number) => Math.round(v * 20) / 20;
  let si = snap(avgIndicator);
  let sp = snap(avgPriceAction);
  let sn = snap(avgNews);
  const total = si + sp + sn;
  if (total !== 1.0) {
    // Adjust the largest to make it sum to 1
    const diff = 1.0 - total;
    if (si >= sp && si >= sn) si += diff;
    else if (sp >= si && sp >= sn) sp += diff;
    else sn += diff;
  }

  const aggregatedDefaultReturn = results.reduce((s, r) => s + r.defaultWeights.totalReturnPct, 0) / results.length;
  const aggregatedBestReturn = results.reduce((s, r) => s + r.bestWeights.totalReturnPct, 0) / results.length;

  return {
    results,
    aggregatedBest: {
      indicator: Math.round(si * 100) / 100,
      priceAction: Math.round(sp * 100) / 100,
      news: Math.round(sn * 100) / 100,
    },
    aggregatedDefaultReturn: Math.round(aggregatedDefaultReturn * 100) / 100,
    aggregatedBestReturn: Math.round(aggregatedBestReturn * 100) / 100,
    improvementPct: Math.round((aggregatedBestReturn - aggregatedDefaultReturn) * 100) / 100,
    timestamp: new Date().toISOString(),
  };
}
