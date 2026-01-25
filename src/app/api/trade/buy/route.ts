/**
 * Buy Trade API Route
 * Execute buy orders and update portfolio
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buySchema } from '@/schemas/trade.schema';
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
    const validation = buySchema.safeParse(body);

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
    const totalCost = subtotal + fee;

    // Get user's balance
    const { data: balance, error: balanceError } = await supabase
      .from('balances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (balanceError || !balance) {
      return NextResponse.json(
        { error: 'Failed to retrieve balance' },
        { status: 500 }
      );
    }

    // Check if user has sufficient funds
    if (balance.available_cash < totalCost) {
      return NextResponse.json(
        {
          error: 'Insufficient funds',
          required: totalCost,
          available: balance.available_cash,
        },
        { status: 400 }
      );
    }

    // Check if user already owns this asset
    const { data: existingHolding } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .eq('asset_type', assetType)
      .single();

    // Calculate new average buy price and total invested
    let newQuantity: number;
    let newAverageBuyPrice: number;
    let newTotalInvested: number;

    if (existingHolding) {
      newQuantity = Number(existingHolding.quantity) + quantity;
      newTotalInvested = Number(existingHolding.total_invested) + subtotal;
      newAverageBuyPrice = newTotalInvested / newQuantity;
    } else {
      newQuantity = quantity;
      newTotalInvested = subtotal;
      newAverageBuyPrice = pricePerUnit;
    }

    // Execute transaction (update balance, portfolio, and create transaction record)
    const newBalance = balance.available_cash - totalCost;
    const newTotalInvestedBalance = Number(balance.total_invested) + subtotal;

    // Update balance
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

    // Upsert portfolio holding
    const { error: portfolioError } = await supabase.from('portfolios').upsert(
      {
        user_id: user.id,
        symbol,
        asset_type: assetType,
        asset_name: assetName,
        quantity: newQuantity,
        average_buy_price: newAverageBuyPrice,
        total_invested: newTotalInvested,
      },
      {
        onConflict: 'user_id,symbol,asset_type',
      }
    );

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

    // Create transaction record
    const { error: transactionError } = await supabase.from('transactions').insert({
      user_id: user.id,
      symbol,
      asset_type: assetType,
      asset_name: assetName,
      transaction_type: 'buy',
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
        total_cost: totalCost,
      },
      new_balance: newBalance,
    });
  } catch (error) {
    console.error('Buy trade error:', error);
    return NextResponse.json(
      { error: 'Failed to execute buy order' },
      { status: 500 }
    );
  }
}
