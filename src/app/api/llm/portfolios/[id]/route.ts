/**
 * LLM Portfolio Detail API Route
 * GET - Get a single LLM portfolio with holdings and enriched market data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLM_ALLOCATIONS } from '@/config/llm-allocations';
import {
  type LLMPortfolioRow,
  type LLMHoldingRow,
  type LLMHoldingEnriched,
  transformPortfolioRow,
  transformHoldingRow,
} from '@/types/llm-portfolio.types';
import { getMarketQuote } from '@/lib/api/market-data';
import * as yahooFinance from '@/lib/api/yahoo-finance';
import type { AssetType, Market } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get portfolio (tables not in generated types, using 'as any')
    const { data: portfolioRow, error: portfolioError } = await (supabase
      .from('llm_portfolio') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolioRow) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    const portfolio = transformPortfolioRow(portfolioRow as LLMPortfolioRow);

    // Get holdings
    const { data: holdingRows, error: holdingsError } = await (supabase
      .from('llm_holding') as any)
      .select('*')
      .eq('portfolio_id', id)
      .order('target_allocation_pct', { ascending: false });

    if (holdingsError) {
      console.error('Error fetching holdings:', holdingsError);
      return NextResponse.json(
        { error: 'Failed to fetch holdings' },
        { status: 500 }
      );
    }

    // Enrich holdings with current market data
    const holdings = (holdingRows || []).map((row: LLMHoldingRow) =>
      transformHoldingRow(row)
    );

    const enrichedHoldings: LLMHoldingEnriched[] = await Promise.all(
      holdings.map(async (holding) => {
        try {
          let currentPrice: number | null = null;

          if (holding.assetType === 'crypto') {
            // For crypto, use Yahoo Finance with -USD suffix
            const yahooSymbol = `${holding.symbol.toUpperCase()}-USD`;
            const quote = await yahooFinance.getQuote(yahooSymbol);
            currentPrice = quote?.price || null;
          } else {
            // Map category to asset type
            const assetType: AssetType =
              holding.assetType === 'etf' ? 'etf' :
              holding.assetType === 'bond' ? 'etf' :
              holding.assetType === 'reit' ? 'etf' :
              holding.assetType === 'commodity' ? 'etf' :
              'stock';

            const market: Market =
              holding.market === 'europe' ? 'europe' :
              holding.market === 'us' ? 'us' : 'us';

            const quote = await getMarketQuote(holding.symbol, assetType, market);
            currentPrice = quote?.price || null;
          }

          const currentValue = currentPrice ? holding.quantity * currentPrice : null;
          const unrealizedPnL = currentValue && holding.totalInvested
            ? currentValue - holding.totalInvested
            : null;
          const unrealizedPnLPct = unrealizedPnL && holding.totalInvested
            ? (unrealizedPnL / holding.totalInvested) * 100
            : null;

          return {
            ...holding,
            currentPrice,
            currentValue,
            unrealizedPnL,
            unrealizedPnLPct,
            actualAllocationPct: null, // Will be calculated below
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

    // Calculate total portfolio value and actual allocations
    const totalHoldingsValue = enrichedHoldings.reduce(
      (sum, h) => sum + (h.currentValue || h.totalInvested),
      0
    );
    const totalPortfolioValue = totalHoldingsValue + portfolio.cashBalance;

    // Update actual allocation percentages
    for (const holding of enrichedHoldings) {
      const holdingValue = holding.currentValue || holding.totalInvested;
      holding.actualAllocationPct = totalPortfolioValue > 0
        ? (holdingValue / totalPortfolioValue) * 100
        : 0;
    }

    // Calculate total return
    const totalReturnPct = totalPortfolioValue > 0
      ? ((totalPortfolioValue - 100000) / 100000) * 100
      : 0;

    // Get allocation config for display info
    const allocationConfig = LLM_ALLOCATIONS[portfolio.provider];

    return NextResponse.json({
      portfolio: {
        ...portfolio,
        totalValue: totalPortfolioValue,
        totalReturnPct,
        displayName: allocationConfig?.displayName || portfolio.provider,
        description: allocationConfig?.description || '',
        strategy: allocationConfig?.strategy || '',
        holdings: enrichedHoldings,
      },
    });
  } catch (error) {
    console.error('LLM portfolio GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}
