/**
 * Coach Analyze API Route
 * POST - Run analysis for symbols
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAnalysisSchema } from '@/schemas/coach.schema';
import { runBatchAnalysis, parseWatchSymbol } from '@/lib/coach/engine/coachEngine';
import { DEFAULT_COACH_CONFIG } from '@/lib/coach/types';
import type { OHLCData } from '@/lib/coach/types';
import type { AssetType, Market } from '@/types';
import { getHistoricalData as getCryptoHistorical, searchCrypto } from '@/lib/api/coingecko';
import { getHistoricalData as getYahooHistorical } from '@/lib/api/yahoo-finance';
import { getMarketQuote } from '@/lib/api/market-data';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = runAnalysisSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { symbols: requestedSymbols, forceRun } = validation.data;

    // Get user's coach config (coach tables not in generated types, using 'as any')
    const { data: configRow } = await (supabase
      .from('coach_config') as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Transform or use default
    const config = configRow
      ? transformConfigRow(configRow)
      : { ...DEFAULT_COACH_CONFIG, userId: user.id };

    // Check kill switch
    if (config.killSwitch && !forceRun) {
      return NextResponse.json({
        success: false,
        signalsGenerated: 0,
        signals: [],
        killSwitchActive: true,
        message: 'Kill switch is active. Use forceRun to override.',
      });
    }

    // Determine symbols to analyze
    let symbolsToAnalyze: Array<{ symbol: string; assetType: AssetType; market: Market }> = [];

    if (requestedSymbols && requestedSymbols.length > 0) {
      // Parse requested symbols
      for (const s of requestedSymbols) {
        const parsed = parseWatchSymbol(s);
        if (parsed) {
          symbolsToAnalyze.push(parsed);
        }
      }
    } else if (config.watchSymbols.length > 0) {
      // Use watchlist
      for (const s of config.watchSymbols) {
        const parsed = parseWatchSymbol(s);
        if (parsed) {
          symbolsToAnalyze.push(parsed);
        }
      }
    }

    if (symbolsToAnalyze.length === 0) {
      return NextResponse.json({
        success: false,
        signalsGenerated: 0,
        signals: [],
        message: 'No symbols to analyze. Add symbols to your watchlist or specify in request.',
      });
    }

    // Get portfolio state
    const portfolioState = await getPortfolioState(supabase, user.id);

    // Define market data fetcher
    const fetchMarketData = async (
      symbol: string,
      assetType: AssetType,
      market: Market
    ): Promise<{ currentPrice: number; ohlcData: OHLCData[] } | null> => {
      try {
        // Get current price
        const quote = await getMarketQuote(symbol, assetType, market);
        if (!quote) {
          console.log(`No quote found for ${symbol}`);
          return null;
        }

        // Get historical data (90 days for proper indicator calculation)
        let historicalData: any[] | null = null;

        if (assetType === 'crypto') {
          // For crypto, first convert symbol to coin ID
          const searchResults = await searchCrypto(symbol);
          const coin = searchResults.find(
            (c) => c.symbol.toLowerCase() === symbol.toLowerCase()
          );

          if (!coin) {
            console.log(`Crypto coin ID not found for symbol ${symbol}`);
            return null;
          }

          historicalData = await getCryptoHistorical(coin.id, 90);

          // CoinGecko returns simplified format, convert to pseudo-OHLC
          if (historicalData) {
            historicalData = historicalData.map((d: any) => ({
              date: d.date,
              open: d.price,
              high: d.price,
              low: d.price,
              close: d.price,
              volume: 0,
            }));
          }
        } else {
          // All stocks/ETFs use Yahoo Finance (works for US, Europe, Colombia)
          historicalData = await getYahooHistorical(symbol, 90);
        }

        if (!historicalData || historicalData.length < 20) {
          console.log(`Insufficient historical data for ${symbol}: ${historicalData?.length || 0} days`);
          return null;
        }

        // Transform to OHLC format
        const ohlcData: OHLCData[] = historicalData.map((d: any) => ({
          timestamp: new Date(d.date).getTime(),
          open: d.open || d.close,
          high: d.high || d.close,
          low: d.low || d.close,
          close: d.close,
          volume: d.volume || 0,
        }));

        return {
          currentPrice: quote.price,
          ohlcData,
        };
      } catch (error) {
        console.error(`Error fetching market data for ${symbol}:`, error);
        return null;
      }
    };

    // Run analysis
    const result = await runBatchAnalysis(
      symbolsToAnalyze,
      fetchMarketData,
      config,
      portfolioState
    );

    // Save signals to database
    for (const signal of result.signals) {
      await (supabase.from('coach_signal') as any).insert({
        user_id: user.id,
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
        acknowledged: false,
      });
    }

    return NextResponse.json({
      success: result.success,
      signalsGenerated: result.signalsGenerated,
      signals: result.signals,
      errors: result.errors,
      killSwitchActive: result.killSwitchActive,
      circuitBreakerActive: result.circuitBreakerActive,
    });
  } catch (error) {
    console.error('Coach analyze error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}

/**
 * Get portfolio state for risk assessment
 */
async function getPortfolioState(supabase: any, userId: string) {
  // Get balance
  const { data: balance } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const availableCash = balance ? parseFloat(balance.available_cash) : 100000;
  const totalInvested = balance ? parseFloat(balance.total_invested) : 0;
  const totalValue = availableCash + totalInvested;

  // Get open paper trades count
  const { count: openPositions } = await supabase
    .from('coach_paper_trade')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'open');

  // Get today's P&L from closed trades
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

  // Get consecutive losses
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
function transformConfigRow(row: any) {
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
