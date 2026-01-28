/**
 * Risk Engine
 * Enforces position sizing, circuit breakers, and risk management rules.
 *
 * Rules enforced:
 * 1. Max allocation per trade (% of portfolio)
 * 2. Max open positions
 * 3. Daily drawdown limit (circuit breaker)
 * 4. Consecutive losses circuit breaker
 * 5. ATR-based stop loss
 * 6. Partial take profits (TP1 at 1R, TP2 at 2R, runner)
 * 7. Trailing stop after TP1
 */

import type {
  ConsensusResult,
  CoachConfig,
  CoachSignal,
  TakeProfitLevel,
  RiskAssessment,
} from '../types';

interface PortfolioState {
  totalValue: number;
  availableCash: number;
  openPositions: number;
  todayPnL: number;
  todayPnLPercent: number;
  consecutiveLosses: number;
}

interface RiskCheckResult {
  approved: boolean;
  adjustedSize?: number;
  reason?: string;
  warnings: string[];
}

/**
 * Main risk assessment function
 * Takes consensus result and portfolio state, returns risk-adjusted signal
 */
export function assessRisk(
  consensus: ConsensusResult,
  portfolioState: PortfolioState,
  config: CoachConfig,
  currentPrice: number,
  atr: number,
  assetType: 'stock' | 'etf' | 'crypto'
): RiskAssessment {
  const warnings: string[] = [];
  const rules: string[] = [];

  // Rule 1: Check kill switch
  if (config.killSwitch) {
    return {
      approved: false,
      reason: 'Kill switch is activated. Trading paused.',
      warnings: [],
      rules: ['Kill switch active'],
    };
  }

  // Rule 2: Check if action is HOLD (no position needed)
  if (consensus.action === 'HOLD') {
    return {
      approved: true,
      reason: 'HOLD signal - no position to size.',
      warnings: [],
      rules: [],
    };
  }

  // Rule 3: Daily drawdown circuit breaker
  if (
    portfolioState.todayPnLPercent <= -config.riskParams.dailyDrawdownLimitPct
  ) {
    return {
      approved: false,
      reason: `Daily drawdown limit reached (${portfolioState.todayPnLPercent.toFixed(2)}%). Trading paused for today.`,
      warnings: [],
      rules: ['Circuit breaker: daily drawdown'],
    };
  }

  // Rule 4: Consecutive losses circuit breaker
  if (portfolioState.consecutiveLosses >= config.riskParams.maxConsecutiveLosses) {
    return {
      approved: false,
      reason: `Consecutive losses limit reached (${portfolioState.consecutiveLosses}). Review strategy before continuing.`,
      warnings: [],
      rules: ['Circuit breaker: consecutive losses'],
    };
  }

  // Rule 5: Max open positions
  if (portfolioState.openPositions >= config.riskParams.maxOpenPositions) {
    return {
      approved: false,
      reason: `Maximum open positions reached (${config.riskParams.maxOpenPositions}). Close a position first.`,
      warnings: [],
      rules: ['Max positions limit'],
    };
  }

  // Rule 6: Calculate position size based on max allocation
  const maxAllocation =
    (portfolioState.totalValue * config.riskParams.maxAllocationPct) / 100;
  let positionSize = Math.min(maxAllocation, portfolioState.availableCash);

  if (positionSize < 10) {
    return {
      approved: false,
      reason: 'Insufficient funds for minimum position size ($10).',
      warnings: [],
      rules: ['Minimum position size'],
    };
  }

  rules.push(
    `Max allocation: ${config.riskParams.maxAllocationPct}% ($${maxAllocation.toFixed(2)})`
  );

  // Rule 7: Calculate ATR-based stop loss
  const stopLossPct =
    assetType === 'crypto'
      ? config.riskParams.stopLossCryptoPct
      : config.riskParams.stopLossStockPct;

  const atrStopDistance = atr * config.riskParams.stopLossAtrMultiplier;
  const pctStopDistance = currentPrice * (stopLossPct / 100);
  const stopDistance = Math.max(atrStopDistance, pctStopDistance);

  let stopLoss: number;
  if (consensus.action === 'BUY') {
    stopLoss = currentPrice - stopDistance;
  } else {
    stopLoss = currentPrice + stopDistance;
  }

  // Use consensus stop loss if more conservative
  if (consensus.stopLoss) {
    if (consensus.action === 'BUY') {
      stopLoss = Math.max(stopLoss, consensus.stopLoss);
    } else {
      stopLoss = Math.min(stopLoss, consensus.stopLoss);
    }
  }

  rules.push(
    `Stop loss: ${((stopDistance / currentPrice) * 100).toFixed(2)}% (ATR: ${atr.toFixed(2)})`
  );

  // Rule 8: Risk-based position sizing (1R = max loss)
  const riskPerShare = Math.abs(currentPrice - stopLoss);
  const maxRiskAmount = portfolioState.totalValue * 0.02; // Risk max 2% per trade
  const riskBasedSize = (maxRiskAmount / riskPerShare) * currentPrice;

  if (riskBasedSize < positionSize) {
    warnings.push(
      `Position reduced from $${positionSize.toFixed(2)} to $${riskBasedSize.toFixed(2)} for risk management.`
    );
    positionSize = riskBasedSize;
  }

  rules.push(`Risk per trade: 2% max ($${maxRiskAmount.toFixed(2)})`);

  // Rule 9: Calculate take profit levels
  const takeProfits = calculateTakeProfits(
    currentPrice,
    stopDistance,
    consensus.action,
    config.riskParams
  );

  // Rule 10: Calculate expected return and risk
  const expectedRisk = (riskPerShare / currentPrice) * 100;
  const avgTpDistance =
    takeProfits.length > 0
      ? takeProfits.reduce((sum, tp) => sum + Math.abs(tp.price - currentPrice), 0) /
        takeProfits.length
      : stopDistance * 2;
  const expectedReturn = (avgTpDistance / currentPrice) * 100;

  // Rule 11: Check risk/reward ratio
  const rrRatio = expectedReturn / expectedRisk;
  if (rrRatio < 1.5) {
    warnings.push(
      `Risk/reward ratio (${rrRatio.toFixed(2)}) is below recommended 1.5. Consider skipping.`
    );
  }

  rules.push(`R:R ratio: ${rrRatio.toFixed(2)}`);

  // Warn if approaching limits
  if (portfolioState.todayPnLPercent <= -config.riskParams.dailyDrawdownLimitPct * 0.7) {
    warnings.push(
      `Approaching daily drawdown limit (${portfolioState.todayPnLPercent.toFixed(2)}% of ${config.riskParams.dailyDrawdownLimitPct}% max).`
    );
  }

  if (portfolioState.consecutiveLosses >= config.riskParams.maxConsecutiveLosses - 1) {
    warnings.push(
      `Next loss will trigger consecutive losses circuit breaker.`
    );
  }

  return {
    approved: true,
    positionSize: Math.round(positionSize * 100) / 100,
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfits,
    expectedReturn: Math.round(expectedReturn * 100) / 100,
    expectedRisk: Math.round(expectedRisk * 100) / 100,
    riskRewardRatio: Math.round(rrRatio * 100) / 100,
    warnings,
    rules,
  };
}

/**
 * Calculate take profit levels
 * TP1: 1R (close tp1Pct of position)
 * TP2: 2R (close tp2Pct of remaining)
 * Runner: trailing stop for rest
 */
function calculateTakeProfits(
  currentPrice: number,
  stopDistance: number,
  action: 'BUY' | 'SELL',
  riskParams: CoachConfig['riskParams']
): TakeProfitLevel[] {
  const takeProfits: TakeProfitLevel[] = [];
  const direction = action === 'BUY' ? 1 : -1;

  // TP1 at 1R
  const tp1Price = currentPrice + direction * stopDistance;
  takeProfits.push({
    price: Math.round(tp1Price * 100) / 100,
    percentage: riskParams.tp1Pct,
    type: 'fixed',
  });

  // TP2 at 2R
  const tp2Price = currentPrice + direction * stopDistance * 2;
  takeProfits.push({
    price: Math.round(tp2Price * 100) / 100,
    percentage: riskParams.tp2Pct,
    type: 'fixed',
  });

  // Runner with trailing stop
  if (riskParams.runnerPct > 0) {
    const runnerTrailPrice = currentPrice + direction * stopDistance * 2.5;
    takeProfits.push({
      price: Math.round(runnerTrailPrice * 100) / 100,
      percentage: riskParams.runnerPct,
      type: 'trailing',
      trailingAtr: riskParams.trailingAtrMultiplier,
    });
  }

  return takeProfits;
}

/**
 * Check if a paper trade should be stopped out
 */
export function checkStopLoss(
  entryPrice: number,
  currentPrice: number,
  stopLoss: number,
  side: 'BUY' | 'SELL'
): boolean {
  if (side === 'BUY') {
    return currentPrice <= stopLoss;
  } else {
    return currentPrice >= stopLoss;
  }
}

/**
 * Check if any take profit level is hit
 */
export function checkTakeProfits(
  entryPrice: number,
  currentPrice: number,
  takeProfits: TakeProfitLevel[],
  side: 'BUY' | 'SELL'
): TakeProfitLevel | null {
  for (const tp of takeProfits) {
    if (side === 'BUY') {
      if (currentPrice >= tp.price) {
        return tp;
      }
    } else {
      if (currentPrice <= tp.price) {
        return tp;
      }
    }
  }
  return null;
}

/**
 * Calculate trailing stop price
 */
export function calculateTrailingStop(
  highestPrice: number,
  lowestPrice: number,
  atr: number,
  multiplier: number,
  side: 'BUY' | 'SELL'
): number {
  const trailDistance = atr * multiplier;

  if (side === 'BUY') {
    // Trail below highest price for long positions
    return highestPrice - trailDistance;
  } else {
    // Trail above lowest price for short positions
    return lowestPrice + trailDistance;
  }
}

/**
 * Validate position before execution
 */
export function validatePosition(
  positionSize: number,
  availableCash: number,
  currentPrice: number
): { valid: boolean; error?: string } {
  if (positionSize <= 0) {
    return { valid: false, error: 'Position size must be positive.' };
  }

  if (positionSize > availableCash) {
    return {
      valid: false,
      error: `Insufficient funds. Required: $${positionSize.toFixed(2)}, Available: $${availableCash.toFixed(2)}`,
    };
  }

  const shares = positionSize / currentPrice;
  if (shares < 0.001) {
    return { valid: false, error: 'Position too small (< 0.001 shares).' };
  }

  return { valid: true };
}

/**
 * Calculate P&L for a position
 */
export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  side: 'BUY' | 'SELL'
): { pnl: number; pnlPercent: number } {
  let pnl: number;

  if (side === 'BUY') {
    pnl = (currentPrice - entryPrice) * quantity;
  } else {
    pnl = (entryPrice - currentPrice) * quantity;
  }

  const investment = entryPrice * quantity;
  const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;

  return {
    pnl: Math.round(pnl * 100) / 100,
    pnlPercent: Math.round(pnlPercent * 100) / 100,
  };
}

/**
 * Get risk level classification
 */
export function classifyRisk(
  expectedRisk: number,
  riskRewardRatio: number
): 'low' | 'medium' | 'high' {
  if (expectedRisk <= 2 && riskRewardRatio >= 2) {
    return 'low';
  }
  if (expectedRisk <= 5 && riskRewardRatio >= 1.5) {
    return 'medium';
  }
  return 'high';
}
