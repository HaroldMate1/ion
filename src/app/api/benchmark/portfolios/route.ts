/**
 * Benchmark Portfolios API Route
 * GET - List all benchmark portfolios
 * POST - Initialize a benchmark portfolio with individual stock holdings
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

    const portfolios = BENCHMARK_SLUGS.map((slug) => {
      const bench = BENCHMARKS[slug];
      const found = existing.find((p: any) => p.benchmarkSlug === slug);

      if (found) {
        return { ...found, ...bench };
      }

      return {
        id: null,
        userId: user.id,
        benchmarkSlug: slug,
        isInitialized: false,
        totalValue: INITIAL_BENCHMARK_BALANCE,
        cashBalance: INITIAL_BENCHMARK_BALANCE,
        totalReturnPct: 0,
        createdAt: null,
        updatedAt: null,
        ...bench,
      };
    });

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
    const errors: string[] = [];
    let holdingsCreated = 0;

    // Create portfolio
    const { data: portfolio, error: insertError } = await (supabase
      .from('benchmark_portfolio') as any)
      .insert({
        user_id: user.id,
        benchmark_slug: benchmarkSlug,
        is_initialized: false,
        total_value: INITIAL_BENCHMARK_BALANCE,
        cash_balance: INITIAL_BENCHMARK_BALANCE,
        total_return_pct: 0,
      })
      .select()
      .single();

    if (insertError || !portfolio) {
      console.error('Error creating benchmark portfolio:', insertError);
      return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
    }

    let remainingCash = INITIAL_BENCHMARK_BALANCE;

    // Buy each holding based on allocation
    for (const item of bench.holdings) {
      try {
        const targetAmount = (INITIAL_BENCHMARK_BALANCE * item.allocationPct) / 100;

        const quote = await getMarketQuote(item.symbol, 'stock', 'us');
        const currentPrice = quote?.price || null;

        if (!currentPrice) {
          errors.push(`Could not get price for ${item.symbol}`);
          continue;
        }

        const quantity = targetAmount / currentPrice;
        const actualInvested = quantity * currentPrice;

        // Create holding
        const { error: holdingError } = await (supabase
          .from('benchmark_holding') as any)
          .insert({
            portfolio_id: portfolio.id,
            symbol: item.symbol,
            asset_name: item.name,
            asset_type: 'stock',
            target_allocation_pct: item.allocationPct,
            quantity,
            average_buy_price: currentPrice,
            total_invested: actualInvested,
          });

        if (holdingError) {
          errors.push(`Failed to create holding for ${item.symbol}`);
          continue;
        }
        holdingsCreated++;

        // Create transaction
        await (supabase.from('benchmark_transaction') as any).insert({
          portfolio_id: portfolio.id,
          symbol: item.symbol,
          transaction_type: 'buy',
          quantity,
          price_per_unit: currentPrice,
          total_amount: actualInvested,
          notes: `${bench.displayName} allocation: ${item.allocationPct}%`,
        });

        remainingCash -= actualInvested;
      } catch (err) {
        errors.push(`Error processing ${item.symbol}: ${err}`);
      }
    }

    // Update portfolio
    await (supabase.from('benchmark_portfolio') as any)
      .update({
        is_initialized: true,
        cash_balance: remainingCash,
        total_value: INITIAL_BENCHMARK_BALANCE,
        total_return_pct: 0,
      })
      .eq('id', portfolio.id);

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
      holdingsCreated,
      errors: errors.length > 0 ? errors : undefined,
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
