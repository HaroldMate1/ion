/**
 * Coach Paper Trades API Route
 * GET - List paper trades
 * POST - Create paper trade from signal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPaperTradeSchema } from '@/schemas/coach.schema';
import { getMarketQuote } from '@/lib/api/market-data';
import { calculatePnL } from '@/lib/coach/risk/riskEngine';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query (coach tables not in generated types, using 'as any')
    let query = (supabase
      .from('coach_paper_trade') as any)
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    query = query.range(offset, offset + limit - 1);

    const { data: trades, count, error } = await query;

    if (error) {
      console.error('Error fetching paper trades:', error);
      return NextResponse.json(
        { error: 'Failed to fetch trades' },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedTrades = (trades || []).map(transformTradeRow);

    // Enrich open trades with live unrealized P&L
    const enrichedTrades = await Promise.all(
      transformedTrades.map(async (trade: any) => {
        if (trade.status !== 'open') return trade;
        try {
          const quote = await getMarketQuote(
            trade.symbol,
            trade.assetType || 'stock',
            trade.market || 'us'
          );
          if (!quote) return trade;
          const { pnl, pnlPercent } = calculatePnL(
            trade.entryPrice,
            quote.price,
            trade.quantity,
            trade.side
          );
          return { ...trade, pnlUsd: pnl, pnlPct: pnlPercent, currentPrice: quote.price };
        } catch {
          return trade;
        }
      })
    );

    return NextResponse.json({
      trades: enrichedTrades,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Coach trades GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
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
    const validation = createPaperTradeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      signalId,
      symbol,
      assetType,
      market,
      side,
      entryPrice,
      sizeUsd,
      stopLoss,
      takeProfitJson,
      notes,
    } = validation.data;

    // Calculate quantity
    const quantity = sizeUsd / entryPrice;

    // Check kill switch
    const { data: config } = await (supabase
      .from('coach_config') as any)
      .select('kill_switch')
      .eq('user_id', user.id)
      .maybeSingle();

    if ((config as any)?.kill_switch) {
      return NextResponse.json(
        { error: 'Kill switch is active. Cannot create paper trade.' },
        { status: 403 }
      );
    }

    // Check max open positions
    const { count: openCount } = await (supabase
      .from('coach_paper_trade') as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'open');

    const { data: configFull } = await (supabase
      .from('coach_config') as any)
      .select('max_open_positions')
      .eq('user_id', user.id)
      .maybeSingle();

    const maxPositions = (configFull as any)?.max_open_positions || 4;

    if ((openCount || 0) >= maxPositions) {
      return NextResponse.json(
        { error: `Maximum open positions (${maxPositions}) reached.` },
        { status: 400 }
      );
    }

    // Create paper trade
    const { data: trade, error } = await (supabase
      .from('coach_paper_trade') as any)
      .insert({
        user_id: user.id,
        signal_id: signalId,
        symbol: symbol.toUpperCase(),
        asset_type: assetType,
        market,
        side,
        entry_price: entryPrice,
        size_usd: sizeUsd,
        quantity,
        stop_loss: stopLoss,
        take_profit_json: takeProfitJson,
        status: 'open',
        opened_at: new Date().toISOString(),
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating paper trade:', error);
      return NextResponse.json(
        { error: 'Failed to create paper trade' },
        { status: 500 }
      );
    }

    // If linked to a signal, mark it as acknowledged
    if (signalId) {
      await (supabase
        .from('coach_signal') as any)
        .update({ acknowledged: true })
        .eq('id', signalId)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      trade: transformTradeRow(trade),
    });
  } catch (error) {
    console.error('Coach trades POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create paper trade' },
      { status: 500 }
    );
  }
}

function transformTradeRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    signalId: row.signal_id,
    symbol: row.symbol,
    assetType: row.asset_type,
    market: row.market,
    side: row.side,
    entryPrice: parseFloat(row.entry_price),
    sizeUsd: parseFloat(row.size_usd),
    quantity: parseFloat(row.quantity),
    stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : undefined,
    takeProfitJson: row.take_profit_json,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    exitPrice: row.exit_price ? parseFloat(row.exit_price) : undefined,
    pnlUsd: row.pnl_usd ? parseFloat(row.pnl_usd) : undefined,
    pnlPct: row.pnl_pct ? parseFloat(row.pnl_pct) : undefined,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
