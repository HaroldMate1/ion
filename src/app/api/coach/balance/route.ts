/**
 * Coach Balance API Route
 * GET - Returns the coach's paper trading portfolio state
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPortfolioState } from '@/lib/coach/autonomousRunner';
import { INITIAL_COACH_BALANCE } from '@/lib/coach/types';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = await getPortfolioState(supabase, user.id);

    return NextResponse.json({
      initialBalance: INITIAL_COACH_BALANCE,
      totalValue: state.totalValue,
      availableCash: state.availableCash,
      capitalInUse: state.totalValue - state.availableCash,
      totalReturnPct: ((state.totalValue - INITIAL_COACH_BALANCE) / INITIAL_COACH_BALANCE) * 100,
      todayPnL: state.todayPnL,
      todayPnLPercent: state.todayPnLPercent,
      openPositions: state.openPositions,
    });
  } catch (error) {
    console.error('Coach balance error:', error);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
