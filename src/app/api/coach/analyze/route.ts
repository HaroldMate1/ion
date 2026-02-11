/**
 * Coach Analyze API Route
 * POST - Run analysis for symbols
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAnalysisSchema } from '@/schemas/coach.schema';
import { runBatchAnalysis, parseWatchSymbol } from '@/lib/coach/engine/coachEngine';
import { DEFAULT_COACH_CONFIG } from '@/lib/coach/types';
import type { AssetType, Market } from '@/types';
import {
  getPortfolioState,
  transformConfigRow,
  fetchMarketData,
} from '@/lib/coach/autonomousRunner';

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
      for (const s of requestedSymbols) {
        const parsed = parseWatchSymbol(s);
        if (parsed) {
          symbolsToAnalyze.push(parsed);
        }
      }
    } else if (config.watchSymbols.length > 0) {
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

    // Run analysis
    const result = await runBatchAnalysis(
      symbolsToAnalyze,
      fetchMarketData,
      config,
      portfolioState
    );

    // Save signals to database and auto-execute trades
    const autoExecutedTrades: Array<{ symbol: string; side: string; sizeUsd: number }> = [];
    let openPositionsCount = portfolioState.openPositions;

    for (const signal of result.signals) {
      // Save signal and get its ID
      const { data: savedSignal } = await (supabase.from('coach_signal') as any)
        .insert({
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
          acknowledged: true,
        })
        .select('id')
        .single();

      // Auto-execute BUY/SELL signals
      if (signal.consensusAction !== 'HOLD' && signal.currentPrice && !signal.isStale) {
        // Check for duplicate open trade on same symbol
        const { data: existingTrade } = await (supabase.from('coach_paper_trade') as any)
          .select('id')
          .eq('user_id', user.id)
          .eq('symbol', signal.symbol)
          .eq('status', 'open')
          .maybeSingle();

        if (existingTrade) continue;

        // Position sizing: up to 15% of portfolio, capped by available cash
        const sizeUsd = Math.min(portfolioState.availableCash, portfolioState.totalValue * 0.15);

        if (sizeUsd < 10) continue;

        const quantity = sizeUsd / signal.currentPrice;

        // Create paper trade
        await (supabase.from('coach_paper_trade') as any).insert({
          user_id: user.id,
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

        // Mark signal as acknowledged
        if (savedSignal?.id) {
          await (supabase.from('coach_signal') as any)
            .update({ acknowledged: true })
            .eq('id', savedSignal.id);
        }

        openPositionsCount++;
        autoExecutedTrades.push({
          symbol: signal.symbol,
          side: signal.consensusAction,
          sizeUsd,
        });
      }
    }

    return NextResponse.json({
      success: result.success,
      signalsGenerated: result.signalsGenerated,
      signals: result.signals,
      errors: result.errors,
      killSwitchActive: result.killSwitchActive,
      circuitBreakerActive: result.circuitBreakerActive,
      autoExecutedTrades,
    });
  } catch (error) {
    console.error('Coach analyze error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    );
  }
}
