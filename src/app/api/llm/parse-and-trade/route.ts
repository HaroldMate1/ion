/**
 * Parse & Trade API Route
 * Accepts raw LLM response text, parses trade instructions, saves the log,
 * and automatically executes all trades.
 * 
 * POST /api/llm/parse-and-trade
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as yahooFinance from '@/lib/api/yahoo-finance';

interface ParsedTrade {
  action: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  rationale: string;
}

/**
 * Parse trade instructions from LLM response text.
 * Supports multiple formats:
 * 1. "ACTION | SYMBOL | QUANTITY | RATIONALE" (pipe-separated)
 * 2. "BUY NVDA 10 shares" (natural language)
 * 3. "BUY: NVDA, Quantity: 10" (key-value)
 */
function parseTrades(text: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Strategy 1: Pipe-separated format - "BUY | NVDA | 10 | rationale"
    const pipeMatch = trimmed.match(
      /^\|?\s*(BUY|SELL)\s*\|\s*([A-Z0-9.\-]+)\s*\|\s*([\d.]+)\s*(?:\|(.*))?$/i
    );
    if (pipeMatch) {
      trades.push({
        action: pipeMatch[1].toLowerCase() as 'buy' | 'sell',
        symbol: pipeMatch[2].toUpperCase(),
        quantity: parseFloat(pipeMatch[3]),
        rationale: (pipeMatch[4] || '').trim(),
      });
      continue;
    }

    // Strategy 2: Markdown table row - "| BUY | NVDA | 10 | rationale |"
    const tableMatch = trimmed.match(
      /\|\s*(BUY|SELL)\s*\|\s*([A-Z0-9.\-]+)\s*\|\s*([\d.]+)\s*\|/i
    );
    if (tableMatch) {
      const rest = trimmed.split('|').slice(4).join('|').trim();
      trades.push({
        action: tableMatch[1].toLowerCase() as 'buy' | 'sell',
        symbol: tableMatch[2].toUpperCase(),
        quantity: parseFloat(tableMatch[3]),
        rationale: rest.replace(/\|$/g, '').trim(),
      });
      continue;
    }

    // Strategy 3: Natural language - "BUY 10 shares of NVDA" or "BUY NVDA 10"
    const naturalMatch = trimmed.match(
      /\b(BUY|SELL)\s+(\d+(?:\.\d+)?)\s+(?:shares?\s+(?:of\s+)?)?([A-Z0-9.\-]+)/i
    );
    if (naturalMatch) {
      trades.push({
        action: naturalMatch[1].toLowerCase() as 'buy' | 'sell',
        symbol: naturalMatch[3].toUpperCase(),
        quantity: parseFloat(naturalMatch[2]),
        rationale: '',
      });
      continue;
    }

    // Strategy 4: "BUY NVDA 10 shares"
    const reverseMatch = trimmed.match(
      /\b(BUY|SELL)\s+([A-Z0-9.\-]+)\s+(\d+(?:\.\d+)?)/i
    );
    if (reverseMatch) {
      trades.push({
        action: reverseMatch[1].toLowerCase() as 'buy' | 'sell',
        symbol: reverseMatch[2].toUpperCase(),
        quantity: parseFloat(reverseMatch[3]),
        rationale: '',
      });
      continue;
    }

    // Strategy 5: Dollar-amount based - "BUY $5000 of NVDA" or "BUY NVDA $5000"
    const dollarMatch1 = trimmed.match(
      /\b(BUY|SELL)\s+\$?([\d,]+(?:\.\d+)?)\s+(?:of|worth(?:\s+of)?)\s+([A-Z0-9.\-]+)/i
    );
    if (dollarMatch1) {
      trades.push({
        action: dollarMatch1[1].toLowerCase() as 'buy' | 'sell',
        symbol: dollarMatch1[3].toUpperCase(),
        quantity: parseFloat(dollarMatch1[2].replace(/,/g, '')),
        rationale: '$amount', // Flag to indicate this is a dollar amount, not shares
      });
      continue;
    }
  }

  return trades;
}

/**
 * Detect asset type from symbol
 */
function detectAssetType(symbol: string): { assetType: string; market: string; yahooSymbol: string } {
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'LINK', 'MATIC', 'UNI', 'DOGE', 'XRP', 'BNB', 'SHIB', 'LTC'];
  
  if (cryptoSymbols.includes(symbol.toUpperCase())) {
    return { assetType: 'crypto', market: 'crypto', yahooSymbol: `${symbol.toUpperCase()}-USD` };
  }

  // European symbols often have dots
  if (symbol.includes('.DE') || symbol.includes('.L') || symbol.includes('.PA') || symbol.includes('.CO')) {
    return { assetType: 'stock', market: 'europe', yahooSymbol: symbol };
  }

  // ETF detection (common ETF symbols)
  const etfSymbols = ['SPY', 'QQQ', 'VTI', 'VXUS', 'BND', 'VNQ', 'GLD', 'SLV', 'IVV', 'VOO', 'VT', 
    'AGG', 'TLT', 'ARKK', 'IWM', 'EEM', 'XLF', 'XLE', 'XLK', 'XLV', 'BNDX', 'VEA', 'VWO',
    'VWCE', 'CSPX', 'VAGP', 'AGGH'];
  if (etfSymbols.includes(symbol.toUpperCase())) {
    return { assetType: 'etf', market: 'us', yahooSymbol: symbol };
  }

  return { assetType: 'stock', market: 'us', yahooSymbol: symbol };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { portfolioId, content } = body;

    if (!portfolioId || !content) {
      return NextResponse.json({ error: 'Missing portfolioId or content' }, { status: 400 });
    }

    // 1. Verify portfolio ownership
    const { data: portfolio, error: portfolioError } = await (supabase
      .from('llm_portfolio') as any)
      .select('*')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // 2. Parse trade instructions from the text
    const parsedTrades = parseTrades(content);

    // 3. Save the daily log
    await (supabase.from('llm_daily_log') as any)
      .insert({
        portfolio_id: portfolioId,
        content,
      });

    // 4. Execute each parsed trade
    const results: { symbol: string; action: string; status: string; detail: string }[] = [];
    let currentCash = parseFloat(portfolio.cash_balance);

    for (const trade of parsedTrades) {
      try {
        // Detect asset type and get Yahoo Finance symbol
        const { assetType, market, yahooSymbol } = detectAssetType(trade.symbol);

        // Get current price
        const quote = await yahooFinance.getQuote(yahooSymbol);
        if (!quote || !quote.price) {
          results.push({
            symbol: trade.symbol,
            action: trade.action,
            status: 'failed',
            detail: `Could not get price for ${trade.symbol}`,
          });
          continue;
        }

        const price = quote.price;

        // If rationale is '$amount', convert dollar amount to shares
        let quantity = trade.quantity;
        if (trade.rationale === '$amount') {
          quantity = trade.quantity / price;
          trade.rationale = `$${trade.quantity} worth`;
        }

        const totalAmount = price * quantity;

        if (trade.action === 'buy') {
          // Check cash
          if (currentCash < totalAmount) {
            results.push({
              symbol: trade.symbol,
              action: 'buy',
              status: 'failed',
              detail: `Insufficient cash. Need $${totalAmount.toFixed(2)}, have $${currentCash.toFixed(2)}`,
            });
            continue;
          }

          // Check existing holding
          const { data: existingHolding } = await (supabase
            .from('llm_holding') as any)
            .select('*')
            .eq('portfolio_id', portfolioId)
            .eq('symbol', trade.symbol)
            .maybeSingle();

          if (existingHolding) {
            const newQuantity = parseFloat(existingHolding.quantity) + quantity;
            const newTotalInvested = parseFloat(existingHolding.total_invested) + totalAmount;
            const newAvgPrice = newTotalInvested / newQuantity;

            await (supabase.from('llm_holding') as any)
              .update({
                quantity: newQuantity,
                total_invested: newTotalInvested,
                average_buy_price: newAvgPrice,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingHolding.id);
          } else {
            await (supabase.from('llm_holding') as any)
              .insert({
                portfolio_id: portfolioId,
                symbol: trade.symbol,
                asset_name: quote.name || trade.symbol,
                asset_type: assetType,
                market,
                target_allocation_pct: 0,
                quantity,
                average_buy_price: price,
                total_invested: totalAmount,
              });
          }

          currentCash -= totalAmount;

          // Record transaction
          await (supabase.from('llm_transaction') as any)
            .insert({
              portfolio_id: portfolioId,
              symbol: trade.symbol,
              transaction_type: 'buy',
              quantity,
              price_per_unit: price,
              total_amount: totalAmount,
              notes: trade.rationale || 'Auto-executed from daily log',
            });

          results.push({
            symbol: trade.symbol,
            action: 'buy',
            status: 'success',
            detail: `Bought ${quantity.toFixed(4)} @ $${price.toFixed(2)} = $${totalAmount.toFixed(2)}`,
          });

        } else if (trade.action === 'sell') {
          // Check holding
          const { data: existingHolding } = await (supabase
            .from('llm_holding') as any)
            .select('*')
            .eq('portfolio_id', portfolioId)
            .eq('symbol', trade.symbol)
            .maybeSingle();

          if (!existingHolding) {
            results.push({
              symbol: trade.symbol,
              action: 'sell',
              status: 'failed',
              detail: `No holding found for ${trade.symbol}`,
            });
            continue;
          }

          const currentQty = parseFloat(existingHolding.quantity);
          const sellQty = Math.min(quantity, currentQty); // Don't sell more than we have
          const sellAmount = sellQty * price;
          const remainingQty = currentQty - sellQty;

          if (remainingQty <= 0.000001) {
            await (supabase.from('llm_holding') as any)
              .delete()
              .eq('id', existingHolding.id);
          } else {
            const costBasisPerUnit = parseFloat(existingHolding.total_invested) / currentQty;
            const newTotalInvested = parseFloat(existingHolding.total_invested) - (costBasisPerUnit * sellQty);

            await (supabase.from('llm_holding') as any)
              .update({
                quantity: remainingQty,
                total_invested: newTotalInvested,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingHolding.id);
          }

          currentCash += sellAmount;

          await (supabase.from('llm_transaction') as any)
            .insert({
              portfolio_id: portfolioId,
              symbol: trade.symbol,
              transaction_type: 'sell',
              quantity: sellQty,
              price_per_unit: price,
              total_amount: sellAmount,
              notes: trade.rationale || 'Auto-executed from daily log',
            });

          results.push({
            symbol: trade.symbol,
            action: 'sell',
            status: 'success',
            detail: `Sold ${sellQty.toFixed(4)} @ $${price.toFixed(2)} = $${sellAmount.toFixed(2)}`,
          });
        }
      } catch (err: any) {
        results.push({
          symbol: trade.symbol,
          action: trade.action,
          status: 'failed',
          detail: err.message || 'Unknown error',
        });
      }
    }

    // 5. Update portfolio cash balance
    await (supabase.from('llm_portfolio') as any)
      .update({ cash_balance: currentCash })
      .eq('id', portfolioId);

    return NextResponse.json({
      success: true,
      tradesFound: parsedTrades.length,
      results,
      logSaved: true,
    });

  } catch (error: any) {
    console.error('Parse and trade error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse and execute trades' },
      { status: 500 }
    );
  }
}
