/**
 * Coach Configuration API Route
 * GET - Retrieve user's coach config
 * PUT - Update coach config
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateConfigSchema } from '@/schemas/coach.schema';
import { DEFAULT_COACH_CONFIG } from '@/lib/coach/types';

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get config or create default
    // Note: coach tables are not in generated types yet, using 'as any'
    const { data: config, error } = await (supabase
      .from('coach_config') as any)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching coach config:', error);
      return NextResponse.json(
        { error: 'Failed to fetch config' },
        { status: 500 }
      );
    }

    // If no config exists, return default
    if (!config) {
      return NextResponse.json({
        ...DEFAULT_COACH_CONFIG,
        userId: user.id,
        isDefault: true,
      });
    }

    // Transform database row to config object
    const transformedConfig = {
      userId: config.user_id,
      killSwitch: config.kill_switch,
      weights: {
        indicator: parseFloat(config.weight_indicator),
        priceAction: parseFloat(config.weight_price_action),
        news: parseFloat(config.weight_news),
      },
      minConfidence: parseFloat(config.min_confidence),
      minConsensusScore: parseFloat(config.min_consensus_score),
      riskParams: {
        maxAllocationPct: parseFloat(config.max_allocation_pct),
        maxOpenPositions: config.max_open_positions,
        useLeverage: config.use_leverage,
        stopLossStockPct: parseFloat(config.stop_loss_stock_pct),
        stopLossCryptoPct: parseFloat(config.stop_loss_crypto_pct),
        stopLossAtrMultiplier: parseFloat(config.stop_loss_atr_multiplier),
        tp1Pct: parseFloat(config.tp1_pct),
        tp2Pct: parseFloat(config.tp2_pct),
        runnerPct: parseFloat(config.runner_pct),
        trailingAtrMultiplier: parseFloat(config.trailing_atr_multiplier),
        dailyDrawdownLimitPct: parseFloat(config.daily_drawdown_limit_pct),
        maxConsecutiveLosses: config.max_consecutive_losses,
      },
      watchSymbols: config.watch_symbols || [],
      runCadenceMinutes: config.run_cadence_minutes,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    };

    return NextResponse.json(transformedConfig);
  } catch (error) {
    console.error('Coach config GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Transform to database columns
    const dbUpdates: Record<string, any> = {};

    if (updates.killSwitch !== undefined) {
      dbUpdates.kill_switch = updates.killSwitch;
    }

    if (updates.weights) {
      if (updates.weights.indicator !== undefined) {
        dbUpdates.weight_indicator = updates.weights.indicator;
      }
      if (updates.weights.priceAction !== undefined) {
        dbUpdates.weight_price_action = updates.weights.priceAction;
      }
      if (updates.weights.news !== undefined) {
        dbUpdates.weight_news = updates.weights.news;
      }
    }

    if (updates.minConfidence !== undefined) {
      dbUpdates.min_confidence = updates.minConfidence;
    }

    if (updates.minConsensusScore !== undefined) {
      dbUpdates.min_consensus_score = updates.minConsensusScore;
    }

    if (updates.riskParams) {
      const rp = updates.riskParams;
      if (rp.maxAllocationPct !== undefined) dbUpdates.max_allocation_pct = rp.maxAllocationPct;
      if (rp.maxOpenPositions !== undefined) dbUpdates.max_open_positions = rp.maxOpenPositions;
      if (rp.useLeverage !== undefined) dbUpdates.use_leverage = rp.useLeverage;
      if (rp.stopLossStockPct !== undefined) dbUpdates.stop_loss_stock_pct = rp.stopLossStockPct;
      if (rp.stopLossCryptoPct !== undefined) dbUpdates.stop_loss_crypto_pct = rp.stopLossCryptoPct;
      if (rp.stopLossAtrMultiplier !== undefined) dbUpdates.stop_loss_atr_multiplier = rp.stopLossAtrMultiplier;
      if (rp.tp1Pct !== undefined) dbUpdates.tp1_pct = rp.tp1Pct;
      if (rp.tp2Pct !== undefined) dbUpdates.tp2_pct = rp.tp2Pct;
      if (rp.runnerPct !== undefined) dbUpdates.runner_pct = rp.runnerPct;
      if (rp.trailingAtrMultiplier !== undefined) dbUpdates.trailing_atr_multiplier = rp.trailingAtrMultiplier;
      if (rp.dailyDrawdownLimitPct !== undefined) dbUpdates.daily_drawdown_limit_pct = rp.dailyDrawdownLimitPct;
      if (rp.maxConsecutiveLosses !== undefined) dbUpdates.max_consecutive_losses = rp.maxConsecutiveLosses;
    }

    if (updates.watchSymbols !== undefined) {
      dbUpdates.watch_symbols = updates.watchSymbols;
    }

    if (updates.runCadenceMinutes !== undefined) {
      dbUpdates.run_cadence_minutes = updates.runCadenceMinutes;
    }

    // Upsert config
    const { error } = await (supabase.from('coach_config') as any).upsert(
      {
        user_id: user.id,
        ...dbUpdates,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('Error updating coach config:', error);
      return NextResponse.json(
        { error: 'Failed to update config' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, updated: Object.keys(dbUpdates) });
  } catch (error) {
    console.error('Coach config PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
