/**
 * Fine-Tune Portfolio Config API
 * GET  – fetch current fine-tune weights
 * PUT  – save optimized weights (applied from backtest results)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEFAULT_WEIGHTS = { indicator: 0.45, priceAction: 0.45, news: 0.10 };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data } = await (supabase.from('fine_tune_config') as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        weights: DEFAULT_WEIGHTS,
        killSwitch: false,
        isActive: false,
        lastAppliedAt: null,
      });
    }

    return NextResponse.json({
      weights: {
        indicator: Number(data.indicator_weight),
        priceAction: Number(data.price_action_weight),
        news: Number(data.news_weight),
      },
      killSwitch: data.kill_switch,
      isActive: data.is_active,
      lastAppliedAt: data.last_applied_at,
    });
  } catch (err) {
    console.error('Fine-tune config GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

/**
 * DELETE /api/fine-tune/config
 * Reset the fine-tune portfolio: wipe all trades and the config record.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await (supabase.from('fine_tune_trade') as any).delete().eq('user_id', user.id);
    await (supabase.from('fine_tune_config') as any).delete().eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fine-tune config DELETE error:', err);
    return NextResponse.json({ error: 'Failed to reset fine-tune portfolio' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { weights, killSwitch } = body;

    const upsertData: Record<string, unknown> = { user_id: user.id };

    if (weights) {
      upsertData.indicator_weight = weights.indicator;
      upsertData.price_action_weight = weights.priceAction;
      upsertData.news_weight = weights.news;
      upsertData.is_active = true;
      upsertData.last_applied_at = new Date().toISOString();
    }
    if (killSwitch !== undefined) upsertData.kill_switch = killSwitch;

    const { error } = await (supabase.from('fine_tune_config') as any)
      .upsert(upsertData, { onConflict: 'user_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fine-tune config PUT error:', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
