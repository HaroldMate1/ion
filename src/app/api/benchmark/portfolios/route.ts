/**
 * Benchmark Portfolios API Route
 * GET - List all benchmark portfolios
 * POST - Initialize a benchmark portfolio (buy SPY or QQQ with full $100k)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  BENCHMARKS,
  BENCHMARK_SLUGS,
  INITIAL_BENCHMARK_BALANCE,
  type BenchmarkSlug,
} from '@/config/benchmark-indexes';
import { getMarketQuote } from '@/lib/api/market-data';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: rows, error } = await (supabase
      .from('benchmark_portfolio') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching benchmark portfolios:', error);
      return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
    }

    const existing = (rows || []).map(transformRow);

    const portfolios = await Promise.all(
      BENCHMARK_SLUGS.map(async (slug) => {
        const bench = BENCHMARKS[slug];
        const found = existing.find((p: any) => p.benchmarkSlug === slug);

        if (found && found.isInitialized) {
          // Get holdings with live prices
          const { data: holdingRows } = await (supabase
            .from('benchmark_holding') as any)
            .select('*')
            .eq('portfolio_id', found.id);

          let totalValue = found.cashBalance;
          const enrichedHoldings = [];

          for (const row of (holdingRows || [])) {
            const holding = transformHolding(row);
            const quote = await getMarketQuote(holding.symbol, 'etf', 'us');
            const currentPrice = quote?.price || null;
            const currentValue = currentPrice ? holding.quantity * currentPrice : holding.totalInvested;
            const unrealizedPnL = currentValue - holding.totalInvested;
            const unrealizedPnLPct = holding.totalInvested > 0 ? (unrealizedPnL / holding.totalInvested) * 100 : 0;

            totalValue += currentValue;
            enrichedHoldings.push({
              ...holding,
              currentPrice,
              currentValue,
              unrealizedPnL,
              unrealizedPnLPct,
            });
          }

          const totalReturnPct = ((totalValue - INITIAL_BENCHMARK_BALANCE) / INITIAL_BENCHMARK_BALANCE) * 100;

          return {
            ...found,
            totalValue,
            totalReturnPct,
            holdings: enrichedHoldings,
            ...bench,
          };
        }

        return {
          id: null,
          userId: user.id,
          benchmarkSlug: slug,
          isInitialized: false,
          totalValue: INITIAL_BENCHMARK_BALANCE,
          cashBalance: INITIAL_BENCHMARK_BALANCE,
          totalReturnPct: 0,
          holdings: [],
          createdAt: null,
          updatedAt: null,
          ...bench,
        };
      })
    );

    return NextResponse.json({ portfolios });
  } catch (error) {
    console.error('Benchmark portfolios GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { benchmarkSlug } = body as { benchmarkSlug: BenchmarkSlug };

    if (!benchmarkSlug || !BENCHMARK_SLUGS.includes(benchmarkSlug)) {
      return NextResponse.json({ error: 'Invalid benchmark' }, { status: 400 });
    }

    const { data: existing } = await (supabase
      .from('benchmark_portfolio') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('benchmark_slug', benchmarkSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Benchmark already initialized' }, { status: 409 });
    }

    const bench = BENCHMARKS[benchmarkSlug];
    const etf = bench.holdings[0]; // Single ETF holding

    // Get ETF price
    const quote = await getMarketQuote(etf.symbol, 'etf', 'us');
    if (!quote?.price) {
      return NextResponse.json({ error: `Could not get price for ${etf.symbol}` }, { status: 500 });
    }

    const quantity = INITIAL_BENCHMARK_BALANCE / quote.price;
    const totalInvested = quantity * quote.price;
    const cashBalance = INITIAL_BENCHMARK_BALANCE - totalInvested;

    // Create portfolio
    const { data: portfolio, error: insertError } = await (supabase
      .from('benchmark_portfolio') as any)
      .insert({
        user_id: user.id,
        benchmark_slug: benchmarkSlug,
        is_initialized: true,
        total_value: INITIAL_BENCHMARK_BALANCE,
        cash_balance: cashBalance,
        total_return_pct: 0,
      })
      .select()
      .single();

    if (insertError || !portfolio) {
      console.error('Error creating benchmark portfolio:', insertError);
      return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
    }

    // Create single holding (the ETF)
    await (supabase.from('benchmark_holding') as any).insert({
      portfolio_id: portfolio.id,
      symbol: etf.symbol,
      asset_name: etf.name,
      asset_type: 'etf',
      target_allocation_pct: 100,
      quantity,
      average_buy_price: quote.price,
      total_invested: totalInvested,
    });

    // Create transaction
    await (supabase.from('benchmark_transaction') as any).insert({
      portfolio_id: portfolio.id,
      symbol: etf.symbol,
      transaction_type: 'buy',
      quantity,
      price_per_unit: quote.price,
      total_amount: totalInvested,
      notes: `Full $100k into ${etf.symbol} (${bench.displayName} - all ${bench.totalStocks} stocks)`,
    });

    // Initial snapshot
    await (supabase.from('benchmark_snapshot') as any).insert({
      portfolio_id: portfolio.id,
      total_value: INITIAL_BENCHMARK_BALANCE,
      total_return_pct: 0,
      snapshot_date: new Date().toISOString().split('T')[0],
    });

    return NextResponse.json({
      success: true,
      portfolio: { ...transformRow(portfolio), ...bench },
      currentPrice: quote.price,
      sharesOwned: quantity,
    });
  } catch (error) {
    console.error('Benchmark portfolio POST error:', error);
    return NextResponse.json({ error: 'Failed to initialize benchmark' }, { status: 500 });
  }
}

function transformRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    benchmarkSlug: row.benchmark_slug,
    isInitialized: row.is_initialized,
    totalValue: parseFloat(row.total_value),
    cashBalance: parseFloat(row.cash_balance),
    totalReturnPct: parseFloat(row.total_return_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transformHolding(row: any) {
  return {
    id: row.id,
    symbol: row.symbol,
    assetName: row.asset_name,
    assetType: row.asset_type,
    targetAllocationPct: parseFloat(row.target_allocation_pct),
    quantity: parseFloat(row.quantity),
    averageBuyPrice: parseFloat(row.average_buy_price),
    totalInvested: parseFloat(row.total_invested),
  };
}
