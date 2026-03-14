/**
 * Autonomous Coach Runner
 * Shared logic for running analysis, auto-executing trades, and auto-closing trades.
 * Used by both the manual analyze API route and the cron job.
 */

import { runBatchAnalysis, parseWatchSymbol } from '@/lib/coach/engine/coachEngine';
import { DEFAULT_COACH_CONFIG, INITIAL_COACH_BALANCE, BATCH_SIZE } from '@/lib/coach/types';
import type { OHLCData, DailyReportMetrics } from '@/lib/coach/types';
import type { AssetType, Market } from '@/types';
import { getHistoricalData as getYahooHistorical } from '@/lib/api/yahoo-finance';
import { getMarketQuote } from '@/lib/api/market-data';
import { calculatePnL, checkStopLoss, checkTakeProfits } from '@/lib/coach/risk/riskEngine';
import type { TakeProfitLevel } from '@/lib/coach/types';

/**
 * Get portfolio state for risk assessment.
 * The coach has its own independent $100k paper trading balance,
 * calculated from its own trade history (not the main portfolio).
 */
export async function getPortfolioState(supabase: any, userId: string) {
  // Get all open trades to calculate capital in use
  const { data: openTrades } = await (supabase
    .from('coach_paper_trade') as any)
    .select('size_usd')
    .eq('user_id', userId)
    .eq('status', 'open');

  const openPositions = openTrades?.length || 0;
  const capitalInUse = (openTrades || []).reduce(
    (sum: number, t: any) => sum + parseFloat(t.size_usd || 0), 0
  );

  // Get total realized P&L from all closed trades
  const { data: closedTrades } = await (supabase
    .from('coach_paper_trade') as any)
    .select('pnl_usd')
    .eq('user_id', userId)
    .not('pnl_usd', 'is', null);

  const totalRealizedPnl = (closedTrades || []).reduce(
    (sum: number, t: any) => sum + parseFloat(t.pnl_usd || 0), 0
  );

  // Coach's own balance: initial $100k + realized P&L - capital in open trades
  const totalValue = INITIAL_COACH_BALANCE + totalRealizedPnl;
  const availableCash = totalValue - capitalInUse;

  // Today's P&L (for reporting, not for circuit breakers)
  const today = new Date().toISOString().split('T')[0];
  const { data: todayTrades } = await (supabase
    .from('coach_paper_trade') as any)
    .select('pnl_usd')
    .eq('user_id', userId)
    .gte('closed_at', today)
    .not('pnl_usd', 'is', null);

  const todayPnL = (todayTrades || []).reduce(
    (sum: number, t: any) => sum + parseFloat(t.pnl_usd || 0), 0
  );
  const todayPnLPercent = totalValue > 0 ? (todayPnL / totalValue) * 100 : 0;

  return {
    totalValue: Math.max(totalValue, 0),
    availableCash: Math.max(availableCash, 0),
    openPositions,
    todayPnL,
    todayPnLPercent,
    consecutiveLosses: 0, // No longer tracked — no limits
  };
}

/**
 * Transform database row to config object
 */
export function transformConfigRow(row: any) {
  return {
    userId: row.user_id,
    killSwitch: row.kill_switch,
    weights: {
      indicator: parseFloat(row.weight_indicator),
      priceAction: parseFloat(row.weight_price_action),
      news: parseFloat(row.weight_news),
    },
    minConfidence: parseFloat(row.min_confidence),
    minConsensusScore: parseFloat(row.min_consensus_score),
    riskParams: {
      maxAllocationPct: parseFloat(row.max_allocation_pct),
      maxOpenPositions: row.max_open_positions,
      useLeverage: row.use_leverage,
      stopLossStockPct: parseFloat(row.stop_loss_stock_pct),
      stopLossCryptoPct: parseFloat(row.stop_loss_crypto_pct),
      stopLossAtrMultiplier: parseFloat(row.stop_loss_atr_multiplier),
      tp1Pct: parseFloat(row.tp1_pct),
      tp2Pct: parseFloat(row.tp2_pct),
      runnerPct: parseFloat(row.runner_pct),
      trailingAtrMultiplier: parseFloat(row.trailing_atr_multiplier),
      dailyDrawdownLimitPct: parseFloat(row.daily_drawdown_limit_pct),
      maxConsecutiveLosses: row.max_consecutive_losses,
    },
    watchSymbols: row.watch_symbols || [],
    runCadenceMinutes: row.run_cadence_minutes,
  };
}

/**
 * Fetch market data (current price + OHLC history) for a symbol
 */
export async function fetchMarketData(
  symbol: string,
  assetType: AssetType,
  market: Market
): Promise<{ currentPrice: number; ohlcData: OHLCData[] } | null> {
  try {
    const quote = await getMarketQuote(symbol, assetType, market);
    if (!quote) {
      console.log(`No quote found for ${symbol}`);
      return null;
    }

    let historicalData: any[] | null = null;

    if (assetType === 'crypto') {
      const yahooSymbol = `${symbol.toUpperCase()}-USD`;
      historicalData = await getYahooHistorical(yahooSymbol, 90);
    } else {
      historicalData = await getYahooHistorical(symbol, 90);
    }

    if (!historicalData || historicalData.length < 20) {
      console.log(`Insufficient historical data for ${symbol}: ${historicalData?.length || 0} days`);
      return null;
    }

    const ohlcData: OHLCData[] = historicalData.map((d: any) => ({
      timestamp: new Date(d.date).getTime(),
      open: d.open || d.close,
      high: d.high || d.close,
      low: d.low || d.close,
      close: d.close,
      volume: d.volume || 0,
    }));

    return { currentPrice: quote.price, ohlcData };
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Run analysis and auto-execute trades for a single user
 */
export async function runAnalysisForUser(
  supabase: any,
  userId: string,
  configRow: any
) {
  const config = configRow
    ? transformConfigRow(configRow)
    : { ...DEFAULT_COACH_CONFIG, userId };

  if (config.killSwitch) {
    return { skipped: true, reason: 'Kill switch active' };
  }

  // Parse all watch symbols
  const allSymbols: Array<{ symbol: string; assetType: AssetType; market: Market }> = [];
  for (const s of config.watchSymbols) {
    const parsed = parseWatchSymbol(s);
    if (parsed) allSymbols.push(parsed);
  }

  if (allSymbols.length === 0) {
    return { skipped: true, reason: 'No symbols in watchlist' };
  }

  // Get symbols with open positions — always include these for monitoring
  const { data: openTrades } = await (supabase.from('coach_paper_trade') as any)
    .select('symbol')
    .eq('user_id', userId)
    .eq('status', 'open');

  const openSymbols = new Set((openTrades || []).map((t: any) => t.symbol));

  // Rotating batch: select BATCH_SIZE symbols from the watchlist per run.
  // Use the current hour as the rotation index so each run gets a different slice.
  // Full cycle for 200 symbols at 30/run = ~7 batches ≈ 7 × 15min = covered in ~1.75 hours.
  const totalBatches = Math.ceil(allSymbols.length / BATCH_SIZE);
  const batchIndex = Math.floor(Date.now() / (config.runCadenceMinutes * 60 * 1000)) % totalBatches;
  const batchStart = batchIndex * BATCH_SIZE;
  const batchSlice = allSymbols.slice(batchStart, batchStart + BATCH_SIZE);

  // Merge: batch slice + any symbols that have open positions (to always check stop-loss/TP)
  const batchSymbolNames = new Set(batchSlice.map(s => s.symbol));
  const extraOpenSymbols = allSymbols.filter(s => openSymbols.has(s.symbol) && !batchSymbolNames.has(s.symbol));
  const symbolsToAnalyze = [...batchSlice, ...extraOpenSymbols];

  if (symbolsToAnalyze.length === 0) {
    return { skipped: true, reason: 'No symbols in watchlist' };
  }


  const portfolioState = await getPortfolioState(supabase, userId);

  const result = await runBatchAnalysis(
    symbolsToAnalyze,
    fetchMarketData,
    config,
    portfolioState
  );

  // Save signals and auto-execute trades
  const autoExecutedTrades: Array<{ symbol: string; side: string; sizeUsd: number }> = [];
  let openPositionsCount = portfolioState.openPositions;
  // Track remaining cash across trades in this batch to prevent overspending
  let remainingCash = portfolioState.availableCash;

  // Max allocation per position from config (defaults to 100% if not set)
  const maxAllocationPct = config.riskParams.maxAllocationPct || 15;
  const maxPositionByAllocation = portfolioState.totalValue * (maxAllocationPct / 100);

  for (const signal of result.signals) {
    const { data: savedSignal } = await (supabase.from('coach_signal') as any)
      .insert({
        user_id: userId,
        symbol: signal.symbol,
        asset_type: signal.assetType,
        market: signal.market,
        timeframe: signal.timeframe,
        signal_ts: signal.signalTs,
        consensus_action: signal.consensusAction,
        consensus_score: signal.consensusScore,
        entry_low: signal.entryLow,
        entry_high: signal.entryHigh,
        stop_loss: signal.stopLoss,
        take_profit_json: signal.takeProfitJson,
        agent_votes_json: signal.agentVotesJson,
        rationale: signal.rationale,
        expected_return_pct: signal.expectedReturnPct,
        expected_risk_pct: signal.expectedRiskPct,
        risk_reward_ratio: signal.riskRewardRatio,
        market_open: signal.marketOpen,
        current_price: signal.currentPrice,
        is_stale: signal.isStale,
        acknowledged: true,
      })
      .select('id')
      .single();

    if (signal.consensusAction !== 'HOLD' && signal.currentPrice && !signal.isStale) {
      // Skip if already have an open trade for this symbol
      const { data: existingTrade } = await (supabase.from('coach_paper_trade') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('symbol', signal.symbol)
        .eq('status', 'open')
        .maybeSingle();

      if (existingTrade) continue;

      // Skip if no cash left
      if (remainingCash < 10) {
        console.log(`Skipping ${signal.symbol}: insufficient cash ($${remainingCash.toFixed(2)} remaining)`);
        continue;
      }

      // Position sizing: min of (allocation limit, remaining cash)
      // This ensures we NEVER exceed available cash
      const sizeUsd = Math.min(maxPositionByAllocation, remainingCash);
      if (sizeUsd < 10) {
        console.log(`Skipping ${signal.symbol}: position size too small ($${sizeUsd.toFixed(2)})`);
        continue;
      }

      const quantity = sizeUsd / signal.currentPrice;
      const allocationPct = portfolioState.totalValue > 0
        ? ((sizeUsd / portfolioState.totalValue) * 100).toFixed(1)
        : '0.0';

      // Build detailed trade notes including TP explanation
      const tpExplanation = buildTakeProfitExplanation(signal.takeProfitJson, signal.currentPrice, signal.stopLoss);
      const tradeNotes = [
        `Auto-executed by coach. Score: ${((signal.consensusScore || 0) * 100).toFixed(0)}%`,
        `Allocation: ${allocationPct}% of portfolio ($${sizeUsd.toFixed(2)} / $${portfolioState.totalValue.toFixed(2)})`,
        `Cash remaining after: $${(remainingCash - sizeUsd).toFixed(2)}`,
        tpExplanation,
      ].filter(Boolean).join(' | ');

      await (supabase.from('coach_paper_trade') as any).insert({
        user_id: userId,
        signal_id: savedSignal?.id || null,
        symbol: signal.symbol,
        asset_type: signal.assetType,
        market: signal.market,
        side: signal.consensusAction,
        entry_price: signal.currentPrice,
        size_usd: sizeUsd,
        quantity,
        stop_loss: signal.stopLoss,
        take_profit_json: signal.takeProfitJson,
        status: 'open',
        opened_at: new Date().toISOString(),
        notes: tradeNotes,
      });

      // Deduct from remaining cash to prevent overspending in this batch
      remainingCash -= sizeUsd;
      openPositionsCount++;
      autoExecutedTrades.push({
        symbol: signal.symbol,
        side: signal.consensusAction,
        sizeUsd,
      });
    }
  }

  return {
    skipped: false,
    signalsGenerated: result.signalsGenerated,
    autoExecutedTrades,
    errors: result.errors,
  };
}

/**
 * Monitor and auto-close open trades at stop loss / take profit
 */
export async function autoCloseTradesForUser(supabase: any, userId: string) {
  const { data: openTrades } = await (supabase.from('coach_paper_trade') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open');

  if (!openTrades || openTrades.length === 0) {
    return { closed: 0, trades: [] };
  }

  const closedTrades: Array<{ symbol: string; reason: string; pnl: number }> = [];

  for (const trade of openTrades) {
    try {
      const assetType: AssetType = trade.asset_type || 'stock';
      const market: Market = trade.market || 'us';
      const quote = await getMarketQuote(trade.symbol, assetType, market);

      if (!quote) continue;

      const currentPrice = quote.price;
      const side = trade.side as 'BUY' | 'SELL';
      const entryPrice = parseFloat(trade.entry_price);
      const quantity = parseFloat(trade.quantity);
      const stopLoss = trade.stop_loss ? parseFloat(trade.stop_loss) : null;
      const takeProfits: TakeProfitLevel[] = trade.take_profit_json || [];

      let shouldClose = false;
      let closeReason = '';

      // Check stop loss
      if (stopLoss && checkStopLoss(entryPrice, currentPrice, stopLoss, side)) {
        shouldClose = true;
        closeReason = 'stopped';
      }

      // Check take profits (close fully at highest TP hit)
      if (!shouldClose && takeProfits.length > 0) {
        const tpHit = checkTakeProfits(entryPrice, currentPrice, takeProfits, side);
        if (tpHit) {
          shouldClose = true;
          closeReason = 'tp_hit';
        }
      }

      if (shouldClose) {
        const { pnl, pnlPercent } = calculatePnL(entryPrice, currentPrice, quantity, side);

        await (supabase.from('coach_paper_trade') as any)
          .update({
            status: 'closed',
            exit_price: currentPrice,
            pnl_usd: pnl,
            pnl_pct: pnlPercent,
            closed_at: new Date().toISOString(),
            notes: `${trade.notes || ''} | Auto-closed: ${closeReason}`,
          })
          .eq('id', trade.id);

        closedTrades.push({ symbol: trade.symbol, reason: closeReason, pnl });
      }
    } catch (err) {
      console.error(`Error checking trade ${trade.symbol}:`, err);
    }
  }

  return { closed: closedTrades.length, trades: closedTrades };
}

/**
 * Auto-generate a daily report for a user, including AI summary and trade rationales.
 * Called by the cron job at the end of the trading day.
 */
export async function generateDailyReportForUser(supabase: any, userId: string) {
  const reportDate = new Date().toISOString().split('T')[0];

  // Check if report already exists for today
  const { data: existing } = await (supabase
    .from('coach_daily_report') as any)
    .select('id')
    .eq('user_id', userId)
    .eq('report_date', reportDate)
    .maybeSingle();

  if (existing) return { skipped: true, reason: 'Report already exists' };

  const startOfDay = `${reportDate}T00:00:00Z`;
  const endOfDay = `${reportDate}T23:59:59Z`;

  // Get today's signals with rationale
  const { data: signals } = await (supabase
    .from('coach_signal') as any)
    .select('symbol, consensus_action, consensus_score, rationale, current_price')
    .eq('user_id', userId)
    .gte('signal_ts', startOfDay)
    .lte('signal_ts', endOfDay);

  if (!signals || signals.length === 0) {
    return { skipped: true, reason: 'No signals today' };
  }

  // Count signals by action
  const signalsByAction = { BUY: 0, SELL: 0, HOLD: 0 };
  const tradeRationales: { symbol: string; action: string; rationale: string }[] = [];

  for (const signal of signals) {
    const action = signal.consensus_action as keyof typeof signalsByAction;
    if (signalsByAction[action] !== undefined) {
      signalsByAction[action]++;
    }
    tradeRationales.push({
      symbol: signal.symbol,
      action: signal.consensus_action,
      rationale: signal.rationale || 'No rationale available',
    });
  }

  // Get trades opened today
  const { data: openedTrades } = await (supabase
    .from('coach_paper_trade') as any)
    .select('id, symbol, side, entry_price, size_usd')
    .eq('user_id', userId)
    .gte('opened_at', startOfDay)
    .lte('opened_at', endOfDay);

  // Get trades closed today
  const { data: closedTrades } = await (supabase
    .from('coach_paper_trade') as any)
    .select('pnl_usd, pnl_pct, symbol, side, entry_price, exit_price, notes')
    .eq('user_id', userId)
    .gte('closed_at', startOfDay)
    .lte('closed_at', endOfDay);

  // Calculate metrics
  const realizedPnl = (closedTrades || []).reduce(
    (sum: number, t: any) => sum + (parseFloat(t.pnl_usd) || 0), 0
  );
  const wins = (closedTrades || []).filter((t: any) => parseFloat(t.pnl_usd) > 0).length;
  const winRate = closedTrades?.length ? (wins / closedTrades.length) * 100 : 0;

  // Get open trades for unrealized P&L
  const { data: openTrades } = await (supabase
    .from('coach_paper_trade') as any)
    .select('symbol, asset_type, market, entry_price, quantity, side')
    .eq('user_id', userId)
    .eq('status', 'open');

  let unrealizedPnl = 0;
  for (const trade of openTrades || []) {
    try {
      const quote = await getMarketQuote(trade.symbol, trade.asset_type || 'stock', trade.market || 'us');
      if (quote) {
        const { pnl } = calculatePnL(
          parseFloat(trade.entry_price), quote.price,
          parseFloat(trade.quantity), trade.side
        );
        unrealizedPnl += pnl;
      }
    } catch { /* skip */ }
  }

  // Top and worst performers
  const sortedTrades = [...(closedTrades || [])].sort(
    (a: any, b: any) => parseFloat(b.pnl_pct || '0') - parseFloat(a.pnl_pct || '0')
  );
  const topPerformers = sortedTrades.slice(0, 3).map((t: any) => ({
    symbol: t.symbol, pnlPct: parseFloat(t.pnl_pct || '0'),
  }));
  const worstPerformers = sortedTrades.slice(-3).reverse().map((t: any) => ({
    symbol: t.symbol, pnlPct: parseFloat(t.pnl_pct || '0'),
  }));

  // Build AI summary
  const buySignals = tradeRationales.filter(r => r.action === 'BUY');
  const sellSignals = tradeRationales.filter(r => r.action === 'SELL');
  const holdSignals = tradeRationales.filter(r => r.action === 'HOLD');

  const summaryParts: string[] = [];

  summaryParts.push(
    `**Daily Market Report - ${new Date(reportDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}**`
  );

  summaryParts.push(
    `\nToday the coach analyzed ${signals.length} symbol${signals.length !== 1 ? 's' : ''} and generated ${signalsByAction.BUY} buy signal${signalsByAction.BUY !== 1 ? 's' : ''}, ${signalsByAction.SELL} sell signal${signalsByAction.SELL !== 1 ? 's' : ''}, and ${signalsByAction.HOLD} hold signal${signalsByAction.HOLD !== 1 ? 's' : ''}.`
  );

  if ((openedTrades || []).length > 0) {
    const tradeList = (openedTrades || []).map((t: any) =>
      `${t.side} ${t.symbol} at $${parseFloat(t.entry_price).toFixed(2)} ($${parseFloat(t.size_usd).toFixed(0)})`
    ).join(', ');
    summaryParts.push(`\n**Trades Executed:** ${tradeList}`);
  }

  if ((closedTrades || []).length > 0) {
    const closeList = (closedTrades || []).map((t: any) => {
      const pnl = parseFloat(t.pnl_usd || '0');
      return `${t.symbol} ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${t.notes?.includes('stopped') ? 'stop loss' : t.notes?.includes('tp_hit') ? 'take profit' : 'closed'})`;
    }).join(', ');
    summaryParts.push(`\n**Trades Closed:** ${closeList}`);
    summaryParts.push(`Realized P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} | Win rate: ${winRate.toFixed(0)}%`);
  }

  if ((openTrades || []).length > 0) {
    summaryParts.push(`\n**Open Positions:** ${(openTrades || []).length} | Unrealized P&L: ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)}`);
  }

  // Add key rationales
  if (buySignals.length > 0) {
    summaryParts.push('\n**Why we bought:**');
    for (const s of buySignals.slice(0, 5)) {
      summaryParts.push(`- **${s.symbol}**: ${s.rationale}`);
    }
  }
  if (sellSignals.length > 0) {
    summaryParts.push('\n**Why we sold:**');
    for (const s of sellSignals.slice(0, 5)) {
      summaryParts.push(`- **${s.symbol}**: ${s.rationale}`);
    }
  }
  if (holdSignals.length > 0 && holdSignals.length <= 5) {
    summaryParts.push('\n**Why we held:**');
    for (const s of holdSignals) {
      summaryParts.push(`- **${s.symbol}**: ${s.rationale}`);
    }
  } else if (holdSignals.length > 5) {
    summaryParts.push(`\n**Hold signals:** ${holdSignals.length} symbols held — no strong conviction to enter or exit.`);
  }

  const summary = summaryParts.join('\n');

  const metrics: DailyReportMetrics = {
    signalsGenerated: signals.length,
    signalsByAction,
    paperTradesOpened: (openedTrades || []).length,
    paperTradesClosed: (closedTrades || []).length,
    realizedPnlUsd: Math.round(realizedPnl * 100) / 100,
    unrealizedPnlUsd: Math.round(unrealizedPnl * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    avgRiskReward: 0,
    topPerformers,
    worstPerformers,
    circuitBreakerTriggered: false,
    summary,
    tradeRationales,
  };

  // Save report
  const { data: report, error } = await (supabase
    .from('coach_daily_report') as any)
    .insert({
      user_id: userId,
      report_date: reportDate,
      metrics_json: metrics,
    })
    .select()
    .single();

  if (error) {
    console.error(`Error creating report for user ${userId}:`, error);
    return { skipped: false, error: error.message };
  }

  return { skipped: false, reportId: report?.id, summary: summary.substring(0, 200) + '...' };
}

/**
 * Build a human-readable explanation of take profit levels.
 * Explains the R-multiple logic: TP1 = 1R, TP2 = 2R, Runner = trailing.
 */
function buildTakeProfitExplanation(
  takeProfits: TakeProfitLevel[] | undefined,
  currentPrice: number | undefined,
  stopLoss: number | undefined
): string {
  if (!takeProfits || takeProfits.length === 0 || !currentPrice) return '';

  const stopDist = stopLoss ? Math.abs(currentPrice - stopLoss) : 0;
  const parts: string[] = ['TPs:'];

  for (let i = 0; i < takeProfits.length; i++) {
    const tp = takeProfits[i];
    const pctFromEntry = ((tp.price - currentPrice) / currentPrice * 100).toFixed(1);
    const rMultiple = stopDist > 0 ? (Math.abs(tp.price - currentPrice) / stopDist).toFixed(1) : '?';
    const typeLabel = tp.type === 'trailing' ? 'trailing' : 'fixed';

    parts.push(
      `TP${i + 1} $${tp.price.toFixed(2)} (${pctFromEntry}%, ${rMultiple}R ${typeLabel}, close ${tp.percentage}%)`
    );
  }

  if (stopDist > 0) {
    parts.push(
      `— Based on ${stopDist.toFixed(2)} risk/share (SL at $${stopLoss!.toFixed(2)}). ` +
      `TP1=1R, TP2=2R reward, Runner=2.5R trailing stop.`
    );
  }

  return parts.join(' ');
}

// ─── Fine-Tune autonomous runner ──────────────────────────────────────────────

/** The 55-stock pharma/biotech universe used by the Fine-Tune portfolio. */
const FINE_TUNE_PHARMA_UNIVERSE = [
  // US Large-Cap Pharma
  'JNJ','PFE','MRK','ABBV','LLY','BMY','TMO','ABT','DHR','SYK','BDX','ZTS','BAX','VTRS',
  // US Biotech
  'AMGN','GILD','REGN','VRTX','BIIB','MRNA','BNTX','INCY','ALNY','BMRN','SGEN',
  'EXEL','HALO','UTHR','NBIX','PCVX','SRPT','RARE','IONS','PTCT','INSM','MEDP',
  // International ADRs
  'AZN','NVO','GSK','SNY','NVS','RHHBY','BAYRY','TAK','ARGX','HLN','ZLAB',
  'RDY','TEVA','ALVO','LEGN','BHC','CTLT','IQV','CRL',
];

const FINE_TUNE_INITIAL_BALANCE = 100_000;

/**
 * Run the Fine-Tune portfolio for a user: auto-close SL/TP, analyze, auto-trade, report.
 * Called by the cron job alongside the Coach processing.
 */
export async function runFineTuneForUser(supabase: any, userId: string) {
  // ── Load config ─────────────────────────────────────────────────────────────
  const { data: configRow } = await (supabase.from('fine_tune_config') as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Skip if not activated or kill-switched
  if (!configRow || !configRow.is_active) {
    return { skipped: true, reason: 'Fine-Tune not active' };
  }
  if (configRow.kill_switch) {
    return { skipped: true, reason: 'Kill switch active' };
  }

  const weights = {
    indicator:   Number(configRow.indicator_weight   ?? 0.45),
    priceAction: Number(configRow.price_action_weight ?? 0.45),
    news:        Number(configRow.news_weight         ?? 0.10),
  };

  // ── 1. Auto-close open positions at SL / TP ────────────────────────────────
  const { data: openTrades } = await (supabase.from('fine_tune_trade') as any)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open');

  let tradesClosed = 0;
  for (const trade of openTrades || []) {
    try {
      const quote = await getMarketQuote(trade.symbol, trade.asset_type || 'stock', trade.market || 'us');
      if (!quote) continue;

      const price = quote.price;
      const entry = Number(trade.entry_price);
      const sl = trade.stop_loss ? Number(trade.stop_loss) : null;
      const tps: TakeProfitLevel[] = trade.take_profit_json || [];
      const side = trade.side as 'BUY' | 'SELL';

      let newStatus: string | null = null;
      if (sl && checkStopLoss(entry, price, sl, side)) {
        newStatus = 'stopped';
      } else if (tps.length > 0 && checkTakeProfits(entry, price, tps, side)) {
        newStatus = 'tp_hit';
      }

      if (newStatus) {
        const { pnl, pnlPercent } = calculatePnL(entry, price, Number(trade.quantity), side);
        await (supabase.from('fine_tune_trade') as any)
          .update({
            status: newStatus,
            closed_at: new Date().toISOString(),
            exit_price: price,
            pnl_usd: pnl,
            pnl_pct: pnlPercent,
          })
          .eq('id', trade.id);
        tradesClosed++;
      }
    } catch { /* skip */ }
  }

  // ── 2. Recalculate portfolio state ──────────────────────────────────────────
  const { data: allTrades } = await (supabase.from('fine_tune_trade') as any)
    .select('size_usd, pnl_usd, status, symbol')
    .eq('user_id', userId);

  const stillOpen = (allTrades || []).filter((t: any) => t.status === 'open');
  const closed    = (allTrades || []).filter((t: any) => t.status !== 'open');
  const realizedPnL  = closed.reduce((s: number, t: any) => s + (Number(t.pnl_usd) || 0), 0);
  const capitalInUse = stillOpen.reduce((s: number, t: any) => s + Number(t.size_usd), 0);
  const totalValue   = FINE_TUNE_INITIAL_BALANCE + realizedPnL;
  const availableCash = Math.max(0, totalValue - capitalInUse);

  // ── 3. Run analysis with Fine-Tune weights ─────────────────────────────────
  const config = { ...DEFAULT_COACH_CONFIG, userId, weights };

  const symbolsToAnalyze = FINE_TUNE_PHARMA_UNIVERSE
    .map(s => parseWatchSymbol(s))
    .filter(Boolean) as ReturnType<typeof parseWatchSymbol>[];

  const portfolioState = {
    totalValue,
    availableCash,
    openPositions: stillOpen.length,
    todayPnL: 0,
    todayPnLPercent: 0,
    consecutiveLosses: 0,
  };

  const result = await runBatchAnalysis(
    symbolsToAnalyze as any,
    fetchMarketData,
    config,
    portfolioState,
  );

  // ── 4. Auto-execute actionable signals ──────────────────────────────────────
  const openSymbols = new Set(stillOpen.map((t: any) => t.symbol));
  const executed: { symbol: string; side: string }[] = [];
  let cash = availableCash;

  for (const signal of result.signals) {
    if (signal.consensusAction === 'HOLD' || !signal.currentPrice || signal.isStale) continue;
    if (openSymbols.has(signal.symbol)) continue;

    const sizeUsd = Math.min(cash, totalValue * 0.15);
    if (sizeUsd < 10) break;

    const quantity = sizeUsd / signal.currentPrice;

    await (supabase.from('fine_tune_trade') as any).insert({
      user_id:          userId,
      symbol:           signal.symbol,
      asset_type:       signal.assetType,
      market:           signal.market,
      side:             signal.consensusAction,
      entry_price:      signal.currentPrice,
      size_usd:         sizeUsd,
      quantity,
      stop_loss:        signal.stopLoss,
      take_profit_json: signal.takeProfitJson,
      status:           'open',
      opened_at:        new Date().toISOString(),
      notes: `Fine-Tune auto. Wts: Ind ${(weights.indicator * 100).toFixed(0)}%/PA ${(weights.priceAction * 100).toFixed(0)}%/News ${(weights.news * 100).toFixed(0)}%. Score: ${((signal.consensusScore || 0) * 100).toFixed(0)}%`,
    });

    openSymbols.add(signal.symbol);
    executed.push({ symbol: signal.symbol, side: signal.consensusAction });
    cash -= sizeUsd;
  }

  // ── 5. Generate daily report ────────────────────────────────────────────────
  const reportResult = await generateFineTuneReportForUser(supabase, userId);

  return {
    skipped: false,
    tradesClosed,
    signalsGenerated: result.signals.length,
    tradesExecuted: executed.length,
    report: reportResult,
  };
}

/**
 * Generate a daily report for the Fine-Tune portfolio (mirrors Coach report logic).
 */
export async function generateFineTuneReportForUser(supabase: any, userId: string) {
  const reportDate = new Date().toISOString().split('T')[0];

  // Check if report already exists for today
  const { data: existing } = await (supabase.from('fine_tune_report') as any)
    .select('id')
    .eq('user_id', userId)
    .eq('report_date', reportDate)
    .maybeSingle();

  if (existing) return { skipped: true, reason: 'Report already exists' };

  const startOfDay = `${reportDate}T00:00:00Z`;
  const endOfDay = `${reportDate}T23:59:59Z`;

  // Get trades opened today
  const { data: openedTrades } = await (supabase.from('fine_tune_trade') as any)
    .select('id, symbol, side, entry_price, size_usd')
    .eq('user_id', userId)
    .gte('opened_at', startOfDay)
    .lte('opened_at', endOfDay);

  // Get trades closed today
  const { data: closedTrades } = await (supabase.from('fine_tune_trade') as any)
    .select('pnl_usd, pnl_pct, symbol, side, entry_price, exit_price, notes')
    .eq('user_id', userId)
    .gte('closed_at', startOfDay)
    .lte('closed_at', endOfDay);

  const opened = openedTrades || [];
  const closed = closedTrades || [];

  if (opened.length === 0 && closed.length === 0) {
    return { skipped: true, reason: 'No Fine-Tune activity today' };
  }

  // Metrics
  const realizedPnl = closed.reduce((s: number, t: any) => s + (Number(t.pnl_usd) || 0), 0);
  const wins = closed.filter((t: any) => Number(t.pnl_usd) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  // Unrealized P&L from open positions
  const { data: openTrades } = await (supabase.from('fine_tune_trade') as any)
    .select('symbol, asset_type, market, entry_price, quantity, side')
    .eq('user_id', userId)
    .eq('status', 'open');

  let unrealizedPnl = 0;
  for (const trade of openTrades || []) {
    try {
      const quote = await getMarketQuote(trade.symbol, trade.asset_type || 'stock', trade.market || 'us');
      if (quote) {
        const { pnl } = calculatePnL(
          Number(trade.entry_price), quote.price, Number(trade.quantity), trade.side,
        );
        unrealizedPnl += pnl;
      }
    } catch { /* skip */ }
  }

  // Top / worst performers
  const sorted = [...closed].sort((a: any, b: any) => Number(b.pnl_pct || 0) - Number(a.pnl_pct || 0));
  const topPerformers = sorted.slice(0, 3).map((t: any) => ({ symbol: t.symbol, pnlPct: Number(t.pnl_pct || 0) }));
  const worstPerformers = sorted.slice(-3).reverse().map((t: any) => ({ symbol: t.symbol, pnlPct: Number(t.pnl_pct || 0) }));

  // Summary
  const parts: string[] = [];
  parts.push(`**Fine-Tune Pharma Report — ${new Date(reportDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}**`);
  if (opened.length > 0) {
    const list = opened.map((t: any) => `${t.side} ${t.symbol} $${Number(t.size_usd).toFixed(0)}`).join(', ');
    parts.push(`\n**Trades Opened:** ${list}`);
  }
  if (closed.length > 0) {
    const list = closed.map((t: any) => {
      const p = Number(t.pnl_usd || 0);
      return `${t.symbol} ${p >= 0 ? '+' : ''}$${p.toFixed(2)}`;
    }).join(', ');
    parts.push(`\n**Trades Closed:** ${list}`);
    parts.push(`Realized P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} | Win rate: ${winRate.toFixed(0)}%`);
  }
  if ((openTrades || []).length > 0) {
    parts.push(`\n**Open Positions:** ${(openTrades || []).length} | Unrealized P&L: ${unrealizedPnl >= 0 ? '+' : ''}$${unrealizedPnl.toFixed(2)}`);
  }

  const summary = parts.join('\n');

  const metrics: DailyReportMetrics = {
    signalsGenerated: 0,
    signalsByAction: { BUY: opened.filter((t: any) => t.side === 'BUY').length, SELL: opened.filter((t: any) => t.side === 'SELL').length, HOLD: 0 },
    paperTradesOpened: opened.length,
    paperTradesClosed: closed.length,
    realizedPnlUsd: Math.round(realizedPnl * 100) / 100,
    unrealizedPnlUsd: Math.round(unrealizedPnl * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    avgRiskReward: 0,
    topPerformers,
    worstPerformers,
    circuitBreakerTriggered: false,
    summary,
    tradeRationales: [],
  };

  const { error } = await (supabase.from('fine_tune_report') as any)
    .insert({ user_id: userId, report_date: reportDate, metrics_json: metrics })
    .select()
    .single();

  if (error) {
    console.error(`[Fine-Tune] Report error for ${userId}:`, error);
    return { skipped: false, error: error.message };
  }

  return { skipped: false, summary: summary.substring(0, 200) + '...' };
}
