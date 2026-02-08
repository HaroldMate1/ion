/**
 * Benchmark Portfolios API Route
 * GET - List all benchmark portfolios
 * POST - Initialize a benchmark portfolio (buy SPY or QQQ with $100k)
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

    // Enrich with current prices for initialized portfolios
    const portfolios = await Promise.all(
      BENCHMARK_SLUGS.map(async (slug) => {
        const bench = BENCHMARKS[slug];
        const found = existing.find((p: any) => p.benchmarkSlug === slug);

        if (found && found.isInitialized) {
          // Get current price to calculate live value
          const quote = await getMarketQuote(bench.symbol, 'etf', 'us');
          const currentPrice = quote?.price || null;
          const currentValue = currentPrice
            ? found.quantity * currentPrice + found.cashBalance
            : found.totalValue;
          const totalReturnPct = ((currentValue - INITIAL_BENCHMARK_BALANCE) / INITIAL_BENCHMARK_BALANCE) * 100;

          return {
            ...found,
            totalValue: currentValue,
            totalReturnPct,
            currentPrice,
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
          quantity: 0,
          averageBuyPrice: 0,
          totalInvested: 0,
          currentPrice: null,
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

    // Get current price of the ETF
    const quote = await getMarketQuote(bench.symbol, 'etf', 'us');
    if (!quote?.price) {
      return NextResponse.json({ error: `Could not get price for ${bench.symbol}` }, { status: 500 });
    }

    const quantity = INITIAL_BENCHMARK_BALANCE / quote.price;
    const totalInvested = quantity * quote.price;
    const cashBalance = INITIAL_BENCHMARK_BALANCE - totalInvested;

    const { data: portfolio, error: insertError } = await (supabase
      .from('benchmark_portfolio') as any)
      .insert({
        user_id: user.id,
        benchmark_slug: benchmarkSlug,
        is_initialized: true,
        total_value: INITIAL_BENCHMARK_BALANCE,
        cash_balance: cashBalance,
        total_return_pct: 0,
        quantity,
        average_buy_price: quote.price,
        total_invested: totalInvested,
      })
      .select()
      .single();

    if (insertError || !portfolio) {
      console.error('Error creating benchmark portfolio:', insertError);
      return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
    }

    // Create initial snapshot
    await (supabase.from('benchmark_snapshot') as any).insert({
      portfolio_id: portfolio.id,
      total_value: INITIAL_BENCHMARK_BALANCE,
      total_return_pct: 0,
      snapshot_date: new Date().toISOString().split('T')[0],
    });

    return NextResponse.json({
      success: true,
      portfolio: {
        ...transformRow(portfolio),
        currentPrice: quote.price,
        ...bench,
      },
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
    quantity: parseFloat(row.quantity),
    averageBuyPrice: parseFloat(row.average_buy_price),
    totalInvested: parseFloat(row.total_invested),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
