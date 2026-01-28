/**
 * Coach Signal Detail API Route
 * GET - Get single signal
 * PATCH - Acknowledge signal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: signal, error } = await (supabase
      .from('coach_signal') as any)
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching signal:', error);
      return NextResponse.json(
        { error: 'Failed to fetch signal' },
        { status: 500 }
      );
    }

    if (!signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    return NextResponse.json(transformSignalRow(signal));
  } catch (error) {
    console.error('Coach signal GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signal' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { acknowledged } = body;

    if (typeof acknowledged !== 'boolean') {
      return NextResponse.json(
        { error: 'acknowledged must be a boolean' },
        { status: 400 }
      );
    }

    const { error } = await (supabase
      .from('coach_signal') as any)
      .update({ acknowledged })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating signal:', error);
      return NextResponse.json(
        { error: 'Failed to update signal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, acknowledged });
  } catch (error) {
    console.error('Coach signal PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update signal' },
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
