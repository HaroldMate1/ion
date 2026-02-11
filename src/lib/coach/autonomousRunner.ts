/**
 * Autonomous Coach Runner
 * Shared logic for running analysis, auto-executing trades, and auto-closing trades.
 * Used by both the manual analyze API route and the cron job.
 */

import { runBatchAnalysis, parseWatchSymbol } from '@/lib/coach/engine/coachEngine';
import { DEFAULT_COACH_CONFIG } from '@/lib/coach/types';
import type { OHLCData, DailyReportMetrics } from '@/lib/coach/types';
import type { AssetType, Market } from '@/types';
import { getHistoricalData as getYahooHistorical } from '@/lib/api/yahoo-finance';
import { getMarketQuote } from '@/lib/api/market-data';
import { calculatePnL, checkStopLoss, checkTakeProfits } from '@/lib/coach/risk/riskEngine';
import type { TakeProfitLevel } from '@/lib/coach/types';

/**
 * Get portfolio state for risk assessment
 */
export async function getPortfolioState(supabase: any, userId: string) {
  const { data: balance } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const availableCash = balance ? parseFloat(balance.available_cash) : 100000;
  const totalInvested = balance ? parseFloat(balance.total_invested) : 0;
  const totalValue = availableCash + totalInvested;

  const { count: openPositions } = await supabase
    .from('coach_paper_trade')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'open');

  const today = new Date().toISOString().split('T')[0];
  const { data: todayTrades } = await supabase
    .from('coach_paper_trade')
    .select('pnl_usd')
    .eq('user_id', userId)
    .gte('closed_at', today)
    .not('pnl_usd', 'is', null);

  const todayPnL = todayTrades
    ? todayTrades.reduce((sum: number, t: any) => sum + parseFloat(t.pnl_usd || 0), 0)
    : 0;
  const todayPnLPercent = totalValue > 0 ? (todayPnL / totalValue) * 100 : 0;

  const { data: recentTrades } = await supabase
    .from('coach_paper_trade')
    .select('pnl_usd')
    .eq('user_id', userId)
    .not('pnl_usd', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(10);

  let consecutiveLosses = 0;
  if (recentTrades) {
    for (const trade of recentTrades) {
      if (parseFloat(trade.pnl_usd) < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }
  }

  return {
    totalValue,
    availableCash,
    openPositions: openPositions || 0,
    todayPnL,
    todayPnLPercent,
    consecutiveLosses,
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

  // Parse watch symbols
  const symbolsToAnalyze: Array<{ symbol: string; assetType: AssetType; market: Market }> = [];
  for (const s of config.watchSymbols) {
    const parsed = parseWatchSymbol(s);
    if (parsed) symbolsToAnalyze.push(parsed);
  }

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
      if (openPositionsCount >= config.riskParams.maxOpenPositions) continue;

      const { data: existingTrade } = await (supabase.from('coach_paper_trade') as any)
        .select('id')
        .eq('user_id', userId)
        .eq('symbol', signal.symbol)
        .eq('status', 'open')
        .maybeSingle();

      if (existingTrade) continue;

      const maxAllocation = (portfolioState.totalValue * config.riskParams.maxAllocationPct) / 100;
      const sizeUsd = Math.min(maxAllocation, portfolioState.availableCash);
      if (sizeUsd < 10) continue;

      const quantity = sizeUsd / signal.currentPrice;

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
        notes: `Auto-executed by coach. Score: ${((signal.consensusScore || 0) * 100).toFixed(0)}%`,
      });

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
