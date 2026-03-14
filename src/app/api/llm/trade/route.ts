import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as yahooFinance from '@/lib/api/yahoo-finance';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { portfolioId, symbol, action, quantity, assetType, market } = body;

    // Validate inputs
    if (!portfolioId || !symbol || !action || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    if (!['buy', 'sell'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 1. Get portfolio and verify ownership
    const { data: portfolio, error: portfolioError } = await (supabase
      .from('llm_portfolio') as any)
      .select('*')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // 2. Get current price
    // Handle crypto symbols for Yahoo Finance
    const yahooSymbol = assetType === 'crypto' || market === 'crypto' 
      ? `${symbol.toUpperCase()}-USD` 
      : symbol;

    const quote = await yahooFinance.getQuote(yahooSymbol);
    
    if (!quote || !quote.price) {
      return NextResponse.json({ error: `Could not get price for ${symbol}` }, { status: 400 });
    }

    const price = quote.price;
    const totalAmount = price * quantity;

    // 3. Execute Trade
    if (action === 'buy') {
      // Check cash balance
      if (portfolio.cash_balance < totalAmount) {
        return NextResponse.json(
          { error: `Insufficient cash. Required: $${totalAmount.toFixed(2)}, Available: $${portfolio.cash_balance.toFixed(2)}` },
          { status: 400 }
        );
      }

      // Check if holding exists
      const { data: existingHolding } = await (supabase
        .from('llm_holding') as any)
        .select('*')
        .eq('portfolio_id', portfolioId)
        .eq('symbol', symbol)
        .maybeSingle();

      if (existingHolding) {
        // Update existing holding
        const newQuantity = parseFloat(existingHolding.quantity) + quantity;
        const newTotalInvested = parseFloat(existingHolding.total_invested) + totalAmount;
        // Calculate new weighted averge price
        // (Old Total + New Total) / New Quantity
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
        // Create new holding
        if (!assetType) {
           return NextResponse.json({ error: 'Asset type required for new position' }, { status: 400 });
        }
        
        await (supabase.from('llm_holding') as any)
          .insert({
             portfolio_id: portfolioId,
             symbol,
             asset_type: assetType,
             market: market || 'us',
             target_allocation_pct: 0, // Manual trade, no target
             quantity,
             average_buy_price: price,
             total_invested: totalAmount,
             asset_name: symbol, // Default to symbol if name not provided
          });
      }

      // Update cash
      await (supabase.from('llm_portfolio') as any)
        .update({
          cash_balance: portfolio.cash_balance - totalAmount,
        })
        .eq('id', portfolioId);

    } else if (action === 'sell') {
      // Check holding existence and quantity
      const { data: existingHolding } = await (supabase
        .from('llm_holding') as any)
        .select('*')
        .eq('portfolio_id', portfolioId)
        .eq('symbol', symbol)
        .single();

      if (!existingHolding || parseFloat(existingHolding.quantity) < quantity) {
        return NextResponse.json(
          { error: 'Insufficient holding quantity' },
          { status: 400 }
        );
      }

      const currentQty = parseFloat(existingHolding.quantity);
      const remainingQty = currentQty - quantity;

      if (remainingQty <= 0.000001) { // Floating point tolerance
        // Fully sold - remove holding
        await (supabase.from('llm_holding') as any)
          .delete()
          .eq('id', existingHolding.id);
      } else {
        // Partial sell - update quantity and total invested
        // Assuming FIFO or Average Cost - usually for P&L we want to reduce total_invested proportionally
        const costBasisPerUnit = parseFloat(existingHolding.total_invested) / currentQty;
        // We reduce total_invested by the cost of the sold units
        const costOfSoldUnits = costBasisPerUnit * quantity;
        const newTotalInvested = parseFloat(existingHolding.total_invested) - costOfSoldUnits;
        
        await (supabase.from('llm_holding') as any)
          .update({
            quantity: remainingQty,
             // total_invested represents the cost basis of the remaining position
            total_invested: newTotalInvested,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingHolding.id);
      }

      // Update cash (add proceed amount)
      await (supabase.from('llm_portfolio') as any)
        .update({
          cash_balance: portfolio.cash_balance + totalAmount,
        })
        .eq('id', portfolioId);
    }

    // 4. Record Transaction
    await (supabase.from('llm_transaction') as any)
      .insert({
        portfolio_id: portfolioId,
        symbol,
        transaction_type: action,
        quantity,
        price_per_unit: price,
        total_amount: totalAmount,
        notes: `Manual ${action} trade`,
      });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Trade execution error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute trade' },
      { status: 500 }
    );
  }
}
