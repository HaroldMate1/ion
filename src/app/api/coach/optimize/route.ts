/**
 * Coach Optimization API Route
 * Runs backtesting with grid search to find optimal agent weights
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { backtestSymbol, aggregateResults } from '@/lib/coach/backtester';
import type { BacktestConfig } from '@/lib/coach/backtester';
import { getHistoricalData } from '@/lib/api/yahoo-finance';
import type { OHLCData } from '@/lib/coach/types';
import type { AssetType, Market } from '@/types';

export const maxDuration = 120; // Allow up to 2 minutes

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const symbols: Array<{ symbol: string; assetType: AssetType; market: Market }> =
      body.symbols || [
        { symbol: 'AAPL', assetType: 'stock', market: 'us' },
        { symbol: 'MSFT', assetType: 'stock', market: 'us' },
        { symbol: 'GOOGL', assetType: 'stock', market: 'us' },
        { symbol: 'AMZN', assetType: 'stock', market: 'us' },
        { symbol: 'TSLA', assetType: 'stock', market: 'us' },
      ];

    const lookbackDays = body.lookbackDays || 180;
    const weightStep = body.weightStep || 0.05;

    const config: Partial<BacktestConfig> = {
      lookbackDays,
      warmupBars: 50,
      weightStep,
      initialCapital: 100000,
      positionSizePct: body.positionSizePct || 10,
      stopLossPct: body.stopLossPct || 3,
      takeProfitPct: body.takeProfitPct || 6,
    };

    // Fetch historical data and run backtest for each symbol
    const results = [];
    const errors: string[] = [];

    for (const { symbol, assetType, market } of symbols) {
      try {
        // Get historical OHLC data via Yahoo Finance
        const yahooSymbol = assetType === 'crypto' ? `${symbol}-USD` : symbol;
        const historicalData = await getHistoricalData(yahooSymbol, lookbackDays);

        if (!historicalData || historicalData.length < 60) {
          errors.push(`${symbol}: Insufficient data (${historicalData?.length || 0} days)`);
          continue;
        }

        const ohlcData: OHLCData[] = historicalData.map((d: any) => ({
          timestamp: new Date(d.date).getTime(),
          open: d.open || d.close,
          high: d.high || d.close,
          low: d.low || d.close,
          close: d.close,
          volume: d.volume || 0,
        }));

        const result = backtestSymbol(ohlcData, symbol, assetType, market, config);

        // Strip equity curve for smaller response (keep every 5th point)
        const trimmedResult = {
          ...result,
          bestWeights: {
            ...result.bestWeights,
            equityCurve: result.bestWeights.equityCurve.filter((_, i) =>
              i % 5 === 0 || i === result.bestWeights.equityCurve.length - 1
            ),
          },
          defaultWeights: {
            ...result.defaultWeights,
            equityCurve: result.defaultWeights.equityCurve.filter((_, i) =>
              i % 5 === 0 || i === result.defaultWeights.equityCurve.length - 1
            ),
          },
          // Only send top 5 to save bandwidth
          allResults: result.allResults.slice(0, 5).map(r => ({
            ...r,
            equityCurve: [], // Don't send all equity curves
          })),
          dailyProposals: [], // Don't send raw proposals
        };

        results.push(trimmedResult);
      } catch (err: any) {
        errors.push(`${symbol}: ${err.message}`);
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        error: 'No symbols could be backtested',
        details: errors,
      }, { status: 400 });
    }

    const aggregated = aggregateResults(results);

    return NextResponse.json({
      ...aggregated,
      results: results, // Overwrite with trimmed results
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Optimization API error:', error);
    return NextResponse.json(
      { error: error.message || 'Optimization failed' },
      { status: 500 }
    );
  }
}
