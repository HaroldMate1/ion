/**
 * Coach Signals API Route
 * GET - List signals with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const symbol = searchParams.get('symbol');
    const action = searchParams.get('action');
    const acknowledged = searchParams.get('acknowledged');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query (coach tables not in generated types, using 'as any')
    let query = (supabase
      .from('coach_signal') as any)
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('signal_ts', { ascending: false });

    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    if (action) {
      query = query.eq('consensus_action', action.toUpperCase());
    }

    if (acknowledged !== null) {
      query = query.eq('acknowledged', acknowledged === 'true');
    }

    query = query.range(offset, offset + limit - 1);

    const { data: signals, count, error } = await query;

    if (error) {
      console.error('Error fetching signals:', error);
      return NextResponse.json(
        { error: 'Failed to fetch signals' },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedSignals = (signals || []).map(transformSignalRow);

    return NextResponse.json({
      signals: transformedSignals,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Coach signals GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}

function transformSignalRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    assetType: row.asset_type,
    market: row.market,
    timeframe: row.timeframe,
    signalTs: row.signal_ts,
    consensusAction: row.consensus_action,
    consensusScore: parseFloat(row.consensus_score),
    entryLow: row.entry_low ? parseFloat(row.entry_low) : undefined,
    entryHigh: row.entry_high ? parseFloat(row.entry_high) : undefined,
    stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : undefined,
    takeProfitJson: row.take_profit_json,
    agentVotesJson: row.agent_votes_json,
    rationale: row.rationale,
    expectedReturnPct: row.expected_return_pct ? parseFloat(row.expected_return_pct) : undefined,
    expectedRiskPct: row.expected_risk_pct ? parseFloat(row.expected_risk_pct) : undefined,
    riskRewardRatio: row.risk_reward_ratio ? parseFloat(row.risk_reward_ratio) : undefined,
    marketOpen: row.market_open,
    currentPrice: row.current_price ? parseFloat(row.current_price) : undefined,
    isStale: row.is_stale,
    acknowledged: row.acknowledged,
    createdAt: row.created_at,
  };
}
