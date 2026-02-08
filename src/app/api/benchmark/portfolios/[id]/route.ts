/**
 * Benchmark Portfolio Detail API Route
 * GET - Get a single benchmark portfolio with holdings and enriched market data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BENCHMARKS } from '@/config/benchmark-indexes';
import { getMarketQuote } from '@/lib/api/market-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get portfolio
    const { data: portfolioRow, error: portfolioError } = await (supabase
      .from('benchmark_portfolio') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolioRow) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const portfolio = {
      id: portfolioRow.id,
      userId: portfolioRow.user_id,
      benchmarkSlug: portfolioRow.benchmark_slug,
      isInitialized: portfolioRow.is_initialized,
      totalValue: parseFloat(portfolioRow.total_value),
      cashBalance: parseFloat(portfolioRow.cash_balance),
      totalReturnPct: parseFloat(portfolioRow.total_return_pct),
      createdAt: portfolioRow.created_at,
      updatedAt: portfolioRow.updated_at,
    };

    // Get holdings
    const { data: holdingRows, error: holdingsError } = await (supabase
      .from('benchmark_holding') as any)
      .select('*')
      .eq('portfolio_id', id)
      .order('target_allocation_pct', { ascending: false });

    if (holdingsError) {
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }

    // Enrich with current prices
    const enrichedHoldings = await Promise.all(
      (holdingRows || []).map(async (row: any) => {
        const holding = {
          id: row.id,
          symbol: row.symbol,
          assetName: row.asset_name,
          assetType: row.asset_type,
          targetAllocationPct: parseFloat(row.target_allocation_pct),
          quantity: parseFloat(row.quantity),
          averageBuyPrice: parseFloat(row.average_buy_price),
          totalInvested: parseFloat(row.total_invested),
        };

        try {
          const quote = await getMarketQuote(holding.symbol, 'stock', 'us');
          const currentPrice = quote?.price || null;
          const currentValue = currentPrice ? holding.quantity * currentPrice : null;
          const unrealizedPnL = currentValue ? currentValue - holding.totalInvested : null;
          const unrealizedPnLPct = unrealizedPnL && holding.totalInvested
            ? (unrealizedPnL / holding.totalInvested) * 100 : null;

          return {
            ...holding,
            currentPrice,
            currentValue,
            unrealizedPnL,
            unrealizedPnLPct,
            actualAllocationPct: null,
          };
        } catch {
          return {
            ...holding,
            currentPrice: null,
            currentValue: null,
            unrealizedPnL: null,
            unrealizedPnLPct: null,
            actualAllocationPct: null,
          };
        }
      })
    );

    // Calculate totals
    const totalHoldingsValue = enrichedHoldings.reduce(
      (sum, h) => sum + (h.currentValue || h.totalInvested), 0
    );
    const totalPortfolioValue = totalHoldingsValue + portfolio.cashBalance;

    for (const holding of enrichedHoldings) {
      const holdingValue = holding.currentValue || holding.totalInvested;
      holding.actualAllocationPct = totalPortfolioValue > 0
        ? (holdingValue / totalPortfolioValue) * 100 : 0;
    }

    const totalReturnPct = ((totalPortfolioValue - 100000) / 100000) * 100;
    const benchConfig = BENCHMARKS[portfolio.benchmarkSlug as keyof typeof BENCHMARKS];

    return NextResponse.json({
      portfolio: {
        ...portfolio,
        totalValue: totalPortfolioValue,
        totalReturnPct,
        ...benchConfig,
        holdings: enrichedHoldings,
      },
    });
  } catch (error) {
    console.error('Benchmark portfolio detail GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}
