/**
 * Expert Investor Portfolios API Route
 * GET - List all expert portfolios for the user
 * POST - Initialize an expert portfolio with predefined allocations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  EXPERT_INVESTORS,
  INVESTOR_SLUGS,
  INITIAL_EXPERT_BALANCE,
  type InvestorSlug,
} from '@/config/expert-investors';
import {
  type ExpertPortfolioRow,
  transformExpertPortfolioRow,
} from '@/types/expert-portfolio.types';
import { getMarketQuote } from '@/lib/api/market-data';
import * as yahooFinance from '@/lib/api/yahoo-finance';
import type { AssetType } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: portfolioRows, error } = await (supabase
      .from('expert_portfolio') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching expert portfolios:', error);
      return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
    }

    const existingPortfolios = (portfolioRows || []).map((row: ExpertPortfolioRow) =>
      transformExpertPortfolioRow(row)
    );

    // Enrich initialized portfolios with live P&L using batch price fetch
    const initializedPortfolios = existingPortfolios.filter(
      (p: any) => p.id && p.isInitialized
    );
    const portfolioIds = initializedPortfolios.map((p: any) => p.id);

    // Cross-investor holdings map: symbol -> [{ investorSlug, displayName, allocationPct }]
    const crossHoldings: Record<string, Array<{ investorSlug: string; displayName: string; allocationPct: number }>> = {};

    if (portfolioIds.length > 0) {
      try {
        // Fetch ALL holdings for ALL initialized portfolios in one query
        const { data: allHoldings } = await (supabase
          .from('expert_holding') as any)
          .select('portfolio_id, symbol, quantity, total_invested, target_allocation_pct')
          .in('portfolio_id', portfolioIds);

        if (allHoldings && allHoldings.length > 0) {
          // Deduplicate symbols and batch-fetch prices via Yahoo Finance
          const uniqueSymbols = [...new Set(allHoldings.map((h: any) => h.symbol as string))];
          const priceMap = new Map<string, number>();

          // Fetch all prices in parallel via Yahoo Finance (no strict rate limit)
          const pricePromises = uniqueSymbols.map(async (symbol) => {
            try {
              const quote = await yahooFinance.getQuote(symbol);
              if (quote?.price) priceMap.set(symbol, quote.price);
            } catch { /* skip failed quotes */ }
          });
          await Promise.all(pricePromises);

          // Group holdings by portfolio and calculate values
          for (const portfolio of initializedPortfolios) {
            const holdings = allHoldings.filter(
              (h: any) => h.portfolio_id === (portfolio as any).id
            );
            if (holdings.length === 0) continue;

            let totalHoldingsValue = 0;
            for (const holding of holdings) {
              const price = priceMap.get(holding.symbol);
              totalHoldingsValue += price
                ? parseFloat(holding.quantity) * price
                : parseFloat(holding.total_invested);
            }

            const totalPortfolioValue = totalHoldingsValue + (portfolio as any).cashBalance;
            (portfolio as any).totalValue = totalPortfolioValue;
            (portfolio as any).totalReturnPct =
              ((totalPortfolioValue - INITIAL_EXPERT_BALANCE) / INITIAL_EXPERT_BALANCE) * 100;

            // Build cross-holdings: actual allocation % for each holding in this portfolio
            const investorSlug = (portfolio as any).investorSlug;
            const investor = EXPERT_INVESTORS[investorSlug as InvestorSlug];
            for (const holding of holdings) {
              const price = priceMap.get(holding.symbol);
              const holdingValue = price
                ? parseFloat(holding.quantity) * price
                : parseFloat(holding.total_invested);
              const actualPct = totalPortfolioValue > 0
                ? (holdingValue / totalPortfolioValue) * 100 : 0;

              if (!crossHoldings[holding.symbol]) crossHoldings[holding.symbol] = [];
              crossHoldings[holding.symbol].push({
                investorSlug,
                displayName: investor?.displayName || investorSlug,
                allocationPct: Math.round(actualPct * 100) / 100,
              });
            }
          }
        }
      } catch (err) {
        console.error('Error enriching expert portfolios:', err);
      }
    }

    const portfolios = INVESTOR_SLUGS.map((slug) => {
      const investor = EXPERT_INVESTORS[slug];
      const existing = existingPortfolios.find((p: any) => p.investorSlug === slug);
      if (existing) {
        return {
          ...existing,
          displayName: investor.displayName,
          fullName: investor.fullName,
          title: investor.title,
          description: investor.description,
          strategy: investor.strategy,
          dataSource: investor.dataSource,
          lastUpdated: investor.lastUpdated,
        };
      }
      return {
        id: null,
        userId: user.id,
        investorSlug: slug,
        isInitialized: false,
        totalValue: INITIAL_EXPERT_BALANCE,
        cashBalance: INITIAL_EXPERT_BALANCE,
        totalReturnPct: 0,
        displayName: investor.displayName,
        fullName: investor.fullName,
        title: investor.title,
        description: investor.description,
        strategy: investor.strategy,
        dataSource: investor.dataSource,
        lastUpdated: investor.lastUpdated,
        createdAt: null,
        updatedAt: null,
      };
    });

    // Only include symbols held by 2+ investors in cross-holdings
    const sharedHoldings: typeof crossHoldings = {};
    for (const [symbol, investors] of Object.entries(crossHoldings)) {
      if (investors.length >= 2) {
        sharedHoldings[symbol] = investors.sort((a, b) => b.allocationPct - a.allocationPct);
      }
    }

    return NextResponse.json({ portfolios, crossHoldings: sharedHoldings });
  } catch (error) {
    console.error('Expert portfolios GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { investorSlug } = body as { investorSlug: InvestorSlug };

    if (!investorSlug || !INVESTOR_SLUGS.includes(investorSlug)) {
      return NextResponse.json({ error: 'Invalid investor' }, { status: 400 });
    }

    // Check if already initialized
    const { data: existing } = await (supabase
      .from('expert_portfolio') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('investor_slug', investorSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Portfolio already initialized for this investor' },
        { status: 409 }
      );
    }

    const investor = EXPERT_INVESTORS[investorSlug];
    const errors: string[] = [];
    let holdingsCreated = 0;
    let transactionsCreated = 0;

    // Create portfolio record
    const { data: portfolio, error: portfolioError } = await (supabase
      .from('expert_portfolio') as any)
      .insert({
        user_id: user.id,
        investor_slug: investorSlug,
        is_initialized: false,
        total_value: INITIAL_EXPERT_BALANCE,
        cash_balance: INITIAL_EXPERT_BALANCE,
        total_return_pct: 0,
      })
      .select()
      .single();

    if (portfolioError || !portfolio) {
      console.error('Error creating expert portfolio:', portfolioError);
      return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
    }

    let remainingCash = INITIAL_EXPERT_BALANCE;

    for (const item of investor.holdings) {
      try {
        const targetAmount = (INITIAL_EXPERT_BALANCE * item.allocationPct) / 100;

        // Get current price - all expert investor holdings are US stocks/ETFs
        const assetType: AssetType = item.category === 'etf' ? 'etf' : 'stock';
        const quote = await getMarketQuote(item.symbol, assetType, 'us');
        const currentPrice = quote?.price || null;

        if (!currentPrice) {
          errors.push(`Could not get price for ${item.symbol}`);
          continue;
        }

        const quantity = targetAmount / currentPrice;
        const actualInvested = quantity * currentPrice;

        // Create holding
        const { error: holdingError } = await (supabase
          .from('expert_holding') as any)
          .insert({
            portfolio_id: portfolio.id,
            symbol: item.symbol,
            asset_name: item.name,
            asset_type: item.category,
            market: item.market,
            target_allocation_pct: item.allocationPct,
            quantity,
            average_buy_price: currentPrice,
            total_invested: actualInvested,
          });

        if (holdingError) {
          errors.push(`Failed to create holding for ${item.symbol}: ${holdingError.message}`);
          continue;
        }
        holdingsCreated++;

        // Create transaction
        const { error: txError } = await (supabase
          .from('expert_transaction') as any)
          .insert({
            portfolio_id: portfolio.id,
            symbol: item.symbol,
            transaction_type: 'buy',
            quantity,
            price_per_unit: currentPrice,
            total_amount: actualInvested,
            notes: `Initial allocation: ${item.allocationPct}% (${investor.displayName})`,
          });

        if (!txError) transactionsCreated++;
        remainingCash -= actualInvested;
      } catch (err) {
        errors.push(`Error processing ${item.symbol}: ${err}`);
      }
    }

    // Update portfolio with final values
    await (supabase
      .from('expert_portfolio') as any)
      .update({
        is_initialized: true,
        cash_balance: remainingCash,
        total_value: INITIAL_EXPERT_BALANCE,
        total_return_pct: 0,
      })
      .eq('id', portfolio.id);

    // Create initial snapshot
    await (supabase
      .from('expert_portfolio_snapshot') as any)
      .insert({
        portfolio_id: portfolio.id,
        total_value: INITIAL_EXPERT_BALANCE,
        total_return_pct: 0,
        snapshot_date: new Date().toISOString().split('T')[0],
      });

    return NextResponse.json({
      success: true,
      portfolio: transformExpertPortfolioRow(portfolio),
      holdingsCreated,
      transactionsCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Expert portfolio POST error:', error);
    return NextResponse.json({ error: 'Failed to initialize portfolio' }, { status: 500 });
  }
}
