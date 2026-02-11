/**
 * LLM Portfolios API Route
 * GET - List all LLM portfolios for the user
 * POST - Initialize a new LLM portfolio with predefined allocations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  LLM_ALLOCATIONS,
  LLM_PROVIDERS,
  INITIAL_PORTFOLIO_BALANCE,
  type LLMProvider,
} from '@/config/llm-allocations';
import {
  type LLMPortfolioRow,
  transformPortfolioRow,
} from '@/types/llm-portfolio.types';
import { getMarketQuote } from '@/lib/api/market-data';
import * as yahooFinance from '@/lib/api/yahoo-finance';
import type { AssetType, Market } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all LLM portfolios for the user (tables not in generated types, using 'as any')
    const { data: portfolioRows, error } = await (supabase
      .from('llm_portfolio') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching LLM portfolios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch portfolios' },
        { status: 500 }
      );
    }

    // Transform and organize by provider
    const existingPortfolios = (portfolioRows || []).map((row: LLMPortfolioRow) =>
      transformPortfolioRow(row)
    );

    // Enrich initialized portfolios with live P&L using batch price fetch
    const initializedPortfolios = existingPortfolios.filter(
      (p: any) => p.id && p.isInitialized
    );
    const portfolioIds = initializedPortfolios.map((p: any) => p.id);

    if (portfolioIds.length > 0) {
      try {
        // Fetch ALL holdings for ALL initialized portfolios in one query
        const { data: allHoldings } = await (supabase
          .from('llm_holding') as any)
          .select('portfolio_id, symbol, asset_type, quantity, total_invested')
          .in('portfolio_id', portfolioIds);

        if (allHoldings && allHoldings.length > 0) {
          // Deduplicate symbols and resolve Yahoo Finance symbol format
          const symbolMap = new Map<string, string>(); // originalSymbol -> yahooSymbol
          for (const h of allHoldings) {
            if (!symbolMap.has(h.symbol)) {
              symbolMap.set(
                h.symbol,
                h.asset_type === 'crypto' ? `${h.symbol.toUpperCase()}-USD` : h.symbol
              );
            }
          }

          // Batch-fetch all prices in parallel via Yahoo Finance
          const priceMap = new Map<string, number>();
          const pricePromises = [...symbolMap.entries()].map(async ([originalSymbol, yahooSymbol]) => {
            try {
              const quote = await yahooFinance.getQuote(yahooSymbol);
              if (quote?.price) priceMap.set(originalSymbol, quote.price);
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
              ((totalPortfolioValue - INITIAL_PORTFOLIO_BALANCE) / INITIAL_PORTFOLIO_BALANCE) * 100;
          }
        }
      } catch (err) {
        console.error('Error enriching LLM portfolios:', err);
      }
    }

    // Create a complete list with all providers (including uninitialized ones)
    const portfolios = LLM_PROVIDERS.map((provider) => {
      const existing = existingPortfolios.find((p: any) => p.provider === provider);
      if (existing) {
        return {
          ...existing,
          displayName: LLM_ALLOCATIONS[provider].displayName,
          description: LLM_ALLOCATIONS[provider].description,
          strategy: LLM_ALLOCATIONS[provider].strategy,
        };
      }
      // Return placeholder for uninitialized portfolio
      return {
        id: null,
        userId: user.id,
        provider,
        isInitialized: false,
        totalValue: INITIAL_PORTFOLIO_BALANCE,
        cashBalance: INITIAL_PORTFOLIO_BALANCE,
        totalReturnPct: 0,
        displayName: LLM_ALLOCATIONS[provider].displayName,
        description: LLM_ALLOCATIONS[provider].description,
        strategy: LLM_ALLOCATIONS[provider].strategy,
        createdAt: null,
        updatedAt: null,
      };
    });

    return NextResponse.json({ portfolios });
  } catch (error) {
    console.error('LLM portfolios GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolios' },
      { status: 500 }
    );
  }
}

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
    const { provider } = body as { provider: LLMProvider };

    // Validate provider
    if (!provider || !LLM_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    // Check if already initialized
    const { data: existing } = await (supabase
      .from('llm_portfolio') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Portfolio already initialized for this provider' },
        { status: 409 }
      );
    }

    // Get allocation config
    const allocation = LLM_ALLOCATIONS[provider];
    const errors: string[] = [];
    let holdingsCreated = 0;
    let transactionsCreated = 0;

    // Create portfolio record
    const { data: portfolio, error: portfolioError } = await (supabase
      .from('llm_portfolio') as any)
      .insert({
        user_id: user.id,
        provider,
        is_initialized: false,
        total_value: INITIAL_PORTFOLIO_BALANCE,
        cash_balance: INITIAL_PORTFOLIO_BALANCE,
        total_return_pct: 0,
      })
      .select()
      .single();

    if (portfolioError || !portfolio) {
      console.error('Error creating portfolio:', portfolioError);
      return NextResponse.json(
        { error: 'Failed to create portfolio' },
        { status: 500 }
      );
    }

    let remainingCash = INITIAL_PORTFOLIO_BALANCE;
    let totalInvested = 0;

    // Process each allocation item
    for (const item of allocation.allocations) {
      try {
        // Calculate target amount
        const targetAmount = (INITIAL_PORTFOLIO_BALANCE * item.allocationPct) / 100;

        // Get current price
        let currentPrice: number | null = null;

        if (item.category === 'crypto') {
          // For crypto, use Yahoo Finance with -USD suffix
          const yahooSymbol = `${item.symbol.toUpperCase()}-USD`;
          const quote = await yahooFinance.getQuote(yahooSymbol);
          currentPrice = quote?.price || null;
        } else {
          // Map category to asset type
          const assetType: AssetType =
            item.category === 'etf' ? 'etf' :
            item.category === 'bond' ? 'etf' :  // Bonds are typically bond ETFs
            item.category === 'reit' ? 'etf' :  // REITs are typically REIT ETFs
            item.category === 'commodity' ? 'etf' :  // Commodities are typically commodity ETFs
            'stock';

          const market: Market =
            item.market === 'europe' ? 'europe' :
            item.market === 'us' ? 'us' : 'us';

          const quote = await getMarketQuote(item.symbol, assetType, market);
          currentPrice = quote?.price || null;
        }

        if (!currentPrice) {
          errors.push(`Could not get price for ${item.symbol}`);
          continue;
        }

        // Calculate quantity
        const quantity = targetAmount / currentPrice;
        const actualInvested = quantity * currentPrice;

        // Create holding
        const { error: holdingError } = await (supabase
          .from('llm_holding') as any)
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
          .from('llm_transaction') as any)
          .insert({
            portfolio_id: portfolio.id,
            symbol: item.symbol,
            transaction_type: 'buy',
            quantity,
            price_per_unit: currentPrice,
            total_amount: actualInvested,
            notes: `Initial allocation: ${item.allocationPct}%`,
          });

        if (txError) {
          errors.push(`Failed to create transaction for ${item.symbol}`);
        } else {
          transactionsCreated++;
        }

        remainingCash -= actualInvested;
        totalInvested += actualInvested;
      } catch (err) {
        errors.push(`Error processing ${item.symbol}: ${err}`);
      }
    }

    // Update portfolio with final values
    const { error: updateError } = await (supabase
      .from('llm_portfolio') as any)
      .update({
        is_initialized: true,
        cash_balance: remainingCash,
        total_value: INITIAL_PORTFOLIO_BALANCE, // Initial value equals starting balance
        total_return_pct: 0,
      })
      .eq('id', portfolio.id);

    if (updateError) {
      console.error('Error updating portfolio:', updateError);
    }

    // Create initial snapshot
    await (supabase
      .from('llm_portfolio_snapshot') as any)
      .insert({
        portfolio_id: portfolio.id,
        total_value: INITIAL_PORTFOLIO_BALANCE,
        total_return_pct: 0,
        snapshot_date: new Date().toISOString().split('T')[0],
      });

    return NextResponse.json({
      success: true,
      portfolio: transformPortfolioRow(portfolio),
      holdingsCreated,
      transactionsCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('LLM portfolio POST error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize portfolio' },
      { status: 500 }
    );
  }
}
