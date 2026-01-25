/**
 * Sell Trade API Route
 * Execute sell orders and update portfolio
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sellSchema } from '@/schemas/trade.schema';
import { getMarketQuote } from '@/lib/api/market-data';

const TRANSACTION_FEE_PERCENT = 0.001; // 0.1% fee

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = sellSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { symbol, assetType, assetName, quantity } = validation.data;

    // Get current market price
    const quote = await getMarketQuote(symbol, assetType);

    if (!quote) {
      return NextResponse.json(
        { error: 'Unable to fetch current price for this asset' },
        { status: 404 }
      );
    }

    const pricePerUnit = quote.price;
    const subtotal = quantity * pricePerUnit;
    const fee = subtotal * TRANSACTION_FEE_PERCENT;
    const totalProceeds = subtotal - fee;

    // Get user's holding
    const { data: holding, error: holdingError } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .eq('asset_type', assetType)
      .maybeSingle();

    if (holdingError || !holding) {
      return NextResponse.json(
        { error: 'You do not own this asset' },
        { status: 400 }
      );
    }

    const userHolding = holding as any;

    // Check if user has sufficient quantity
    const currentQuantity = Number(userHolding.quantity);
    if (currentQuantity < quantity) {
      return NextResponse.json(
        {
          error: 'Insufficient holdings',
          required: quantity,
          available: currentQuantity,
        },
        { status: 400 }
      );
    }

    // Get user's balance
    const { data: balance, error: balanceError } = await supabase
      .from('balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (balanceError || !balance) {
      return NextResponse.json(
        { error: 'Failed to retrieve balance' },
        { status: 500 }
      );
    }

    const userBalance = balance as any;

    // Calculate new quantities
    const newQuantity = currentQuantity - quantity;
    const proportionSold = quantity / currentQuantity;
    const amountInvestedInSold = Number(userHolding.total_invested) * proportionSold;
    const newTotalInvested = Number(userHolding.total_invested) - amountInvestedInSold;

    // Update balance
    const newBalance = Number(userBalance.available_cash) + totalProceeds;
    const newTotalInvestedBalance = Number(userBalance.total_invested) - amountInvestedInSold;

    const { error: updateBalanceError } = await supabase
      .from('balances')
      .update({
        available_cash: newBalance,
        total_invested: newTotalInvestedBalance,
      })
      .eq('user_id', user.id);

    if (updateBalanceError) {
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      );
    }

    // Update or delete portfolio holding
    if (newQuantity > 0) {
      // Update with remaining quantity
      const { error: portfolioError } = await supabase
        .from('portfolios')
        .update({
          quantity: newQuantity,
          total_invested: newTotalInvested,
          // Keep the same average buy price
        })
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .eq('asset_type', assetType);

      if (portfolioError) {
        // Rollback balance update
        await supabase
          .from('balances')
          .update({
            available_cash: balance.available_cash,
            total_invested: balance.total_invested,
          })
          .eq('user_id', user.id);

        return NextResponse.json(
          { error: 'Failed to update portfolio' },
          { status: 500 }
        );
      }
    } else {
      // Delete holding (sold all)
      const { error: deleteError } = await supabase
        .from('portfolios')
        .delete()
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .eq('asset_type', assetType);

      if (deleteError) {
        // Rollback balance update
        await supabase
          .from('balances')
          .update({
            available_cash: balance.available_cash,
            total_invested: balance.total_invested,
          })
          .eq('user_id', user.id);

        return NextResponse.json(
          { error: 'Failed to remove holding' },
          { status: 500 }
        );
      }
    }

    // Create transaction record
    const { error: transactionError } = await supabase.from('transactions').insert({
      user_id: user.id,
      symbol,
      asset_type: assetType,
      asset_name: assetName,
      transaction_type: 'sell',
      quantity,
      price_per_unit: pricePerUnit,
      total_amount: subtotal,
      fee,
    });

    if (transactionError) {
      console.error('Failed to create transaction record:', transactionError);
      // Don't rollback, transaction is complete, just log the error
    }

    return NextResponse.json({
      success: true,
      transaction: {
        symbol,
        asset_name: assetName,
        asset_type: assetType,
        quantity,
        price_per_unit: pricePerUnit,
        total_amount: subtotal,
        fee,
        total_proceeds: totalProceeds,
      },
      new_balance: newBalance,
      remaining_quantity: newQuantity,
    });
  } catch (error) {
    console.error('Sell trade error:', error);
    return NextResponse.json(
      { error: 'Failed to execute sell order' },
      { status: 500 }
    );
  }
}
