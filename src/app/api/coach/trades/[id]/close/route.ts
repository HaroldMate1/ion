/**
 * Close Paper Trade API Route
 * POST - Close an open paper trade
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { closePaperTradeSchema } from '@/schemas/coach.schema';
import { calculatePnL } from '@/lib/coach/risk/riskEngine';

export async function POST(
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

    const body = await request.json();

    // Validate that tradeId matches URL param
    const validation = closePaperTradeSchema.safeParse({ ...body, tradeId: id });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { exitPrice, notes } = validation.data;

    // Get the trade (coach tables not in generated types, using 'as any')
    const { data: trade, error: fetchError } = await (supabase
      .from('coach_paper_trade') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching trade:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch trade' },
        { status: 500 }
      );
    }

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const tradeData = trade as any;

    if (tradeData.status !== 'open') {
      return NextResponse.json(
        { error: 'Trade is already closed' },
        { status: 400 }
      );
    }

    // Calculate P&L
    const entryPrice = parseFloat(tradeData.entry_price);
    const quantity = parseFloat(tradeData.quantity);
    const { pnl, pnlPercent } = calculatePnL(entryPrice, exitPrice, quantity, tradeData.side);

    // Determine close status
    let status = 'closed';
    const stopLoss = tradeData.stop_loss ? parseFloat(tradeData.stop_loss) : null;

    if (stopLoss) {
      if (tradeData.side === 'BUY' && exitPrice <= stopLoss) {
        status = 'stopped';
      } else if (tradeData.side === 'SELL' && exitPrice >= stopLoss) {
        status = 'stopped';
      }
    }

    // Check if TP hit
    const takeProfits = tradeData.take_profit_json || [];
    for (const tp of takeProfits) {
      if (tradeData.side === 'BUY' && exitPrice >= tp.price) {
        status = 'tp_hit';
        break;
      } else if (tradeData.side === 'SELL' && exitPrice <= tp.price) {
        status = 'tp_hit';
        break;
      }
    }

    // Update trade
    const { error: updateError } = await (supabase
      .from('coach_paper_trade') as any)
      .update({
        status,
        closed_at: new Date().toISOString(),
        exit_price: exitPrice,
        pnl_usd: pnl,
        pnl_pct: pnlPercent,
        notes: notes || tradeData.notes,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error closing trade:', updateError);
      return NextResponse.json(
        { error: 'Failed to close trade' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trade: {
        id,
        status,
        exitPrice,
        pnlUsd: pnl,
        pnlPct: pnlPercent,
        closedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Close trade error:', error);
    return NextResponse.json(
      { error: 'Failed to close trade' },
      { status: 500 }
    );
  }
}
