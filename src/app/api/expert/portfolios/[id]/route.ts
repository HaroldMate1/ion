/**
 * Expert Portfolio Detail API Route
 * GET - Get a single expert portfolio with holdings and enriched market data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EXPERT_INVESTORS } from '@/config/expert-investors';
import {
  type ExpertPortfolioRow,
  type ExpertHoldingRow,
  type ExpertHoldingEnriched,
  transformExpertPortfolioRow,
  transformExpertHoldingRow,
} from '@/types/expert-portfolio.types';
import { getMarketQuote } from '@/lib/api/market-data';
import type { AssetType } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: portfolioRow, error: portfolioError } = await (supabase
      .from('expert_portfolio') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolioRow) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    const portfolio = transformExpertPortfolioRow(portfolioRow as ExpertPortfolioRow);

    const { data: holdingRows, error: holdingsError } = await (supabase
      .from('expert_holding') as any)
      .select('*')
      .eq('portfolio_id', id)
      .order('target_allocation_pct', { ascending: false });

    if (holdingsError) {
      console.error('Error fetching expert holdings:', holdingsError);
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }

    const holdings = (holdingRows || []).map((row: ExpertHoldingRow) =>
      transformExpertHoldingRow(row)
    );

    // Enrich holdings with current market data
    const enrichedHoldings: ExpertHoldingEnriched[] = await Promise.all(
      holdings.map(async (holding) => {
        try {
          const assetType: AssetType = holding.assetType === 'etf' ? 'etf' : 'stock';
          const quote = await getMarketQuote(holding.symbol, assetType, 'us');
          const currentPrice = quote?.price || null;

          const currentValue = currentPrice ? holding.quantity * currentPrice : null;
          const unrealizedPnL = currentValue && holding.totalInvested
            ? currentValue - holding.totalInvested : null;
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
        } catch (error) {
          console.error(`Error enriching holding ${holding.symbol}:`, error);
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

    const investorConfig = EXPERT_INVESTORS[portfolio.investorSlug];

    return NextResponse.json({
      portfolio: {
        ...portfolio,
        totalValue: totalPortfolioValue,
        totalReturnPct,
        displayName: investorConfig?.displayName || portfolio.investorSlug,
        fullName: investorConfig?.fullName || '',
        title: investorConfig?.title || '',
        description: investorConfig?.description || '',
        strategy: investorConfig?.strategy || '',
        dataSource: investorConfig?.dataSource || '',
        lastUpdated: investorConfig?.lastUpdated || '',
        holdings: enrichedHoldings,
      },
    });
  } catch (error) {
    console.error('Expert portfolio GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}
